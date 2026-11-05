import { Router } from 'express';
import adminController from '../controllers/admin.controller.js';
import cmsController from '../controllers/cms.controller.js';
import mediaController from '../controllers/media.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/role.middleware.js';
import validate from '../middleware/validate.middleware.js';
import { uploadMediaMiddleware } from '../middleware/upload.middleware.js';

import {
  queryCustomersSchema,
  updateCustomerStatusSchema,
  customerIdParamSchema,
  analyticsQuerySchema,
  queryAuditLogsSchema,
  storeSettingSchema,
  taxSettingSchema,
  updateTaxSettingSchema,
  shippingSettingSchema,
  updateShippingSettingSchema,
  currencySettingSchema,
  updateCurrencySettingSchema,
  brandSettingSchema,
  queryPaymentsSchema,
  moderateReviewAdminSchema,
} from '../validators/admin.validator.js';

import {
  bannerSchema,
  updateBannerSchema,
  announcementSchema,
  updateAnnouncementSchema,
  homePageSectionSchema,
  updateHomePageSectionSchema,
  navigationMenuSchema,
  updateNavigationMenuSchema,
  navigationMenuItemSchema,
  updateNavigationMenuItemSchema,
  footerSectionSchema,
  updateFooterSectionSchema,
  footerMenuItemSchema,
  updateFooterMenuItemSchema,
  editorialSchema,
  updateEditorialSchema,
  seoSettingSchema,
  querySubscribersSchema,
} from '../validators/cms.validator.js';

const router = Router();

// ==========================================
// Strict Administrative Access Control
// ==========================================
router.use(authenticate, requireAdmin);

// Media Assets Upload
router.post('/media/upload', uploadMediaMiddleware.single('file'), mediaController.uploadMediaAsset);

// ==========================================
// 1. ANALYTICS & BUSINESS INTELLIGENCE
// ==========================================
router.get('/analytics/overview', validate(analyticsQuerySchema), adminController.getOverviewKPIs);
router.get('/analytics/sales', validate(analyticsQuerySchema), adminController.getSalesTrends);
router.get('/analytics/payment-methods', adminController.getPaymentMethodBreakdown);
router.get('/analytics/best-sellers', validate(analyticsQuerySchema), adminController.getBestSellingProducts);
router.get('/analytics/categories', adminController.getCategoryPerformance);
router.get('/analytics/collections', adminController.getCollectionPerformance);
router.get('/analytics/inventory-valuation', adminController.getInventoryValuation);
router.get('/analytics/conversion-funnel', adminController.getConversionFunnel);
router.get('/analytics/promotions', adminController.getPromotionPerformance);
router.get('/analytics/coupons', adminController.getCouponPerformance);

// ==========================================
// 2. CUSTOMER MANAGEMENT (CRM)
// ==========================================
router.get('/customers', validate(queryCustomersSchema), adminController.listCustomers);
router.get('/customers/:id', validate(customerIdParamSchema), adminController.getCustomerDetails);
router.patch('/customers/:id/status', validate(updateCustomerStatusSchema), adminController.updateCustomerStatus);
router.get('/customers/:id/orders', validate(customerIdParamSchema), adminController.getCustomerOrderHistory);

// ==========================================
// 3. SETTINGS & CONFIGURATION
// ==========================================
router.get('/settings/store', adminController.listStoreSettings);
router.get('/settings/store/:key', adminController.getStoreSettingByKey);
router.post('/settings/store', validate(storeSettingSchema), adminController.upsertStoreSetting);
router.put('/settings/store', validate(storeSettingSchema), adminController.upsertStoreSetting);

router.get('/settings/tax', adminController.listTaxSettings);
router.post('/settings/tax', validate(taxSettingSchema), adminController.createTaxSetting);
router.put('/settings/tax/:id', validate(updateTaxSettingSchema), adminController.updateTaxSetting);
router.delete('/settings/tax/:id', adminController.deleteTaxSetting);

router.get('/settings/shipping', adminController.listShippingSettings);
router.post('/settings/shipping', validate(shippingSettingSchema), adminController.createShippingSetting);
router.put('/settings/shipping/:id', validate(updateShippingSettingSchema), adminController.updateShippingSetting);
router.delete('/settings/shipping/:id', adminController.deleteShippingSetting);

router.get('/settings/currencies', adminController.listCurrencySettings);
router.post('/settings/currencies', validate(currencySettingSchema), adminController.createCurrencySetting);
router.put('/settings/currencies/:id', validate(updateCurrencySettingSchema), adminController.updateCurrencySetting);
router.delete('/settings/currencies/:id', adminController.deleteCurrencySetting);

router.get('/settings/brand', adminController.getBrandSettings);
router.put('/settings/brand', validate(brandSettingSchema), adminController.updateBrandSettings);

router.get('/settings/homepage-layout', adminController.getHomepageLayout);
router.put('/settings/homepage-layout', adminController.updateHomepageLayout);

