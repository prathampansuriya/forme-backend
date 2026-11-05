import { Router } from 'express';
import pricingController from '../controllers/pricing.controller.js';
import { optionalAuth } from '../middleware/auth.middleware.js';
import validate from '../middleware/validate.middleware.js';
import { calculatePricingSchema } from '../validators/pricing.validator.js';

const router = Router();

// Server-Authoritative Pricing Calculation for Bag & Checkout
router.post('/calculate', optionalAuth, validate(calculatePricingSchema), pricingController.calculatePricing);

export default router;

