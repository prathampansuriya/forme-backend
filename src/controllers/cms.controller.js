import asyncHandler from '../utils/asyncHandler.js';
import apiResponse from '../utils/apiResponse.js';
import cmsService from '../services/cms.service.js';
import adminSettingService from '../services/adminSetting.service.js';
import emailService from '../services/email.service.js';
import prisma from '../config/prisma.config.js';

class CMSController {
  // ==========================================
  // 1. BANNERS
  // ==========================================

  listBannersPublic = asyncHandler(async (req, res) => {
    const banners = await cmsService.listBannersPublic({ type: req.query.type });
    return apiResponse.success(res, {
      message: 'Published banners retrieved successfully.',
      data: banners,
    });
  });

  listBannersAdmin = asyncHandler(async (req, res) => {
    const result = await cmsService.listBannersAdmin(req.query);
    return apiResponse.paginated(res, {
      message: 'Admin banners retrieved successfully.',
      data: result.banners,
      page: result.pagination.page,
      limit: result.pagination.limit,
      total: result.pagination.total,
      totalPages: result.pagination.totalPages,
    });
  });

  getBannerById = asyncHandler(async (req, res) => {
    const banner = await cmsService.getBannerById(req.params.id);
    return apiResponse.success(res, {
      message: 'Banner details retrieved.',
      data: banner,
    });
  });

  createBanner = asyncHandler(async (req, res) => {
    const banner = await cmsService.createBanner(req.body, req.user.id, req);
    return apiResponse.created(res, {
      message: 'Banner created successfully.',
      data: banner,
    });
  });

  updateBanner = asyncHandler(async (req, res) => {
    const banner = await cmsService.updateBanner(req.params.id, req.body, req.user.id, req);
    return apiResponse.success(res, {
      message: 'Banner updated successfully.',
      data: banner,
    });
  });

  deleteBanner = asyncHandler(async (req, res) => {
    const result = await cmsService.deleteBanner(req.params.id, req.user.id, req);
    return apiResponse.success(res, {
      message: result.message,
      data: result,
    });
  });

  reorderBanners = asyncHandler(async (req, res) => {
    const result = await cmsService.reorderBanners(req.body.items, req.user.id, req);
    return apiResponse.success(res, {
      message: result.message,
      data: result,
    });
  });

  // ==========================================
  // 2. ANNOUNCEMENTS
  // ==========================================

  listAnnouncementsPublic = asyncHandler(async (req, res) => {
    const announcements = await cmsService.listAnnouncementsPublic();
    return apiResponse.success(res, {
      message: 'Published announcements retrieved successfully.',
      data: announcements,
    });
  });

  listAnnouncementsAdmin = asyncHandler(async (req, res) => {
    const announcements = await cmsService.listAnnouncementsAdmin();
    return apiResponse.success(res, {
      message: 'Admin announcements retrieved successfully.',
      data: announcements,
    });
  });

  createAnnouncement = asyncHandler(async (req, res) => {
    const announcement = await cmsService.createAnnouncement(req.body, req.user.id, req);
    return apiResponse.created(res, {
      message: 'Announcement strip created successfully.',
      data: announcement,
    });
  });

  updateAnnouncement = asyncHandler(async (req, res) => {
    const announcement = await cmsService.updateAnnouncement(req.params.id, req.body, req.user.id, req);
    return apiResponse.success(res, {
      message: 'Announcement strip updated successfully.',
      data: announcement,
    });
  });

  deleteAnnouncement = asyncHandler(async (req, res) => {
    const result = await cmsService.deleteAnnouncement(req.params.id, req.user.id, req);
    return apiResponse.success(res, {
      message: result.message,
      data: result,
    });
  });

  // ==========================================
  // 3. HOMEPAGE SECTIONS
  // ==========================================

  listSectionsPublic = asyncHandler(async (req, res) => {
    const sections = await cmsService.listSectionsPublic();
    return apiResponse.success(res, {
      message: 'Homepage layout sections retrieved successfully.',
      data: sections,
    });
  });

