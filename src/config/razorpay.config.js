import Razorpay from 'razorpay';
import env from './env.config.js';

let razorpayInstance = null;

export const getRazorpayInstance = () => {
  if (razorpayInstance) return razorpayInstance;

  const keyId = env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;
  const keySecret = env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET;

  if (keyId && keySecret) {
    razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }

  return razorpayInstance;
};

export default getRazorpayInstance;