router.get('/settings/probes/payment-gateway', adminController.probePaymentGateway);
router.get('/settings/probes/email-transport', adminController.probeEmailTransport);

// ==========================================
// 4. COMMERCE (PAYMENTS, REFUNDS, REVIEWS)
// ==========================================
router.get('/commerce/payments', validate(queryPaymentsSchema), adminController.listPayments);
router.get('/commerce/payments/:id', adminController.getPaymentDetails);
router.get('/commerce/refunds', adminController.listRefunds);

router.patch('/commerce/reviews/:id/moderation', validate(moderateReviewAdminSchema), adminController.moderateReview);
router.delete('/commerce/reviews/:id', adminController.deleteReview);

// ==========================================
// 5. AUDIT LOGS
// ==========================================
router.get('/audit-logs', validate(queryAuditLogsSchema), adminController.listAuditLogs);
router.get('/audit-logs/:id', adminController.getAuditLogById);

// ==========================================
// 6. CONTENT MANAGEMENT (CMS) ADMIN
// ==========================================
// Banners
router.get('/cms/banners', cmsController.listBannersAdmin);
router.get('/cms/banners/:id', cmsController.getBannerById);
router.post('/cms/banners', validate(bannerSchema), cmsController.createBanner);
router.put('/cms/banners/:id', validate(updateBannerSchema), cmsController.updateBanner);
router.delete('/cms/banners/:id', cmsController.deleteBanner);
router.post('/cms/banners/reorder', cmsController.reorderBanners);

// Announcements
router.get('/cms/announcements', cmsController.listAnnouncementsAdmin);
router.post('/cms/announcements', validate(announcementSchema), cmsController.createAnnouncement);
router.put('/cms/announcements/:id', validate(updateAnnouncementSchema), cmsController.updateAnnouncement);
router.delete('/cms/announcements/:id', cmsController.deleteAnnouncement);

// Homepage Sections
router.get('/cms/sections', cmsController.listSectionsAdmin);
router.post('/cms/sections', validate(homePageSectionSchema), cmsController.createSection);
router.put('/cms/sections/:id', validate(updateHomePageSectionSchema), cmsController.updateSection);
router.delete('/cms/sections/:id', cmsController.deleteSection);
router.post('/cms/sections/reorder', cmsController.reorderSections);

// Navigation Menus
router.get('/cms/menus', cmsController.listMenusAdmin);
router.post('/cms/menus', validate(navigationMenuSchema), cmsController.createMenu);
router.put('/cms/menus/:id', validate(updateNavigationMenuSchema), cmsController.updateMenu);
router.delete('/cms/menus/:id', cmsController.deleteMenu);
router.post('/cms/menus/:menuId/items', validate(navigationMenuItemSchema), cmsController.addMenuItem);
router.put('/cms/menus/items/:itemId', validate(updateNavigationMenuItemSchema), cmsController.updateMenuItem);
router.delete('/cms/menus/items/:itemId', cmsController.deleteMenuItem);

// Footer Sections
router.get('/cms/footers', cmsController.listFooterSectionsAdmin);
router.post('/cms/footers', validate(footerSectionSchema), cmsController.createFooterSection);
router.put('/cms/footers/:id', validate(updateFooterSectionSchema), cmsController.updateFooterSection);
router.delete('/cms/footers/:id', cmsController.deleteFooterSection);
router.post('/cms/footers/:sectionId/items', validate(footerMenuItemSchema), cmsController.addFooterMenuItem);
router.put('/cms/footers/items/:itemId', validate(updateFooterMenuItemSchema), cmsController.updateFooterMenuItem);
router.delete('/cms/footers/items/:itemId', cmsController.deleteFooterMenuItem);

// Editorial Content
router.get('/cms/editorials', cmsController.listEditorialsAdmin);
router.get('/cms/editorials/:id', cmsController.getEditorialByIdAdmin);
router.post('/cms/editorials', validate(editorialSchema), cmsController.createEditorial);
router.put('/cms/editorials/:id', validate(updateEditorialSchema), cmsController.updateEditorial);
router.delete('/cms/editorials/:id', cmsController.deleteEditorial);

// SEO Configuration
router.get('/cms/seo', cmsController.listSEOSettingsAdmin);
router.post('/cms/seo', validate(seoSettingSchema), cmsController.upsertSEOSetting);
router.put('/cms/seo', validate(seoSettingSchema), cmsController.upsertSEOSetting);
router.delete('/cms/seo/:id', cmsController.deleteSEOSetting);

// Newsletter Subscribers & Campaigns
router.get('/cms/subscribers', validate(querySubscribersSchema), cmsController.listSubscribersAdmin);
router.patch('/cms/subscribers/:id/toggle', cmsController.toggleSubscriberStatus);
router.post('/cms/campaigns/send', cmsController.sendCampaign);

export default router;