  listSectionsAdmin = asyncHandler(async (req, res) => {
    const sections = await cmsService.listSectionsAdmin();
    return apiResponse.success(res, {
      message: 'Admin homepage layout sections retrieved successfully.',
      data: sections,
    });
  });

  createSection = asyncHandler(async (req, res) => {
    const section = await cmsService.createSection(req.body, req.user.id, req);
    return apiResponse.created(res, {
      message: 'Homepage section created successfully.',
      data: section,
    });
  });

  updateSection = asyncHandler(async (req, res) => {
    const section = await cmsService.updateSection(req.params.id, req.body, req.user.id, req);
    return apiResponse.success(res, {
      message: 'Homepage section updated successfully.',
      data: section,
    });
  });

  deleteSection = asyncHandler(async (req, res) => {
    const result = await cmsService.deleteSection(req.params.id, req.user.id, req);
    return apiResponse.success(res, {
      message: result.message,
      data: result,
    });
  });

  reorderSections = asyncHandler(async (req, res) => {
    const result = await cmsService.reorderSections(req.body.items, req.user.id, req);
    return apiResponse.success(res, {
      message: result.message,
      data: result,
    });
  });

  // ==========================================
  // 4. NAVIGATION MENUS & MEGA MENU
  // ==========================================

  listMenusAdmin = asyncHandler(async (req, res) => {
    const menus = await cmsService.listMenusAdmin();
    return apiResponse.success(res, {
      message: 'Navigation menus retrieved successfully.',
      data: menus,
    });
  });

  getMenuBySlugPublic = asyncHandler(async (req, res) => {
    const menu = await cmsService.getMenuBySlugPublic(req.params.slug);
    return apiResponse.success(res, {
      message: 'Navigation menu retrieved successfully.',
      data: menu,
    });
  });

  createMenu = asyncHandler(async (req, res) => {
    const menu = await cmsService.createMenu(req.body, req.user.id, req);
    return apiResponse.created(res, {
      message: 'Navigation menu created successfully.',
      data: menu,
    });
  });

  updateMenu = asyncHandler(async (req, res) => {
    const menu = await cmsService.updateMenu(req.params.id, req.body, req.user.id, req);
    return apiResponse.success(res, {
      message: 'Navigation menu updated successfully.',
      data: menu,
    });
  });

  deleteMenu = asyncHandler(async (req, res) => {
    const result = await cmsService.deleteMenu(req.params.id, req.user.id, req);
    return apiResponse.success(res, {
      message: result.message,
      data: result,
    });
  });

  addMenuItem = asyncHandler(async (req, res) => {
    const item = await cmsService.addMenuItem(req.params.menuId, req.body, req.user.id, req);
    return apiResponse.created(res, {
      message: 'Menu item added successfully.',
      data: item,
    });
  });

  updateMenuItem = asyncHandler(async (req, res) => {
    const item = await cmsService.updateMenuItem(req.params.itemId, req.body, req.user.id, req);
    return apiResponse.success(res, {
      message: 'Menu item updated successfully.',
      data: item,
    });
  });

  deleteMenuItem = asyncHandler(async (req, res) => {
    const result = await cmsService.deleteMenuItem(req.params.itemId, req.user.id, req);
    return apiResponse.success(res, {
      message: result.message,
      data: result,
    });
  });

  // ==========================================
  // 5. FOOTER SECTIONS
  // ==========================================

  listFooterSectionsPublic = asyncHandler(async (req, res) => {
    const sections = await cmsService.listFooterSectionsPublic();
    return apiResponse.success(res, {
      message: 'Footer sections retrieved successfully.',
      data: sections,
    });
  });

  listFooterSectionsAdmin = asyncHandler(async (req, res) => {
    const sections = await cmsService.listFooterSectionsAdmin();
    return apiResponse.success(res, {
      message: 'Admin footer sections retrieved successfully.',
      data: sections,
    });
  });

