import prisma from '../config/prisma.config.js';
import { ApplicationError } from '../utils/ApplicationError.js';
import auditService from './audit.service.js';

export class CMSService {
  // ==========================================
  // 1. BANNERS
  // ==========================================

  async listBannersAdmin({ type, isPublished, page = 1, limit = 50 } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * take;

    const where = {};
    if (type) where.type = type;
    if (isPublished !== undefined) where.isPublished = isPublished === 'true' || isPublished === true;

    const [banners, total] = await Promise.all([
      prisma.banner.findMany({
        where,
        skip,
        take,
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
      }),
      prisma.banner.count({ where }),
    ]);

    return {
      banners,
      pagination: {
        page: pageNum,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async listBannersPublic({ type } = {}) {
    const now = new Date();
    const where = {
      isPublished: true,
      OR: [
        { scheduleStart: null, scheduleEnd: null },
        { scheduleStart: { lte: now }, scheduleEnd: null },
        { scheduleStart: null, scheduleEnd: { gte: now } },
        { scheduleStart: { lte: now }, scheduleEnd: { gte: now } },
      ],
    };

    if (type) where.type = type;

    return prisma.banner.findMany({
      where,
      orderBy: { displayOrder: 'asc' },
    });
  }

  async getBannerById(id) {
    const banner = await prisma.banner.findUnique({ where: { id } });
    if (!banner) throw ApplicationError.notFound(`Banner with ID '${id}' not found`);
    return banner;
  }

  async createBanner(data, adminUserId, req) {
    const banner = await prisma.banner.create({
      data: {
        title: data.title,
        subtitle: data.subtitle || null,
        type: data.type || 'HOME',
        desktopMediaUrl: data.desktopMediaUrl,
        mobileMediaUrl: data.mobileMediaUrl,
        desktopMediaType: data.desktopMediaType || 'IMAGE',
        mobileMediaType: data.mobileMediaType || 'IMAGE',
        altText: data.altText || null,
        ctaLabel: data.ctaLabel || null,
        ctaLink: data.ctaLink || null,
        scheduleStart: data.scheduleStart ? new Date(data.scheduleStart) : null,
        scheduleEnd: data.scheduleEnd ? new Date(data.scheduleEnd) : null,
        isPublished: Boolean(data.isPublished),
        displayOrder: parseInt(data.displayOrder, 10) || 0,
      },
    });

    await auditService.recordAdminAction({
      adminUserId,
      action: 'BANNER_CREATED',
      entityType: 'Banner',
      entityId: banner.id,
      details: { title: banner.title, type: banner.type },
      req,
    });

    return banner;
  }

  async updateBanner(id, data, adminUserId, req) {
    await this.getBannerById(id);

    const updateData = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.subtitle !== undefined) updateData.subtitle = data.subtitle;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.desktopMediaUrl !== undefined) updateData.desktopMediaUrl = data.desktopMediaUrl;
    if (data.mobileMediaUrl !== undefined) updateData.mobileMediaUrl = data.mobileMediaUrl;
    if (data.desktopMediaType !== undefined) updateData.desktopMediaType = data.desktopMediaType;
    if (data.mobileMediaType !== undefined) updateData.mobileMediaType = data.mobileMediaType;
    if (data.altText !== undefined) updateData.altText = data.altText;
    if (data.ctaLabel !== undefined) updateData.ctaLabel = data.ctaLabel;
    if (data.ctaLink !== undefined) updateData.ctaLink = data.ctaLink;
    if (data.scheduleStart !== undefined) updateData.scheduleStart = data.scheduleStart ? new Date(data.scheduleStart) : null;
    if (data.scheduleEnd !== undefined) updateData.scheduleEnd = data.scheduleEnd ? new Date(data.scheduleEnd) : null;
    if (data.isPublished !== undefined) updateData.isPublished = Boolean(data.isPublished);
    if (data.displayOrder !== undefined) updateData.displayOrder = parseInt(data.displayOrder, 10);

    const updated = await prisma.banner.update({
      where: { id },
      data: updateData,
    });

    await auditService.recordAdminAction({
      adminUserId,
      action: 'BANNER_UPDATED',
      entityType: 'Banner',
      entityId: id,
      details: updateData,
      req,
    });

    return updated;
  }

  async deleteBanner(id, adminUserId, req) {
    const existing = await this.getBannerById(id);
    await prisma.banner.delete({ where: { id } });

    await auditService.recordAdminAction({
      adminUserId,
      action: 'BANNER_DELETED',
      entityType: 'Banner',
      entityId: id,
      details: { title: existing.title },
      req,
    });

    return { message: 'Banner deleted successfully', id };
  }

  async reorderBanners(items, adminUserId, req) {
    if (!Array.isArray(items)) throw ApplicationError.badRequest('Items must be an array of { id, displayOrder }');

    await prisma.$transaction(
      items.map((item) =>
        prisma.banner.update({
          where: { id: item.id },
          data: { displayOrder: parseInt(item.displayOrder, 10) },
        })
      )
    );

    await auditService.recordAdminAction({
      adminUserId,
      action: 'BANNERS_REORDERED',
      entityType: 'Banner',
      details: { count: items.length },
      req,
    });

    return { message: 'Banners reordered successfully' };
  }

  // ==========================================
  // 2. ANNOUNCEMENTS
  // ==========================================

  async listAnnouncementsAdmin() {
    return prisma.announcement.findMany({
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async listAnnouncementsPublic() {
    const now = new Date();
    return prisma.announcement.findMany({
      where: {
        isPublished: true,
        OR: [
          { scheduleStart: null, scheduleEnd: null },
          { scheduleStart: { lte: now }, scheduleEnd: null },
          { scheduleStart: null, scheduleEnd: { gte: now } },
          { scheduleStart: { lte: now }, scheduleEnd: { gte: now } },
        ],
      },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async createAnnouncement(data, adminUserId, req) {
    const announcement = await prisma.announcement.create({
      data: {
        message: data.message,
        ctaLabel: data.ctaLabel || null,
        ctaLink: data.ctaLink || null,
        backgroundColor: data.backgroundColor || '#1C1917',
        textColor: data.textColor || '#FAF8F5',
        isPublished: Boolean(data.isPublished),
        scheduleStart: data.scheduleStart ? new Date(data.scheduleStart) : null,
        scheduleEnd: data.scheduleEnd ? new Date(data.scheduleEnd) : null,
        displayOrder: parseInt(data.displayOrder, 10) || 0,
      },
    });

    await auditService.recordAdminAction({
      adminUserId,
      action: 'ANNOUNCEMENT_CREATED',
      entityType: 'Announcement',
      entityId: announcement.id,
      details: { message: announcement.message },
      req,
    });

    return announcement;
  }

  async updateAnnouncement(id, data, adminUserId, req) {
    const existing = await prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw ApplicationError.notFound(`Announcement with ID '${id}' not found`);

    const updateData = {};
    if (data.message !== undefined) updateData.message = data.message;
    if (data.ctaLabel !== undefined) updateData.ctaLabel = data.ctaLabel;
    if (data.ctaLink !== undefined) updateData.ctaLink = data.ctaLink;
    if (data.backgroundColor !== undefined) updateData.backgroundColor = data.backgroundColor;
    if (data.textColor !== undefined) updateData.textColor = data.textColor;
    if (data.isPublished !== undefined) updateData.isPublished = Boolean(data.isPublished);
    if (data.scheduleStart !== undefined) updateData.scheduleStart = data.scheduleStart ? new Date(data.scheduleStart) : null;
    if (data.scheduleEnd !== undefined) updateData.scheduleEnd = data.scheduleEnd ? new Date(data.scheduleEnd) : null;
    if (data.displayOrder !== undefined) updateData.displayOrder = parseInt(data.displayOrder, 10);

    const updated = await prisma.announcement.update({
      where: { id },
      data: updateData,
    });

    await auditService.recordAdminAction({
      adminUserId,
      action: 'ANNOUNCEMENT_UPDATED',
      entityType: 'Announcement',
      entityId: id,
      details: updateData,
      req,
    });

    return updated;
  }

  async deleteAnnouncement(id, adminUserId, req) {
    const existing = await prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw ApplicationError.notFound(`Announcement with ID '${id}' not found`);

    await prisma.announcement.delete({ where: { id } });

    await auditService.recordAdminAction({
      adminUserId,
      action: 'ANNOUNCEMENT_DELETED',
      entityType: 'Announcement',
      entityId: id,
      details: { message: existing.message },
      req,
    });

    return { message: 'Announcement deleted successfully', id };
  }

  // ==========================================
  // 3. HOMEPAGE SECTIONS
  // ==========================================

  async listSectionsAdmin() {
    return prisma.homePageSection.findMany({
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async listSectionsPublic() {
    const now = new Date();
    const sections = await prisma.homePageSection.findMany({
      where: {
        isPublished: true,
        OR: [
          { scheduleStart: null, scheduleEnd: null },
          { scheduleStart: { lte: now }, scheduleEnd: null },
          { scheduleStart: null, scheduleEnd: { gte: now } },
          { scheduleStart: { lte: now }, scheduleEnd: { gte: now } },
        ],
      },
      orderBy: { displayOrder: 'asc' },
    });

    return sections;
  }

  async createSection(data, adminUserId, req) {
    const section = await prisma.homePageSection.create({
      data: {
        title: data.title,
        subtitle: data.subtitle || null,
        type: data.type,
        references: data.references || null,
        layoutConfig: data.layoutConfig || null,
        displayOrder: parseInt(data.displayOrder, 10) || 0,
        isPublished: Boolean(data.isPublished),
        scheduleStart: data.scheduleStart ? new Date(data.scheduleStart) : null,
        scheduleEnd: data.scheduleEnd ? new Date(data.scheduleEnd) : null,
      },
    });

    await auditService.recordAdminAction({
      adminUserId,
      action: 'HOMEPAGE_SECTION_CREATED',
      entityType: 'HomePageSection',
      entityId: section.id,
      details: { title: section.title, type: section.type },
      req,
    });

    return section;
  }

  async updateSection(id, data, adminUserId, req) {
    const existing = await prisma.homePageSection.findUnique({ where: { id } });
    if (!existing) throw ApplicationError.notFound(`HomePageSection with ID '${id}' not found`);

    const updateData = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.subtitle !== undefined) updateData.subtitle = data.subtitle;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.references !== undefined) updateData.references = data.references;
    if (data.layoutConfig !== undefined) updateData.layoutConfig = data.layoutConfig;
    if (data.displayOrder !== undefined) updateData.displayOrder = parseInt(data.displayOrder, 10);
    if (data.isPublished !== undefined) updateData.isPublished = Boolean(data.isPublished);
    if (data.scheduleStart !== undefined) updateData.scheduleStart = data.scheduleStart ? new Date(data.scheduleStart) : null;
    if (data.scheduleEnd !== undefined) updateData.scheduleEnd = data.scheduleEnd ? new Date(data.scheduleEnd) : null;

    const updated = await prisma.homePageSection.update({
      where: { id },
      data: updateData,
    });

    await auditService.recordAdminAction({
      adminUserId,
      action: 'HOMEPAGE_SECTION_UPDATED',
      entityType: 'HomePageSection',
      entityId: id,
      details: updateData,
      req,
    });

    return updated;
  }

  async deleteSection(id, adminUserId, req) {
    const existing = await prisma.homePageSection.findUnique({ where: { id } });
    if (!existing) throw ApplicationError.notFound(`HomePageSection with ID '${id}' not found`);

    await prisma.homePageSection.delete({ where: { id } });

    await auditService.recordAdminAction({
      adminUserId,
      action: 'HOMEPAGE_SECTION_DELETED',
      entityType: 'HomePageSection',
      entityId: id,
      details: { title: existing.title },
      req,
    });

    return { message: 'Homepage section deleted successfully', id };
  }

  async reorderSections(items, adminUserId, req) {
    if (!Array.isArray(items)) throw ApplicationError.badRequest('Items must be an array of { id, displayOrder }');

    await prisma.$transaction(
      items.map((item) =>
        prisma.homePageSection.update({
          where: { id: item.id },
          data: { displayOrder: parseInt(item.displayOrder, 10) },
        })
      )
    );

    await auditService.recordAdminAction({
      adminUserId,
      action: 'HOMEPAGE_SECTIONS_REORDERED',
      entityType: 'HomePageSection',
      details: { count: items.length },
      req,
    });

    return { message: 'Homepage sections reordered successfully' };
  }

  // ==========================================
  // 4. NAVIGATION MENUS & MEGA MENU
  // ==========================================

  async listMenusAdmin() {
    return prisma.navigationMenu.findMany({
      include: {
        items: {
          orderBy: { displayOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getMenuBySlugPublic(slug) {
    let menu = await prisma.navigationMenu.findUnique({
      where: { slug },
      include: {
        items: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    // Check alternate header menu slugs if specific slug was not found
    if (!menu && (slug === 'main-navigation' || slug === 'main-header' || slug === 'header')) {
      const alternateSlugs = ['main-header', 'main-navigation', 'header'].filter((s) => s !== slug);
      menu = await prisma.navigationMenu.findFirst({
        where: { slug: { in: alternateSlugs }, isActive: true },
        include: {
          items: {
            orderBy: { displayOrder: 'asc' },
          },
        },
      });
    }

    if (!menu || !menu.isActive) {
      throw ApplicationError.notFound(`Navigation menu '${slug}' not found or inactive`);
    }

    // Build hierarchical tree (parent-child dropdowns)
    const itemMap = new Map();
    const rootItems = [];

    menu.items.forEach((item) => {
      itemMap.set(item.id, { ...item, children: [] });
    });

    menu.items.forEach((item) => {
      const node = itemMap.get(item.id);
      if (item.parentId && itemMap.has(item.parentId)) {
        itemMap.get(item.parentId).children.push(node);
      } else {
        rootItems.push(node);
      }
    });

    return {
      ...menu,
      items: rootItems,
    };
  }

  async createMenu(data, adminUserId, req) {
    const existing = await prisma.navigationMenu.findUnique({ where: { slug: data.slug } });
    if (existing) throw ApplicationError.conflict(`Navigation menu slug '${data.slug}' already exists`);

    const menu = await prisma.navigationMenu.create({
      data: {
        name: data.name,
        slug: data.slug,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      },
    });

    await auditService.recordAdminAction({
      adminUserId,
      action: 'NAV_MENU_CREATED',
      entityType: 'NavigationMenu',
      entityId: menu.id,
      details: { name: menu.name, slug: menu.slug },
      req,
    });

    return menu;
  }

  async updateMenu(id, data, adminUserId, req) {
    const existing = await prisma.navigationMenu.findUnique({ where: { id } });
    if (!existing) throw ApplicationError.notFound(`Navigation menu with ID '${id}' not found`);

    if (data.slug && data.slug !== existing.slug) {
      const slugClash = await prisma.navigationMenu.findUnique({ where: { slug: data.slug } });
      if (slugClash) throw ApplicationError.conflict(`Navigation menu slug '${data.slug}' already exists`);
    }

    const updated = await prisma.navigationMenu.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.slug ? { slug: data.slug } : {}),
        ...(data.isActive !== undefined ? { isActive: Boolean(data.isActive) } : {}),
      },
    });

    await auditService.recordAdminAction({
      adminUserId,
      action: 'NAV_MENU_UPDATED',
      entityType: 'NavigationMenu',
      entityId: id,
      details: data,
      req,
    });

    return updated;
  }

  async deleteMenu(id, adminUserId, req) {
    const existing = await prisma.navigationMenu.findUnique({ where: { id } });
    if (!existing) throw ApplicationError.notFound(`Navigation menu with ID '${id}' not found`);

    await prisma.navigationMenu.delete({ where: { id } });

    await auditService.recordAdminAction({
      adminUserId,
      action: 'NAV_MENU_DELETED',
      entityType: 'NavigationMenu',
      entityId: id,
      details: { name: existing.name },
      req,
    });

    return { message: 'Navigation menu deleted successfully', id };
  }

  async addMenuItem(menuId, data, adminUserId, req) {
    const menu = await prisma.navigationMenu.findUnique({ where: { id: menuId } });
    if (!menu) throw ApplicationError.notFound(`Navigation menu '${menuId}' not found`);

    const item = await prisma.navigationMenuItem.create({
      data: {
        menuId,
        label: data.label,
        url: data.url,
        displayOrder: parseInt(data.displayOrder, 10) || 0,
        parentId: data.parentId || null,
        highlightBadge: data.highlightBadge || null,
      },
    });

    await auditService.recordAdminAction({
      adminUserId,
      action: 'NAV_ITEM_CREATED',
      entityType: 'NavigationMenuItem',
      entityId: item.id,
      details: { menuId, label: item.label, url: item.url },
      req,
    });

    return item;
  }

  async updateMenuItem(itemId, data, adminUserId, req) {
    const existing = await prisma.navigationMenuItem.findUnique({ where: { id: itemId } });
    if (!existing) throw ApplicationError.notFound(`Navigation menu item '${itemId}' not found`);

    const updated = await prisma.navigationMenuItem.update({
      where: { id: itemId },
      data: {
        ...(data.label ? { label: data.label } : {}),
        ...(data.url ? { url: data.url } : {}),
        ...(data.displayOrder !== undefined ? { displayOrder: parseInt(data.displayOrder, 10) } : {}),
        ...(data.parentId !== undefined ? { parentId: data.parentId || null } : {}),
        ...(data.highlightBadge !== undefined ? { highlightBadge: data.highlightBadge || null } : {}),
      },
    });

    await auditService.recordAdminAction({
      adminUserId,
      action: 'NAV_ITEM_UPDATED',
      entityType: 'NavigationMenuItem',
      entityId: itemId,
      details: data,
      req,
    });

    return updated;
  }

  async deleteMenuItem(itemId, adminUserId, req) {
    const existing = await prisma.navigationMenuItem.findUnique({ where: { id: itemId } });
    if (!existing) throw ApplicationError.notFound(`Navigation menu item '${itemId}' not found`);

    await prisma.navigationMenuItem.delete({ where: { id: itemId } });

    await auditService.recordAdminAction({
      adminUserId,
      action: 'NAV_ITEM_DELETED',
      entityType: 'NavigationMenuItem',
      entityId: itemId,
      details: { label: existing.label },
      req,
    });

    return { message: 'Menu item deleted successfully', id: itemId };
  }

  // ==========================================
  // 5. FOOTER SECTIONS
  // ==========================================

  async listFooterSectionsAdmin() {
    return prisma.footerSection.findMany({
      include: {
        items: {
          orderBy: { displayOrder: 'asc' },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async listFooterSectionsPublic() {
    return prisma.footerSection.findMany({
      where: { isActive: true },
      include: {
        items: {
          orderBy: { displayOrder: 'asc' },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async createFooterSection(data, adminUserId, req) {
    const section = await prisma.footerSection.create({
      data: {
        title: data.title,
        displayOrder: parseInt(data.displayOrder, 10) || 0,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      },
    });

    await auditService.recordAdminAction({
      adminUserId,
      action: 'FOOTER_SECTION_CREATED',
      entityType: 'FooterSection',
      entityId: section.id,
      details: { title: section.title },
      req,
    });

    return section;
  }

  async updateFooterSection(id, data, adminUserId, req) {
    const existing = await prisma.footerSection.findUnique({ where: { id } });
    if (!existing) throw ApplicationError.notFound(`Footer section with ID '${id}' not found`);

    const updated = await prisma.footerSection.update({
      where: { id },
      data: {
        ...(data.title ? { title: data.title } : {}),
        ...(data.displayOrder !== undefined ? { displayOrder: parseInt(data.displayOrder, 10) } : {}),
        ...(data.isActive !== undefined ? { isActive: Boolean(data.isActive) } : {}),
      },
    });

    await auditService.recordAdminAction({
      adminUserId,
      action: 'FOOTER_SECTION_UPDATED',
      entityType: 'FooterSection',
      entityId: id,
      details: data,
      req,
    });

    return updated;
  }

  async deleteFooterSection(id, adminUserId, req) {
    const existing = await prisma.footerSection.findUnique({ where: { id } });
    if (!existing) throw ApplicationError.notFound(`Footer section with ID '${id}' not found`);

    await prisma.footerSection.delete({ where: { id } });

    await auditService.recordAdminAction({
      adminUserId,
      action: 'FOOTER_SECTION_DELETED',
      entityType: 'FooterSection',
      entityId: id,
      details: { title: existing.title },
      req,
    });

    return { message: 'Footer section deleted successfully', id };
  }

  async addFooterMenuItem(sectionId, data, adminUserId, req) {
    const section = await prisma.footerSection.findUnique({ where: { id: sectionId } });
    if (!section) throw ApplicationError.notFound(`Footer section '${sectionId}' not found`);

    const item = await prisma.footerMenuItem.create({
      data: {
        sectionId,
        label: data.label,
        url: data.url,
        displayOrder: parseInt(data.displayOrder, 10) || 0,
      },
    });

    await auditService.recordAdminAction({
      adminUserId,
      action: 'FOOTER_ITEM_CREATED',
      entityType: 'FooterMenuItem',
      entityId: item.id,
      details: { sectionId, label: item.label, url: item.url },
      req,
    });

    return item;
  }

  async updateFooterMenuItem(itemId, data, adminUserId, req) {
    const existing = await prisma.footerMenuItem.findUnique({ where: { id: itemId } });
    if (!existing) throw ApplicationError.notFound(`Footer menu item '${itemId}' not found`);

    const updated = await prisma.footerMenuItem.update({
      where: { id: itemId },
      data: {
        ...(data.label ? { label: data.label } : {}),
        ...(data.url ? { url: data.url } : {}),
        ...(data.displayOrder !== undefined ? { displayOrder: parseInt(data.displayOrder, 10) } : {}),
      },
    });

    await auditService.recordAdminAction({
      adminUserId,
      action: 'FOOTER_ITEM_UPDATED',
      entityType: 'FooterMenuItem',
      entityId: itemId,
      details: data,
      req,
    });

    return updated;
  }

  async deleteFooterMenuItem(itemId, adminUserId, req) {
    const existing = await prisma.footerMenuItem.findUnique({ where: { id: itemId } });
    if (!existing) throw ApplicationError.notFound(`Footer menu item '${itemId}' not found`);

    await prisma.footerMenuItem.delete({ where: { id: itemId } });

    await auditService.recordAdminAction({
      adminUserId,
      action: 'FOOTER_ITEM_DELETED',
      entityType: 'FooterMenuItem',
      entityId: itemId,
      details: { label: existing.label },
      req,
    });

    return { message: 'Footer menu item deleted successfully', id: itemId };
  }

  // ==========================================
  // 6. EDITORIAL CONTENT (Journal, Lookbook, Atelier Story)
  // ==========================================

  async listEditorialsAdmin({ category, isPublished, search, page = 1, limit = 20 } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * take;

    const where = {};
    if (category) where.category = { equals: category, mode: 'insensitive' };
    if (isPublished !== undefined) where.isPublished = isPublished === 'true' || isPublished === true;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [editorials, total] = await Promise.all([
      prisma.editorialContent.findMany({
        where,
        skip,
        take,
        orderBy: [{ createdAt: 'desc' }],
      }),
      prisma.editorialContent.count({ where }),
    ]);

    return {
      editorials,
      pagination: {
        page: pageNum,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async listEditorialsPublic({ category, page = 1, limit = 12 } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const take = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
    const skip = (pageNum - 1) * take;

    const where = { isPublished: true };
    if (category) where.category = { equals: category, mode: 'insensitive' };

    const [editorials, total] = await Promise.all([
      prisma.editorialContent.findMany({
        where,
        skip,
        take,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.editorialContent.count({ where }),
    ]);

    return {
      editorials,
      pagination: {
        page: pageNum,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async getEditorialBySlugPublic(slug) {
    const article = await prisma.editorialContent.findUnique({ where: { slug } });
    if (!article || !article.isPublished) {
      throw ApplicationError.notFound(`Editorial article '${slug}' not found`);
    }
    return article;
  }

  async getEditorialByIdAdmin(id) {
    const article = await prisma.editorialContent.findUnique({ where: { id } });
    if (!article) throw ApplicationError.notFound(`Editorial content with ID '${id}' not found`);
    return article;
  }

  async createEditorial(data, adminUserId, req) {
    const existingSlug = await prisma.editorialContent.findUnique({ where: { slug: data.slug } });
    if (existingSlug) throw ApplicationError.conflict(`Editorial slug '${data.slug}' already exists`);

    const article = await prisma.editorialContent.create({
      data: {
        title: data.title,
        slug: data.slug,
        category: data.category,
        content: data.content,
        coverImageUrl: data.coverImageUrl || null,
        author: data.author || 'FORME Atelier',
        isPublished: Boolean(data.isPublished),
        publishedAt: data.isPublished ? (data.publishedAt ? new Date(data.publishedAt) : new Date()) : null,
        seoTitle: data.seoTitle || null,
        seoDescription: data.seoDescription || null,
      },
    });

    await auditService.recordAdminAction({
      adminUserId,
      action: 'EDITORIAL_CREATED',
      entityType: 'EditorialContent',
      entityId: article.id,
      details: { title: article.title, slug: article.slug, category: article.category },
      req,
    });

    return article;
  }

  async updateEditorial(id, data, adminUserId, req) {
    const existing = await this.getEditorialByIdAdmin(id);

    if (data.slug && data.slug !== existing.slug) {
      const clash = await prisma.editorialContent.findUnique({ where: { slug: data.slug } });
      if (clash) throw ApplicationError.conflict(`Editorial slug '${data.slug}' already exists`);
    }

    const updateData = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.coverImageUrl !== undefined) updateData.coverImageUrl = data.coverImageUrl;
    if (data.author !== undefined) updateData.author = data.author;
    if (data.seoTitle !== undefined) updateData.seoTitle = data.seoTitle;
    if (data.seoDescription !== undefined) updateData.seoDescription = data.seoDescription;

    if (data.isPublished !== undefined) {
      updateData.isPublished = Boolean(data.isPublished);
      if (updateData.isPublished && !existing.publishedAt) {
        updateData.publishedAt = data.publishedAt ? new Date(data.publishedAt) : new Date();
      }
    } else if (data.publishedAt !== undefined) {
      updateData.publishedAt = data.publishedAt ? new Date(data.publishedAt) : null;
    }

    const updated = await prisma.editorialContent.update({
      where: { id },
      data: updateData,
    });

    await auditService.recordAdminAction({
      adminUserId,
      action: 'EDITORIAL_UPDATED',
      entityType: 'EditorialContent',
      entityId: id,
      details: updateData,
      req,
    });

    return updated;
  }

  async deleteEditorial(id, adminUserId, req) {
    const existing = await this.getEditorialByIdAdmin(id);
    await prisma.editorialContent.delete({ where: { id } });

    await auditService.recordAdminAction({
      adminUserId,
      action: 'EDITORIAL_DELETED',
      entityType: 'EditorialContent',
      entityId: id,
      details: { title: existing.title, slug: existing.slug },
      req,
    });

    return { message: 'Editorial content deleted successfully', id };
  }

  // ==========================================
  // 7. SEO CONFIGURATION
  // ==========================================

  async listSEOSettingsAdmin() {
    return prisma.sEOSetting.findMany({
      orderBy: { pageKey: 'asc' },
    });
  }

  async getSEOSettingByPageKey(pageKey) {
    const setting = await prisma.sEOSetting.findUnique({
      where: { pageKey: pageKey.toUpperCase() },
    });
    if (!setting) {
      throw ApplicationError.notFound(`SEO setting for pageKey '${pageKey}' not found`);
    }
    return setting;
  }

  async upsertSEOSetting(data, adminUserId, req) {
    const pageKey = data.pageKey.toUpperCase();
    const keywords = Array.isArray(data.keywords)
      ? data.keywords
      : typeof data.keywords === 'string'
      ? data.keywords.split(',').map((k) => k.trim())
      : [];

    const result = await prisma.sEOSetting.upsert({
      where: { pageKey },
      update: {
        title: data.title,
        description: data.description,
        keywords,
        ogImageUrl: data.ogImageUrl || null,
      },
      create: {
        pageKey,
        title: data.title,
        description: data.description,
        keywords,
        ogImageUrl: data.ogImageUrl || null,
      },
    });

    await auditService.recordAdminAction({
      adminUserId,
      action: 'SEO_SETTING_UPSERTED',
      entityType: 'SEOSetting',
      entityId: result.id,
      details: { pageKey, title: result.title },
      req,
    });

    return result;
  }

  async deleteSEOSetting(id, adminUserId, req) {
    const existing = await prisma.sEOSetting.findUnique({ where: { id } });
    if (!existing) throw ApplicationError.notFound(`SEO setting with ID '${id}' not found`);

    await prisma.sEOSetting.delete({ where: { id } });

    await auditService.recordAdminAction({
      adminUserId,
      action: 'SEO_SETTING_DELETED',
      entityType: 'SEOSetting',
      entityId: id,
      details: { pageKey: existing.pageKey },
      req,
    });

    return { message: 'SEO setting deleted successfully', id };
  }

  // ==========================================
  // 8. NEWSLETTER SUBSCRIBERS
  // ==========================================

  async subscribeNewsletter({ email, source = 'FOOTER' }) {
    const cleanEmail = String(email).trim().toLowerCase();

    const existing = await prisma.newsletterSubscription.findUnique({
      where: { email: cleanEmail },
    });

    if (existing) {
      if (!existing.isActive) {
        return prisma.newsletterSubscription.update({
          where: { email: cleanEmail },
          data: {
            isActive: true,
            unsubscribedAt: null,
            subscribedAt: new Date(),
          },
        });
      }
      return existing;
    }

    return prisma.newsletterSubscription.create({
      data: {
        email: cleanEmail,
        source,
        isActive: true,
      },
    });
  }

  async unsubscribeNewsletter(email) {
    const cleanEmail = String(email).trim().toLowerCase();
    const existing = await prisma.newsletterSubscription.findUnique({
      where: { email: cleanEmail },
    });

    if (!existing) {
      throw ApplicationError.notFound(`Email '${cleanEmail}' is not subscribed`);
    }

    return prisma.newsletterSubscription.update({
      where: { email: cleanEmail },
      data: {
        isActive: false,
        unsubscribedAt: new Date(),
      },
    });
  }

  async listSubscribersAdmin({ page = 1, limit = 50, isActive, search } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const take = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * take;

    const where = {};
    if (isActive !== undefined) where.isActive = isActive === 'true' || isActive === true;
    if (search) where.email = { contains: search, mode: 'insensitive' };

    const [subscribers, total] = await Promise.all([
      prisma.newsletterSubscription.findMany({
        where,
        skip,
        take,
        orderBy: { subscribedAt: 'desc' },
      }),
      prisma.newsletterSubscription.count({ where }),
    ]);

    return {
      subscribers,
      pagination: {
        page: pageNum,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async toggleSubscriberStatus(id, isActive, adminUserId, req) {
    const existing = await prisma.newsletterSubscription.findUnique({ where: { id } });
    if (!existing) throw ApplicationError.notFound(`Subscriber with ID '${id}' not found`);

    const updated = await prisma.newsletterSubscription.update({
      where: { id },
      data: {
        isActive: Boolean(isActive),
        unsubscribedAt: !isActive ? new Date() : null,
      },
    });

    await auditService.recordAdminAction({
      adminUserId,
      action: 'NEWSLETTER_STATUS_TOGGLED',
      entityType: 'NewsletterSubscription',
      entityId: id,
      details: { email: updated.email, isActive: updated.isActive },
      req,
    });

    return updated;
  }
}

export const cmsService = new CMSService();
export default cmsService;

