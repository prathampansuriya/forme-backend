import { Router } from 'express';
import reviewController from '../controllers/review.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/role.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  createReviewSchema,
  updateReviewSchema,
  reviewIdParamSchema,
  productIdParamSchema,
  moderateReviewSchema,
} from '../validators/review.validator.js';

const router = Router();

// Public review reading & statistics
router.get('/product/:productId', validate(productIdParamSchema), reviewController.getProductReviews);
router.get('/product/:productId/stats', reviewController.getProductReviewStats);

// Customer Review Management (Authenticated Customer)
router.get('/me', authenticate, reviewController.getMyReviews);
router.get('/my-reviews', authenticate, reviewController.getMyReviews);
router.get('/eligibility/:productId', authenticate, reviewController.checkEligibility);
router.post('/', authenticate, validate(createReviewSchema), reviewController.submitReview);
router.patch('/:id', authenticate, validate(updateReviewSchema), reviewController.updateReview);
router.delete('/:id', authenticate, validate(reviewIdParamSchema), reviewController.deleteReview);

// Admin Moderation (Restricted to Admin)
router.get('/admin', authenticate, requireAdmin, reviewController.listReviewsAdmin);
router.get('/admin/summary', authenticate, requireAdmin, reviewController.getAdminReviewSummary);
router.patch('/admin/:id/moderation', authenticate, requireAdmin, validate(moderateReviewSchema), reviewController.moderateReview);

export default router;