  createFooterSection = asyncHandler(async (req, res) => {
    const section = await cmsService.createFooterSection(req.body, req.user.id, req);
    return apiResponse.created(res, {
      message: 'Footer section created successfully.',
      data: section,
    });
  });

  updateFooterSection = asyncHandler(async (req, res) => {
    const section = await cmsService.updateFooterSection(req.params.id, req.body, req.user.id, req);
    return apiResponse.success(res, {
      message: 'Footer section updated successfully.',
      data: section,
    });
  });

  deleteFooterSection = asyncHandler(async (req, res) => {
    const result = await cmsService.deleteFooterSection(req.params.id, req.user.id, req);
    return apiResponse.success(res, {
      message: result.message,
      data: result,
    });
  });

  addFooterMenuItem = asyncHandler(async (req, res) => {
    const item = await cmsService.addFooterMenuItem(req.params.sectionId, req.body, req.user.id, req);
    return apiResponse.created(res, {
      message: 'Footer item added successfully.',
      data: item,
    });
  });

  updateFooterMenuItem = asyncHandler(async (req, res) => {
    const item = await cmsService.updateFooterMenuItem(req.params.itemId, req.body, req.user.id, req);
    return apiResponse.success(res, {
      message: 'Footer item updated successfully.',
      data: item,
    });
  });

  deleteFooterMenuItem = asyncHandler(async (req, res) => {
    const result = await cmsService.deleteFooterMenuItem(req.params.itemId, req.user.id, req);
    return apiResponse.success(res, {
      message: result.message,
      data: result,
    });
  });

  // ==========================================
  // 6. EDITORIAL CONTENT (Journal, Lookbook, Atelier Story)
  // ==========================================

  listEditorialsPublic = asyncHandler(async (req, res) => {
    const result = await cmsService.listEditorialsPublic(req.query);
    return apiResponse.paginated(res, {
      message: 'Editorial content retrieved successfully.',
      data: result.editorials,
      page: result.pagination.page,
      limit: result.pagination.limit,
      total: result.pagination.total,
      totalPages: result.pagination.totalPages,
    });
  });

  getEditorialBySlugPublic = asyncHandler(async (req, res) => {
    const article = await cmsService.getEditorialBySlugPublic(req.params.slug);
    return apiResponse.success(res, {
      message: 'Editorial article retrieved successfully.',
      data: article,
    });
  });

  listEditorialsAdmin = asyncHandler(async (req, res) => {
    const result = await cmsService.listEditorialsAdmin(req.query);
    return apiResponse.paginated(res, {
      message: 'Admin editorial articles retrieved successfully.',
      data: result.editorials,
      page: result.pagination.page,
      limit: result.pagination.limit,
      total: result.pagination.total,
      totalPages: result.pagination.totalPages,
    });
  });

  getEditorialByIdAdmin = asyncHandler(async (req, res) => {
    const article = await cmsService.getEditorialByIdAdmin(req.params.id);
    return apiResponse.success(res, {
      message: 'Editorial article details retrieved.',
      data: article,
    });
  });

  createEditorial = asyncHandler(async (req, res) => {
    const article = await cmsService.createEditorial(req.body, req.user.id, req);
    return apiResponse.created(res, {
      message: 'Editorial content created successfully.',
      data: article,
    });
  });

  updateEditorial = asyncHandler(async (req, res) => {
    const article = await cmsService.updateEditorial(req.params.id, req.body, req.user.id, req);
    return apiResponse.success(res, {
      message: 'Editorial content updated successfully.',
      data: article,
    });
  });

  deleteEditorial = asyncHandler(async (req, res) => {
    const result = await cmsService.deleteEditorial(req.params.id, req.user.id, req);
    return apiResponse.success(res, {
      message: result.message,
      data: result,
    });
  });

  // ==========================================
  // 7. SEO SETTINGS
  // ==========================================

