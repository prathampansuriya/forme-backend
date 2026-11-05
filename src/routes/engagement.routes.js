import { Router } from 'express';
import engagementController from '../controllers/engagement.controller.js';
import { optionalAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  trackViewSchema,
  trackSearchSchema,
} from '../validators/engagement.validator.js';

const router = Router();

router.post('/view', optionalAuth, validate(trackViewSchema), engagementController.trackView);
router.post('/search', validate(trackSearchSchema), engagementController.trackSearch);
router.get('/recently-viewed', optionalAuth, engagementController.getRecentlyViewed);
router.get('/trending', engagementController.getTrendingMetrics);

export default router;

