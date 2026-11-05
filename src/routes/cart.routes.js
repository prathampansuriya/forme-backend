import { Router } from 'express';
import cartController from '../controllers/cart.controller.js';
import { authenticate, optionalAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  addToCartSchema,
  updateCartItemSchema,
  removeCartItemSchema,
  applyCouponSchema,
  mergeCartSchema,
} from '../validators/cart.validator.js';

const router = Router();

// Cart inspection & operations (supports both authenticated customers and guest sessions)
router.get('/', optionalAuth, cartController.getCart);
router.post('/items', optionalAuth, validate(addToCartSchema), cartController.addItem);
router.patch('/items/:itemId', optionalAuth, validate(updateCartItemSchema), cartController.updateQuantity);
router.delete('/items/:itemId', optionalAuth, validate(removeCartItemSchema), cartController.removeItem);
router.delete('/', optionalAuth, cartController.clearCart);

// Promotional Coupon on Cart
router.post('/coupon', optionalAuth, validate(applyCouponSchema), cartController.applyCoupon);
router.delete('/coupon', optionalAuth, cartController.removeCoupon);

// Live stock validation probe
router.get('/validate', optionalAuth, cartController.validateStock);

// Guest Cart Merge (Authenticated Customer)
router.post('/merge', authenticate, validate(mergeCartSchema), cartController.mergeCart);

export default router;