  listSEOSettingsAdmin = asyncHandler(async (req, res) => {
    const settings = await cmsService.listSEOSettingsAdmin();
    return apiResponse.success(res, {
      message: 'SEO settings retrieved successfully.',
      data: settings,
    });
  });

  getSEOSettingByPageKey = asyncHandler(async (req, res) => {
    const setting = await cmsService.getSEOSettingByPageKey(req.params.pageKey);
    return apiResponse.success(res, {
      message: 'Page SEO setting retrieved successfully.',
      data: setting,
    });
  });

  upsertSEOSetting = asyncHandler(async (req, res) => {
    const setting = await cmsService.upsertSEOSetting(req.body, req.user.id, req);
    return apiResponse.success(res, {
      message: 'SEO configuration saved successfully.',
      data: setting,
    });
  });

  deleteSEOSetting = asyncHandler(async (req, res) => {
    const result = await cmsService.deleteSEOSetting(req.params.id, req.user.id, req);
    return apiResponse.success(res, {
      message: result.message,
      data: result,
    });
  });

  // ==========================================
  // 8. NEWSLETTER SUBSCRIBERS
  // ==========================================

  subscribeNewsletter = asyncHandler(async (req, res) => {
    const subscription = await cmsService.subscribeNewsletter(req.body);
    return apiResponse.created(res, {
      message: 'Thank you for subscribing to the FORME Journal & Private Previews.',
      data: { email: subscription.email, isActive: subscription.isActive },
    });
  });

  unsubscribeNewsletter = asyncHandler(async (req, res) => {
    const result = await cmsService.unsubscribeNewsletter(req.body.email);
    return apiResponse.success(res, {
      message: 'You have been successfully unsubscribed from FORME communications.',
      data: { email: result.email, isActive: result.isActive },
    });
  });

  listSubscribersAdmin = asyncHandler(async (req, res) => {
    const result = await cmsService.listSubscribersAdmin(req.query);
    return apiResponse.paginated(res, {
      message: 'Newsletter subscribers retrieved successfully.',
      data: result.subscribers,
      page: result.pagination.page,
      limit: result.pagination.limit,
      total: result.pagination.total,
      totalPages: result.pagination.totalPages,
    });
  });

  toggleSubscriberStatus = asyncHandler(async (req, res) => {
    const subscriber = await cmsService.toggleSubscriberStatus(
      req.params.id,
      req.body.isActive,
      req.user.id,
      req
    );
    return apiResponse.success(res, {
      message: 'Subscriber status updated successfully.',
      data: subscriber,
    });
  });

  sendCampaign = asyncHandler(async (req, res) => {
    const { title, heading, description, ctaText, ctaUrl, heroImage } = req.body;
    const subscribers = await prisma.newsletterSubscriber.findMany({
      where: { isActive: true },
    });

    let sentCount = 0;
    for (const sub of subscribers) {
      emailService
        .sendPromotionalCampaign(sub.email, {
          campaignTitle: title || 'FORME Private Preview',
          heroImage,
          description: description || 'Discover the latest haute couture pieces crafted in our atelier.',
          ctaText: ctaText || 'Explore Capsule',
          ctaUrl: ctaUrl || 'http://localhost:5173/shop',
        })
        .catch((err) => console.warn(`Campaign email dispatch failed to ${sub.email}:`, err.message));
      sentCount++;
    }

    return apiResponse.success(res, {
      message: `Promotional campaign "${title || 'Atelier Drop'}" dispatched to ${sentCount} active subscribers.`,
      data: {
        dispatchedCount: sentCount,
        title,
        timestamp: new Date().toISOString(),
      },
    });
  });

  // ==========================================
  // 9. BRAND SETTINGS (PUBLIC ACCESS)
  // ==========================================

  getBrandSettingsPublic = asyncHandler(async (req, res) => {
    const brand = await adminSettingService.getBrandSettings();
    return apiResponse.success(res, {
      message: 'Brand configuration retrieved successfully.',
      data: brand,
    });
  });
}

export const cmsController = new CMSController();
export default cmsController;

