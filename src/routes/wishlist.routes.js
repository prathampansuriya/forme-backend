import { Router } from 'express';
import wishlistController from '../controllers/wishlist.controller.js';
import { authenticate, optionalAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  addToWishlistSchema,
  removeFromWishlistSchema,
  moveToCartSchema,
} from '../validators/wishlist.validator.js';

const router = Router();

// Wishlist management (Authenticated Customer)
router.get('/', authenticate, wishlistController.getWishlist);
router.post('/items', authenticate, validate(addToWishlistSchema), wishlistController.addItem);
router.delete('/items/:productId', authenticate, validate(removeFromWishlistSchema), wishlistController.removeItem);
router.post('/move-to-cart', authenticate, validate(moveToCartSchema), wishlistController.moveToCart);

// Wishlist status probe for PDP and Product Cards (Optional Auth)
router.get('/check/:productId', optionalAuth, wishlistController.checkStatus);

export default router;

