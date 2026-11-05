import { Router } from 'express';
import cmsController from '../controllers/cms.controller.js';
import validate from '../middleware/validate.middleware.js';
import {
  newsletterSubscribeSchema,
  newsletterUnsubscribeSchema,
} from '../validators/cms.validator.js';

const router = Router();

// ==========================================
// Public Customer Storefront CMS Endpoints
// ==========================================

// 1. Promotional Banners
router.get('/banners', cmsController.listBannersPublic);

// 2. Announcement Strip
router.get('/announcements', cmsController.listAnnouncementsPublic);

// 3. Homepage Layout Sections
router.get('/homepage-sections', cmsController.listSectionsPublic);

// 4. Navigation Menus
router.get('/navigation/:slug', cmsController.getMenuBySlugPublic);

// 5. Footer Navigation
router.get('/footer', cmsController.listFooterSectionsPublic);

// 6. Editorial Stories, Journal & Lookbooks
router.get('/editorials', cmsController.listEditorialsPublic);
router.get('/editorials/:slug', cmsController.getEditorialBySlugPublic);

// 7. SEO Meta Configuration
router.get('/seo/:pageKey', cmsController.getSEOSettingByPageKey);

// 8. Brand Information
router.get('/brand', cmsController.getBrandSettingsPublic);

// 9. Newsletter Subscriptions
router.post('/newsletter/subscribe', validate(newsletterSubscribeSchema), cmsController.subscribeNewsletter);
router.post('/newsletter/unsubscribe', validate(newsletterUnsubscribeSchema), cmsController.unsubscribeNewsletter);

export default router;

