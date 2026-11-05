import inventoryService from '../services/inventory.service.js';
import { logger } from '../config/logger.config.js';

/**
 * Sweeper job to transition expired inventory reservations and return held stock to circulation.
 */
export const cleanExpiredReservations = async () => {
  try {
    const result = await inventoryService.expireReservations();

    if (result.expiredCount > 0) {
      logger.info(`[CLEANUP JOB] Expired and restored ${result.expiredCount} reservation(s)`);
    }

    return result.expiredCount;
  } catch (error) {
    logger.error('[CLEANUP JOB] Failed to clean expired reservations:', error);
    throw error;
  }
};

export default cleanExpiredReservations;

