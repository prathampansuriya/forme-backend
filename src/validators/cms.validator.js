import { z } from 'zod';

export const bannerSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1, 'Title is required').max(200),
    subtitle: z.string().trim().max(300).optional().nullable(),
    type: z.enum(['HOME', 'COLLECTION', 'OFFER', 'EDITORIAL_SPLIT', 'ANNOUNCEMENT']).default('HOME'),
    desktopMediaUrl: z.string().url('Desktop media URL must be a valid URL'),
    mobileMediaUrl: z.string().url('Mobile media URL must be a valid URL'),
    desktopMediaType: z.enum(['IMAGE', 'VIDEO']).default('IMAGE'),
    mobileMediaType: z.enum(['IMAGE', 'VIDEO']).default('IMAGE'),
    altText: z.string().trim().max(200).optional().nullable(),
    ctaLabel: z.string().trim().max(100).optional().nullable(),
    ctaLink: z.string().trim().max(500).optional().nullable(),
    scheduleStart: z.string().datetime({ offset: true }).optional().nullable(),
    scheduleEnd: z.string().datetime({ offset: true }).optional().nullable(),
    isPublished: z.boolean().default(false),
    displayOrder: z.number().int().min(0).default(0),
  }),
});

export const updateBannerSchema = z.object({
  params: z.object({
    id: z.string().uuid('Valid banner ID required'),
  }),
  body: z.object({
    title: z.string().trim().min(1).max(200).optional(),
    subtitle: z.string().trim().max(300).optional().nullable(),
    type: z.enum(['HOME', 'COLLECTION', 'OFFER', 'EDITORIAL_SPLIT', 'ANNOUNCEMENT']).optional(),
    desktopMediaUrl: z.string().url().optional(),
    mobileMediaUrl: z.string().url().optional(),
    desktopMediaType: z.enum(['IMAGE', 'VIDEO']).optional(),
    mobileMediaType: z.enum(['IMAGE', 'VIDEO']).optional(),
    altText: z.string().trim().max(200).optional().nullable(),
    ctaLabel: z.string().trim().max(100).optional().nullable(),
    ctaLink: z.string().trim().max(500).optional().nullable(),
    scheduleStart: z.string().datetime({ offset: true }).optional().nullable(),
    scheduleEnd: z.string().datetime({ offset: true }).optional().nullable(),
    isPublished: z.boolean().optional(),
    displayOrder: z.number().int().min(0).optional(),
  }),
});

export const announcementSchema = z.object({
  body: z.object({
    message: z.string().trim().min(1, 'Announcement message is required').max(500),
    ctaLabel: z.string().trim().max(100).optional().nullable(),
    ctaLink: z.string().trim().max(500).optional().nullable(),
    backgroundColor: z.string().trim().regex(/^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/).optional().nullable(),
    textColor: z.string().trim().regex(/^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/).optional().nullable(),
    isPublished: z.boolean().default(false),
    scheduleStart: z.string().datetime({ offset: true }).optional().nullable(),
    scheduleEnd: z.string().datetime({ offset: true }).optional().nullable(),
    displayOrder: z.number().int().min(0).default(0),
  }),
});

export const updateAnnouncementSchema = z.object({
  params: z.object({
    id: z.string().uuid('Valid announcement ID required'),
  }),
  body: z.object({
    message: z.string().trim().min(1).max(500).optional(),
    ctaLabel: z.string().trim().max(100).optional().nullable(),
    ctaLink: z.string().trim().max(500).optional().nullable(),
    backgroundColor: z.string().trim().regex(/^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/).optional().nullable(),
    textColor: z.string().trim().regex(/^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/).optional().nullable(),
    isPublished: z.boolean().optional(),
    scheduleStart: z.string().datetime({ offset: true }).optional().nullable(),
    scheduleEnd: z.string().datetime({ offset: true }).optional().nullable(),
    displayOrder: z.number().int().min(0).optional(),
  }),
});

export const homePageSectionSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1, 'Title is required').max(200),
    subtitle: z.string().trim().max(300).optional().nullable(),
    type: z.enum([
      'HERO_BANNER',
      'EDITORIAL_GRID',
      'FEATURED_COLLECTION',
      'FLASH_SALE_ROW',
      'LOOKBOOK_SPLIT',
      'CATEGORY_CAROUSEL',
      'TESTIMONIALS',
    ]),
    references: z.any().optional().nullable(),
    layoutConfig: z.any().optional().nullable(),
    displayOrder: z.number().int().min(0).default(0),
    isPublished: z.boolean().default(false),
    scheduleStart: z.string().datetime({ offset: true }).optional().nullable(),
    scheduleEnd: z.string().datetime({ offset: true }).optional().nullable(),
  }),
});

export const updateHomePageSectionSchema = z.object({
  params: z.object({
    id: z.string().uuid('Valid homepage section ID required'),
  }),
  body: z.object({
    title: z.string().trim().min(1).max(200).optional(),
    subtitle: z.string().trim().max(300).optional().nullable(),
    type: z
      .enum([
        'HERO_BANNER',
        'EDITORIAL_GRID',
        'FEATURED_COLLECTION',
        'FLASH_SALE_ROW',
        'LOOKBOOK_SPLIT',
        'CATEGORY_CAROUSEL',
        'TESTIMONIALS',
      ])
      .optional(),
    references: z.any().optional().nullable(),
    layoutConfig: z.any().optional().nullable(),
    displayOrder: z.number().int().min(0).optional(),
    isPublished: z.boolean().optional(),
    scheduleStart: z.string().datetime({ offset: true }).optional().nullable(),
    scheduleEnd: z.string().datetime({ offset: true }).optional().nullable(),
  }),
});

