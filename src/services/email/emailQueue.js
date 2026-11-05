/**
 * FORME In-Process Email Reliability Engine
 * Manages exponential backoff retries, concurrency limiting, and rate throttling
 * without external dependencies like Redis.
 */

// Helper to pause execution for a given duration
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class EmailQueue {
  constructor(options = {}) {
    this.concurrencyLimit = options.concurrencyLimit || 5;
    this.delayBetweenTasksMs = options.delayBetweenTasksMs || 60;
    this.activeWorkers = 0;
    this.queue = [];
    this.isProcessing = false;
  }

  /**
   * Executes a task function with automatic exponential backoff retries for transient errors.
   * @param {Function} taskFn - Async function to execute
   * @param {Object} options
   * @param {number} options.maxRetries - Maximum retry count (default: 3)
   * @param {number} options.initialDelayMs - Initial delay before first retry in ms (default: 400)
   * @param {number} options.backoffFactor - Multiplier for delay (default: 2)
   * @returns {Promise<any>}
   */
  async executeWithRetry(taskFn, { maxRetries = 3, initialDelayMs = 400, backoffFactor = 2 } = {}) {
    let lastError = null;
    let delay = initialDelayMs;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await taskFn(attempt);
      } catch (err) {
        lastError = err;

        // Check if error is permanently fatal (e.g., invalid email format, auth failure)
        const isPermanent =
          err.statusCode === 400 ||
          err.code === 'EENVELOPE' ||
          err.message?.includes('invalid email') ||
          err.message?.includes('Required parameter');

        if (isPermanent || attempt === maxRetries) {
          throw err;
        }

        console.warn(
          `⚠️ [FORME EMAIL RETRY] Attempt ${attempt}/${maxRetries} failed: "${err.message}". Retrying in ${delay}ms...`
        );
        await sleep(delay);
        delay *= backoffFactor;
      }
    }

    throw lastError;
  }

  /**
   * Enqueues an email dispatch task in the in-process queue.
   * @param {Function} taskFn - () => Promise<any>
   * @returns {Promise<any>}
   */
  enqueue(taskFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ taskFn, resolve, reject });
      this._processNext();
    });
  }

  async _processNext() {
    if (this.activeWorkers >= this.concurrencyLimit || this.queue.length === 0) {
      return;
    }

    this.activeWorkers++;
    const { taskFn, resolve, reject } = this.queue.shift();

    try {
      const result = await taskFn();
      resolve(result);
    } catch (err) {
      reject(err);
    } finally {
      this.activeWorkers--;
      if (this.delayBetweenTasksMs > 0) {
        await sleep(this.delayBetweenTasksMs);
      }
      this._processNext();
    }
  }

  /**
   * Returns current queue diagnostics.
   */
  getStats() {
    return {
      pending: this.queue.length,
      active: this.activeWorkers,
      concurrencyLimit: this.concurrencyLimit,
    };
  }
}

export const emailQueue = new EmailQueue();
export default emailQueue;

