import { Router } from 'express';
import orderController from '../controllers/order.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { verifyPaymentSchema, paymentFailureSchema } from '../validators/order.validator.js';

const router = Router();

// Raw HMAC Webhook endpoint
router.post('/webhook', orderController.handleRazorpayWebhook);

// Payment callback verification endpoints
router.post('/verify', authenticate, validate(verifyPaymentSchema), orderController.verifyPayment);
router.post('/failure', authenticate, validate(paymentFailureSchema), orderController.handlePaymentFailure);

export default router;