export const navigationMenuSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Menu name is required').max(100),
    slug: z.string().trim().min(1, 'Slug is required').max(100).toLowerCase(),
    isActive: z.boolean().default(true),
  }),
});

export const updateNavigationMenuSchema = z.object({
  params: z.object({
    id: z.string().uuid('Valid menu ID required'),
  }),
  body: z.object({
    name: z.string().trim().min(1).max(100).optional(),
    slug: z.string().trim().min(1).max(100).toLowerCase().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const navigationMenuItemSchema = z.object({
  params: z.object({
    menuId: z.string().uuid('Valid menu ID required'),
  }),
  body: z.object({
    label: z.string().trim().min(1, 'Label is required').max(100),
    url: z.string().trim().min(1, 'URL is required').max(500),
    displayOrder: z.number().int().min(0).default(0),
    parentId: z.string().uuid().optional().nullable(),
    highlightBadge: z.string().trim().max(30).optional().nullable(),
  }),
});

export const updateNavigationMenuItemSchema = z.object({
  params: z.object({
    itemId: z.string().uuid('Valid item ID required'),
  }),
  body: z.object({
    label: z.string().trim().min(1).max(100).optional(),
    url: z.string().trim().min(1).max(500).optional(),
    displayOrder: z.number().int().min(0).optional(),
    parentId: z.string().uuid().optional().nullable(),
    highlightBadge: z.string().trim().max(30).optional().nullable(),
  }),
});

export const footerSectionSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1, 'Title is required').max(100),
    displayOrder: z.number().int().min(0).default(0),
    isActive: z.boolean().default(true),
  }),
});

export const updateFooterSectionSchema = z.object({
  params: z.object({
    id: z.string().uuid('Valid section ID required'),
  }),
  body: z.object({
    title: z.string().trim().min(1).max(100).optional(),
    displayOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  }),
});

export const footerMenuItemSchema = z.object({
  params: z.object({
    sectionId: z.string().uuid('Valid section ID required'),
  }),
  body: z.object({
    label: z.string().trim().min(1, 'Label is required').max(100),
    url: z.string().trim().min(1, 'URL is required').max(500),
    displayOrder: z.number().int().min(0).default(0),
  }),
});

export const updateFooterMenuItemSchema = z.object({
  params: z.object({
    itemId: z.string().uuid('Valid item ID required'),
  }),
  body: z.object({
    label: z.string().trim().min(1).max(100).optional(),
    url: z.string().trim().min(1).max(500).optional(),
    displayOrder: z.number().int().min(0).optional(),
  }),
});

export const editorialSchema = z.object({
  body: z.object({
    title: z.string().trim().min(2, 'Title is required').max(250),
    slug: z.string().trim().min(2, 'Slug is required').max(250).toLowerCase(),
    category: z.string().trim().min(2, 'Category is required').max(100),
    content: z.string().min(10, 'Content must be at least 10 characters'),
    coverImageUrl: z.string().url().optional().nullable(),
    author: z.string().trim().max(100).default('FORME Atelier'),
    isPublished: z.boolean().default(false),
    publishedAt: z.string().datetime({ offset: true }).optional().nullable(),
    seoTitle: z.string().trim().max(200).optional().nullable(),
    seoDescription: z.string().trim().max(500).optional().nullable(),
  }),
});

export const updateEditorialSchema = z.object({
  params: z.object({
    id: z.string().uuid('Valid editorial ID required'),
  }),
  body: z.object({
    title: z.string().trim().min(2).max(250).optional(),
    slug: z.string().trim().min(2).max(250).toLowerCase().optional(),
    category: z.string().trim().min(2).max(100).optional(),
    content: z.string().min(10).optional(),
    coverImageUrl: z.string().url().optional().nullable(),
    author: z.string().trim().max(100).optional(),
    isPublished: z.boolean().optional(),
    publishedAt: z.string().datetime({ offset: true }).optional().nullable(),
    seoTitle: z.string().trim().max(200).optional().nullable(),
    seoDescription: z.string().trim().max(500).optional().nullable(),
  }),
});

export const seoSettingSchema = z.object({
  body: z.object({
    pageKey: z.string().trim().min(2, 'Page key is required').max(100).toUpperCase(),
    title: z.string().trim().min(2, 'SEO Title is required').max(200),
    description: z.string().trim().min(10, 'SEO Description is required').max(500),
    keywords: z.array(z.string().trim()).or(z.string().trim()).default([]),
    ogImageUrl: z.string().url().optional().nullable(),
  }),
});

export const newsletterSubscribeSchema = z.object({
  body: z.object({
    email: z.string().trim().email('Valid email address required'),
    source: z.string().trim().max(50).default('FOOTER'),
  }),
});

export const newsletterUnsubscribeSchema = z.object({
  body: z.object({
    email: z.string().trim().email('Valid email address required'),
  }),
});

export const querySubscribersSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    isActive: z.enum(['true', 'false']).optional(),
    search: z.string().trim().optional(),
  }),
});

