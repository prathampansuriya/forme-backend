import prisma from '../config/prisma.config.js';
import ApplicationError from '../utils/ApplicationError.js';
import pricingService from './pricing.service.js';

class ProductService {
  /**
   * Helper: Formats a product for client consumption with primary image, colors, and stock summary.
   */
  _formatProductCard(product, promoOrPrice = null) {
    let activePromotion = null;
    let sellingPrice = Number(product.sellingPrice);
    let baseSellingPrice = Number(product.sellingPrice);
    let compareAtPrice = product.compareAtPrice ? Number(product.compareAtPrice) : null;
    let mrp = compareAtPrice || sellingPrice;
    let discountPercentage = 0;

    if (promoOrPrice && promoOrPrice.effectiveSellingPrice !== undefined) {
      sellingPrice = Number(promoOrPrice.effectiveSellingPrice);
      baseSellingPrice = Number(promoOrPrice.baseSellingPrice);
      compareAtPrice = promoOrPrice.compareAtPrice ? Number(promoOrPrice.compareAtPrice) : null;
      mrp = Number(promoOrPrice.mrp);
      discountPercentage = promoOrPrice.discountPercentage || 0;
      activePromotion = promoOrPrice.appliedPromotion || null;
    } else if (promoOrPrice) {
      activePromotion = promoOrPrice;
    }

    if (discountPercentage === 0 && mrp > sellingPrice) {
      discountPercentage = Math.round(((mrp - sellingPrice) / mrp) * 100);
    }
    const primaryMedia =
      product.media?.find((m) => m.isPrimary) ||
      product.media?.[0] || {
        secureUrl: 'https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=800&q=80',
        altText: product.name,
      };

    // Extract unique color variants and color-specific images
    const colorMap = new Map();
    const availableSizes = new Set();
    let totalAvailableStock = 0;

    (product.variants || []).forEach((v) => {
      if (v.status === 'ACTIVE') {
        totalAvailableStock += v.availableQuantity;
        if (v.size) availableSizes.add(v.size);
        if (v.colorName && !colorMap.has(v.colorName)) {
          const variantMedia = v.media?.[0]?.secureUrl || v.media?.[0]?.thumbnailUrl || null;
          colorMap.set(v.colorName, {
            name: v.colorName,
            hex: v.colorHex,
            imageUrl: variantMedia,
          });
        }
      }
    });

    // Calculate authentic review stats from database reviews
    const approvedReviews = (product.reviews || []).filter((r) => r.isApproved !== false);
    const totalReviews = approvedReviews.length;
    const averageRating =
      totalReviews > 0
        ? parseFloat((approvedReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1))
        : 0;

    // Full normalized media list for video & multi-angle hover preview
    const normalizedMedia = (product.media || []).map((m) => ({
      id: m.id,
      url: m.secureUrl || m.url,
      secureUrl: m.secureUrl || m.url,
      thumbnailUrl: m.thumbnailUrl || m.secureUrl || m.url,
      mediaType: m.mediaType,
      isPrimary: m.isPrimary,
      altText: m.altText || product.name,
    }));

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      baseSku: product.baseSku,
      shortDescription: product.shortDescription,
      productType: product.productType,
      fabric: product.fabric,
      fit: product.fit,
      audience: product.audience,
      sellingPrice,
      baseSellingPrice,
      compareAtPrice,
      mrp,
      discountPercentage,
      isFeatured: product.isFeatured,
      isNewArrival: product.isNewArrival,
      status: product.status,
      inStock: totalAvailableStock > 0,
      totalStock: totalAvailableStock,
      category: product.category
        ? {
            id: product.category.id,
            name: product.category.name,
            slug: product.category.slug,
          }
        : null,
      primaryImage: {
        url: primaryMedia.secureUrl || primaryMedia.url,
        alt: primaryMedia.altText || product.name,
      },
      media: normalizedMedia,
      colors: Array.from(colorMap.values()),
      sizes: Array.from(availableSizes),
      ratingSummary: {
        averageRating,
        totalReviews,
      },
      rating: averageRating,
      reviewCount: totalReviews,
      createdAt: product.createdAt,
      activePromotion: activePromotion || null,
    };
  }

  /**
   * Comprehensive Customer Product Listing with database filtering, sorting, and pagination.
   */
  async listProducts(filters = {}) {
    const {
      page = 1,
      limit = 12,
      category,
      collection,
      minPrice,
      maxPrice,
      size,
      color,
      audience,
      productType,
      fabric,
      fit,
      inStock,
      hasDiscount,
      isNewArrival,
      isFeatured,
      minRating,
      sort = 'newest',
      search,
    } = filters;

    const where = {};
    if (filters.status && filters.status !== 'all') {
      where.status = filters.status;
    } else if (!filters.status && !filters.includeAllStatus) {
      where.status = 'PUBLISHED';
    }

    if (!filters.includeArchived && filters.status !== 'ARCHIVED') {
      where.deletedAt = null;
    }

    // 1. Category Filter (resolves child categories if parent is selected)
    if (category) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(category);
      const foundCategory = await prisma.category.findFirst({
        where: isUuid ? { id: category } : { slug: category },
        include: { children: { select: { id: true } } },
      });

      if (foundCategory) {
        const catIds = [foundCategory.id, ...(foundCategory.children || []).map((c) => c.id)];
        where.categoryId = { in: catIds };
      }
    }

    // 2. Collection Filter
    if (collection) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(collection);
      where.collectionProducts = {
        some: {
          collection: {
            ...(isUuid ? { id: collection } : { slug: collection }),
            isPublished: true,
          },
        },
      };
    }

    // 2b. Promotional Offer Filter (resolves applicable products, categories, collections)
    if (filters.offer || filters.offerId) {
      const offerIdentifier = filters.offer || filters.offerId;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(offerIdentifier);
      const targetOffer = await prisma.offer.findFirst({
        where: isUuid ? { id: offerIdentifier } : { slug: offerIdentifier },
        include: {
          applicableProducts: { select: { productId: true } },
          applicableCategories: { select: { categoryId: true } },
          applicableCollections: { select: { collectionId: true } },
        },
      });

      if (targetOffer) {
        const prodIds = (targetOffer.applicableProducts || []).map((p) => p.productId);
        const catIds = (targetOffer.applicableCategories || []).map((c) => c.categoryId);
        const colIds = (targetOffer.applicableCollections || []).map((c) => c.collectionId);

        const offerOrConditions = [];
        if (prodIds.length > 0) offerOrConditions.push({ id: { in: prodIds } });
        if (catIds.length > 0) offerOrConditions.push({ categoryId: { in: catIds } });
        if (colIds.length > 0) {
          offerOrConditions.push({
            collectionProducts: {
              some: { collectionId: { in: colIds } },
            },
          });
        }

        if (offerOrConditions.length > 0) {
          where.AND = where.AND || [];
          where.AND.push({ OR: offerOrConditions });
        }
      }
    }

    // 2c. Flash Sale Filter (resolves products included in active flash sale)
    if (filters.flashSale || filters.flash_sale || filters.flashSaleId || filters.filter === 'flash_sale') {
      const flashSaleIdentifier = filters.flashSaleId ||
        (filters.flashSale && filters.flashSale !== 'true' ? filters.flashSale : null) ||
        (filters.flash_sale && filters.flash_sale !== 'true' ? filters.flash_sale : null);

      let targetProductIds = [];
      if (flashSaleIdentifier) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(flashSaleIdentifier);
        const targetSale = await prisma.flashSale.findFirst({
          where: isUuid ? { id: flashSaleIdentifier } : { slug: flashSaleIdentifier },
          include: { products: { select: { productId: true } } },
        });
        if (targetSale) {
          targetProductIds = (targetSale.products || []).map((p) => p.productId);
        }
      } else {
        const activeSales = await prisma.flashSale.findMany({
          where: {
            status: 'ACTIVE',
            startTime: { lte: new Date() },
            endTime: { gte: new Date() },
          },
          include: { products: { select: { productId: true } } },
        });
        targetProductIds = activeSales.flatMap((s) => (s.products || []).map((p) => p.productId));
      }
      where.id = { in: targetProductIds };
    }

    // 3. Price Filter
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.sellingPrice = {};
      if (minPrice !== undefined) where.sellingPrice.gte = minPrice;
      if (maxPrice !== undefined) where.sellingPrice.lte = maxPrice;
    }

    // 4. Variant Filters: Size, Color, In-Stock
    const variantConditions = { status: 'ACTIVE' };

    if (size) {
      const sizeList = size.split(',').map((s) => s.trim());
      variantConditions.size = { in: sizeList };
    }

    if (color) {
      const colorList = color.split(',').map((c) => c.trim());
      variantConditions.colorName = { in: colorList, mode: 'insensitive' };
    }

    if (inStock) {
      variantConditions.availableQuantity = { gt: 0 };
    }

    if (size || color || inStock) {
      where.variants = { some: variantConditions };
    }

    // 5. Taxonomy Filters
    if (audience) where.audience = audience;
    if (productType) where.productType = { equals: productType, mode: 'insensitive' };
    if (fabric) where.fabric = { equals: fabric, mode: 'insensitive' };
    if (fit) where.fit = { equals: fit, mode: 'insensitive' };
    if (isNewArrival || filters.filter === 'new' || filters.isNewArrival === 'true' || filters.isNewArrival === true) {
      where.isNewArrival = true;
    }
    if (isFeatured) where.isFeatured = true;

    // 6. Discount filter
    if (hasDiscount) {
      where.compareAtPrice = { not: null, gt: 0 };
    }

    // 7. Search text
    if (search) {
      const term = search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { shortDescription: { contains: term, mode: 'insensitive' } },
        { productType: { contains: term, mode: 'insensitive' } },
        { fabric: { contains: term, mode: 'insensitive' } },
        { baseSku: { contains: term, mode: 'insensitive' } },
        { tags: { has: term } },
      ];
    }

    // 8. Sorting strategy
    let orderBy = [{ createdAt: 'desc' }];
    if (sort === 'price_asc') orderBy = [{ sellingPrice: 'asc' }];
    if (sort === 'price_desc') orderBy = [{ sellingPrice: 'desc' }];
    if (sort === 'best_sellers' || sort === 'popularity') orderBy = [{ salesCount: 'desc' }, { viewCount: 'desc' }];
    if (sort === 'trending') orderBy = [{ viewCount: 'desc' }];
    if (sort === 'featured') orderBy = [{ isFeatured: 'desc' }, { createdAt: 'desc' }];

    // Execute queries
    const skip = (page - 1) * limit;
    const now = new Date();

    const [total, products, activeFlashSales, activeOffers] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          collectionProducts: { select: { collectionId: true } },
          media: {
            orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }],
            take: 4,
          },
          variants: {
            where: { status: 'ACTIVE' },
            select: {
              id: true,
              size: true,
              colorName: true,
              colorHex: true,
              priceOverride: true,
              availableQuantity: true,
              status: true,
              media: {
                orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }],
                take: 1,
                select: { secureUrl: true, thumbnailUrl: true, isPrimary: true },
              },
            },
          },
          reviews: {
            where: { isApproved: true },
            select: { rating: true, isApproved: true },
          },
        },
      }),
      prisma.flashSale.findMany({
        where: {
          status: 'ACTIVE',
          startTime: { lte: now },
          endTime: { gte: now },
        },
        include: {
          products: true,
        },
        orderBy: { priority: 'desc' },
      }),
      prisma.offer.findMany({
        where: {
          isActive: true,
          startDate: { lte: now },
          endDate: { gte: now },
        },
        include: {
          applicableProducts: true,
          applicableCategories: true,
          applicableCollections: true,
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      items: products.map((p) => {
        const calculatedPrice = pricingService.calculateItemPrice({
          product: p,
          variant: p.variants?.[0],
          activeFlashSales,
          activeOffers,
          now,
        });
        return this._formatProductCard(p, calculatedPrice);
      }),
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Retrieves single product by slug with full variant matrix, color-specific galleries, and review analytics.
   */
  async getProductBySlug(slug, { userId = null, sessionId = null } = {}) {
    const product = await prisma.product.findFirst({
      where: {
        slug,
        deletedAt: null,
      },
      include: {
        category: {
          include: { parent: { select: { id: true, name: true, slug: true } } },
        },
        collectionProducts: {
          include: { collection: { select: { id: true, name: true, slug: true } } },
        },
        variants: {
          where: { status: 'ACTIVE' },
          orderBy: [{ colorName: 'asc' }, { size: 'asc' }],
        },
        media: {
          orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }],
        },
        attributes: {
          include: {
            attribute: { select: { id: true, name: true, slug: true } },
            value: { select: { id: true, value: true, slug: true } },
          },
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            user: { select: { id: true, name: true } },
            media: true,
          },
        },
      },
    });

    if (!product) {
      throw ApplicationError.notFound(`Product with slug "${slug}" not found.`);
    }

    // 1. Increment product view count in background
    prisma.product
      .update({
        where: { id: product.id },
        data: { viewCount: { increment: 1 } },
      })
      .catch((err) => console.warn(`Failed to increment viewCount for ${product.id}:`, err.message));

    // 2. Track Recently Viewed Product
    if (userId || sessionId) {
      this.recordProductView({ productId: product.id, userId, sessionId }).catch(() => {});
    }

    // 3. Color-variant media separation (Crucial requirement)
    // Group variants by color and build per-color gallery
    const colorGroups = {};
    const galleryByColor = {};
    const defaultGallery = [];

    // Map media to variant / color
    const variantIdToColor = {};
    product.variants.forEach((v) => {
      variantIdToColor[v.id] = v.colorName;
    });

    product.media.forEach((m) => {
      const associatedColor = m.variantId ? variantIdToColor[m.variantId] : null;

      if (associatedColor) {
        if (!galleryByColor[associatedColor]) galleryByColor[associatedColor] = [];
        galleryByColor[associatedColor].push({
          id: m.id,
          type: m.mediaType,
          url: m.secureUrl,
          thumbnailUrl: m.thumbnailUrl,
          altText: m.altText,
          isPrimary: m.isPrimary,
          displayOrder: m.displayOrder,
        });
      } else {
        defaultGallery.push({
          id: m.id,
          type: m.mediaType,
          url: m.secureUrl,
          thumbnailUrl: m.thumbnailUrl,
          altText: m.altText,
          isPrimary: m.isPrimary,
          displayOrder: m.displayOrder,
        });
      }
    });

    // 4. Preload active promotions for authoritative price calculation
    const now = new Date();
    const [activeFlashSales, activeOffers] = await Promise.all([
      prisma.flashSale.findMany({
        where: {
          status: 'ACTIVE',
          startTime: { lte: now },
          endTime: { gte: now },
        },
        include: {
          products: true,
        },
        orderBy: { priority: 'desc' },
      }),
      prisma.offer.findMany({
        where: {
          isActive: true,
          startDate: { lte: now },
          endDate: { gte: now },
        },
        include: {
          applicableProducts: true,
          applicableCategories: true,
          applicableCollections: true,
        },
      }),
    ]);

    // Organize variants by color
    product.variants.forEach((v) => {
      if (!colorGroups[v.colorName]) {
        colorGroups[v.colorName] = {
          colorName: v.colorName,
          colorHex: v.colorHex,
          variants: [],
          sizes: [],
          inStock: false,
          gallery: galleryByColor[v.colorName] || defaultGallery,
        };
      }

      const vPricing = pricingService.calculateItemPrice({
        product,
        variant: v,
        activeFlashSales,
        activeOffers,
        now,
      });

      colorGroups[v.colorName].variants.push({
        id: v.id,
        sku: v.sku,
        size: v.size,
        price: Number(vPricing.sellingPrice),
        sellingPrice: Number(vPricing.sellingPrice),
        baseSellingPrice: Number(vPricing.baseSellingPrice),
        compareAtPrice: vPricing.compareAtPrice ? Number(vPricing.compareAtPrice) : null,
        mrp: Number(vPricing.mrp),
        discountPercentage: vPricing.discountPercentage,
        activePromotion: vPricing.appliedPromotion,
        stockQuantity: v.stockQuantity,
        availableQuantity: v.availableQuantity,
        inStock: v.availableQuantity > 0,
      });

      colorGroups[v.colorName].sizes.push(v.size);
      if (v.availableQuantity > 0) {
        colorGroups[v.colorName].inStock = true;
      }
    });

    // Calculate review stats
    const approvedReviews = (product.reviews || []).filter((r) => r.isApproved !== false);
    const totalReviews = approvedReviews.length;
    const averageRating =
      totalReviews > 0
        ? parseFloat((approvedReviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(1))
        : 0;

    // Master product pricing
    const masterPricing = pricingService.calculateItemPrice({
      product,
      variant: product.variants?.[0] || null,
      activeFlashSales,
      activeOffers,
      now,
    });

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      baseSku: product.baseSku,
      shortDescription: product.shortDescription,
      longDescription: product.longDescription,
      productType: product.productType,
      fabric: product.fabric,
      fit: product.fit,
      material: product.material,
      careInstructions: product.careInstructions,
      specifications: product.specifications,
      tags: product.tags,
      sellingPrice: Number(masterPricing.sellingPrice),
      baseSellingPrice: Number(masterPricing.baseSellingPrice),
      compareAtPrice: masterPricing.compareAtPrice ? Number(masterPricing.compareAtPrice) : null,
      mrp: Number(masterPricing.mrp),
      discountPercentage: masterPricing.discountPercentage,
      isFeatured: product.isFeatured,
      isNewArrival: product.isNewArrival,
      status: product.status,
      category: product.category,
      collections: product.collectionProducts.map((cp) => cp.collection),
      attributes: product.attributes.map((a) => ({
        name: a.attribute.name,
        slug: a.attribute.slug,
        value: a.value.value,
      })),
      colorVariants: Object.values(colorGroups),
      defaultGallery,
      galleryByColor,
      ratingSummary: {
        averageRating,
        totalReviews,
      },
      recentReviews: product.reviews,
      activePromotion: masterPricing.appliedPromotion,
      seo: {
        title: product.seoTitle || `${product.name} — FORME`,
        description: product.seoDescription || product.shortDescription,
        keywords: product.seoKeywords,
      },
    };
  }

  /**
   * Admin / Direct Lookup: Retrieves product by ID or Slug with complete variant matrix and media.
   */
  async getProductById(id, { includeAllVariants = true } = {}) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const product = await prisma.product.findFirst({
      where: isUuid ? { id } : { slug: id },
      include: {
        category: true,
        collectionProducts: {
          include: { collection: true },
        },
        variants: {
          orderBy: [{ colorName: 'asc' }, { size: 'asc' }],
        },
        media: {
          orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }],
        },
        attributes: {
          include: {
            attribute: true,
            value: true,
          },
        },
        reviews: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!product) {
      throw ApplicationError.notFound(`Product with identifier "${id}" not found.`);
    }

    return {
      ...product,
      sellingPrice: Number(product.sellingPrice),
      compareAtPrice: product.compareAtPrice ? Number(product.compareAtPrice) : null,
      variants: product.variants.map((v) => ({
        ...v,
        priceOverride: v.priceOverride ? Number(v.priceOverride) : null,
        compareAtPriceOverride: v.compareAtPriceOverride ? Number(v.compareAtPriceOverride) : null,
      })),
      collectionIds: product.collectionProducts.map((cp) => cp.collectionId),
      collections: product.collectionProducts.map((cp) => cp.collection),
    };
  }

  /**
   * Retrieves featured products.
   */
  async getFeaturedProducts({ limit = 8 } = {}) {
    return this.listProducts({ isFeatured: true, limit, sort: 'featured' });
  }

  /**
   * Retrieves new arrivals.
   */
  async getNewArrivals({ limit = 8 } = {}) {
    return this.listProducts({ isNewArrival: true, limit, sort: 'newest' });
  }

  /**
   * Retrieves best-selling garments based on confirmed orders / sales count.
   */
  async getBestSellers({ limit = 8 } = {}) {
    return this.listProducts({ limit, sort: 'best_sellers' });
  }

  /**
   * Retrieves trending garments based on views and engagement.
   */
  async getTrendingProducts({ limit = 8 } = {}) {
    return this.listProducts({ limit, sort: 'trending' });
  }

  /**
   * Retrieves related products based on shared category, audience, or collection.
   */
  async getRelatedProducts(productId, { limit = 4 } = {}) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { categoryId: true, audience: true, fabric: true },
    });

    if (!product) {
      throw ApplicationError.notFound('Product not found.');
    }

    const related = await prisma.product.findMany({
      where: {
        id: { not: productId },
        status: 'PUBLISHED',
        deletedAt: null,
        OR: [
          { categoryId: product.categoryId },
          { audience: product.audience },
          { fabric: product.fabric },
        ],
      },
      take: limit,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        media: {
          where: { isPrimary: true },
          take: 1,
        },
        variants: {
          where: { status: 'ACTIVE' },
          select: { size: true, colorName: true, colorHex: true, availableQuantity: true },
        },
        reviews: {
          where: { isApproved: true },
          select: { rating: true, isApproved: true },
        },
      },
    });

    return related.map((p) => this._formatProductCard(p));
  }

  /**
   * Curated recommendations based on actual category/collection relationships.
   */
  async getRecommendations(productId, { limit = 4 } = {}) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        collectionProducts: { select: { collectionId: true } },
      },
    });

    if (!product) {
      throw ApplicationError.notFound('Product not found.');
    }

    const collectionIds = product.collectionProducts.map((cp) => cp.collectionId);

    const recommended = await prisma.product.findMany({
      where: {
        id: { not: productId },
        status: 'PUBLISHED',
        deletedAt: null,
        OR: [
          { collectionProducts: { some: { collectionId: { in: collectionIds } } } },
          { categoryId: product.categoryId },
          { isFeatured: true },
        ],
      },
      take: limit,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        media: { where: { isPrimary: true }, take: 1 },
        variants: { where: { status: 'ACTIVE' }, select: { size: true, colorName: true, colorHex: true, availableQuantity: true } },
        reviews: {
          where: { isApproved: true },
          select: { rating: true, isApproved: true },
        },
      },
    });

    return recommended.map((p) => this._formatProductCard(p));
  }

  /**
   * Records a product view for a customer or guest session.
   */
  async recordProductView({ productId, userId = null, sessionId = null }) {
    if (!userId && !sessionId) return;

    try {
      await prisma.recentlyViewedProduct.create({
        data: {
          productId,
          userId,
          sessionId,
        },
      });
    } catch (err) {
      // Ignore unique/duplicate errors for recently viewed
    }
  }

  /**
   * Retrieves customer's recently viewed products.
   */
  async getRecentlyViewed({ userId = null, sessionId = null, limit = 8 } = {}) {
    if (!userId && !sessionId) {
      return [];
    }

    const views = await prisma.recentlyViewedProduct.findMany({
      where: {
        OR: [
          ...(userId ? [{ userId }] : []),
          ...(sessionId ? [{ sessionId }] : []),
        ],
        product: { status: 'PUBLISHED', deletedAt: null },
      },
      orderBy: { viewedAt: 'desc' },
      take: limit,
      include: {
        product: {
          include: {
            category: { select: { id: true, name: true, slug: true } },
            media: { where: { isPrimary: true }, take: 1 },
            variants: { where: { status: 'ACTIVE' }, select: { size: true, colorName: true, colorHex: true, availableQuantity: true } },
            reviews: { where: { isApproved: true }, select: { rating: true, isApproved: true } },
          },
        },
      },
    });

    // Remove duplicates preserving most recent order
    const seen = new Set();
    const result = [];
    for (const v of views) {
      if (v.product && !seen.has(v.product.id)) {
        seen.add(v.product.id);
        result.push(this._formatProductCard(v.product));
      }
    }

    return result;
  }

  // ==========================================
  // ADMIN PRODUCT CRUD OPERATIONS
  // ==========================================

  /**
   * Admin: Creates master product with variants and media in a single transaction.
   */
  async createProduct(data) {
    const existing = await prisma.product.findFirst({
      where: {
        OR: [{ slug: data.slug }, { baseSku: data.baseSku }],
      },
    });

    if (existing) {
      throw ApplicationError.conflict(`Product with slug "${data.slug}" or SKU "${data.baseSku}" already exists.`);
    }

    const { variants, media, collectionIds, ...productData } = data;

    return await prisma.$transaction(async (tx) => {
      // 1. Create Master Product
      const product = await tx.product.create({
        data: productData,
      });

      // 1b. Associate Collections (if provided)
      if (collectionIds && Array.isArray(collectionIds) && collectionIds.length > 0) {
        for (const colId of collectionIds) {
          await tx.collectionProduct.create({
            data: {
              productId: product.id,
              collectionId: colId,
            },
          });
        }
      }

      // 2. Create Initial Variants (if provided)
      const createdVariants = [];
      if (variants && variants.length > 0) {
        for (const v of variants) {
          const variant = await tx.productVariant.create({
            data: {
              ...v,
              productId: product.id,
              availableQuantity: v.stockQuantity,
            },
          });
          createdVariants.push(variant);
        }
      }

      // 3. Create Media Attachments (if provided)
      if (media && media.length > 0) {
        for (const m of media) {
          let variantId = m.variantId;
          // If colorName provided instead of variantId, map to variant
          if (!variantId && m.colorName) {
            const matchedVariant = createdVariants.find((v) => v.colorName.toLowerCase() === m.colorName.toLowerCase());
            if (matchedVariant) variantId = matchedVariant.id;
          }

          await tx.productMedia.create({
            data: {
              productId: product.id,
              variantId,
              mediaType: m.mediaType || 'IMAGE',
              publicId: m.publicId,
              secureUrl: m.secureUrl,
              thumbnailUrl: m.thumbnailUrl,
              altText: m.altText || product.name,
              displayOrder: m.displayOrder || 0,
              isPrimary: m.isPrimary || false,
            },
          });
        }
      }

      return product;
    });
  }

  /**
   * Admin: Updates product core metadata.
   */
  async updateProduct(id, data) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw ApplicationError.notFound(`Product with ID "${id}" not found.`);
    }

    if (data.slug && data.slug !== product.slug) {
      const duplicate = await prisma.product.findUnique({ where: { slug: data.slug } });
      if (duplicate) throw ApplicationError.conflict(`Slug "${data.slug}" is already in use.`);
    }

    if (data.baseSku && data.baseSku !== product.baseSku) {
      const duplicate = await prisma.product.findUnique({ where: { baseSku: data.baseSku } });
      if (duplicate) throw ApplicationError.conflict(`Base SKU "${data.baseSku}" is already in use.`);
    }

    const { collectionIds, variants, media, ...updateData } = data;

    return await prisma.$transaction(async (tx) => {
      if (collectionIds !== undefined && Array.isArray(collectionIds)) {
        await tx.collectionProduct.deleteMany({ where: { productId: id } });
        if (collectionIds.length > 0) {
          for (const cId of collectionIds) {
            await tx.collectionProduct.create({
              data: {
                productId: id,
                collectionId: cId,
              },
            });
          }
        }
      }

      return await tx.product.update({
        where: { id },
        data: updateData,
      });
    });
  }

  /**
   * Admin: Soft deletes / archives a product.
   */
  async deleteProduct(id) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw ApplicationError.notFound(`Product with ID "${id}" not found.`);
    }

    await prisma.product.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
        deletedAt: new Date(),
      },
    });

    return { message: `Product "${product.name}" has been archived.` };
  }

  /**
   * Admin: Creates a new product variant.
   */
  async createVariant(productId, data) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw ApplicationError.notFound(`Product "${productId}" not found.`);

    const existingSku = await prisma.productVariant.findUnique({ where: { sku: data.sku } });
    if (existingSku) throw ApplicationError.conflict(`SKU "${data.sku}" already exists.`);

    return await prisma.productVariant.create({
      data: {
        ...data,
        productId,
        availableQuantity: data.stockQuantity,
      },
    });
  }

  /**
   * Admin: Updates an existing variant.
   */
  async updateVariant(productId, variantId, data) {
    const variant = await prisma.productVariant.findFirst({
      where: { id: variantId, productId },
    });
    if (!variant) throw ApplicationError.notFound(`Variant "${variantId}" not found for this piece.`);

    if (data.sku && data.sku !== variant.sku) {
      const duplicate = await prisma.productVariant.findUnique({ where: { sku: data.sku } });
      if (duplicate) throw ApplicationError.conflict(`SKU "${data.sku}" is already in use.`);
    }

    return await prisma.productVariant.update({
      where: { id: variantId },
      data,
    });
  }

  /**
   * Admin: Deletes a variant.
   */
  async deleteVariant(productId, variantId) {
    const variant = await prisma.productVariant.findFirst({
      where: { id: variantId, productId },
    });
    if (!variant) throw ApplicationError.notFound(`Variant "${variantId}" not found.`);

    await prisma.productVariant.delete({ where: { id: variantId } });

    return { message: `Variant ${variant.sku} removed.` };
  }

  /**
   * Admin: Attaches media asset to product / variant.
   */
  async attachMedia(productId, data) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw ApplicationError.notFound(`Product "${productId}" not found.`);

    // If marked as primary, reset existing primary media
    if (data.isPrimary) {
      await prisma.productMedia.updateMany({
        where: { productId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    return await prisma.productMedia.create({
      data: {
        ...data,
        productId,
      },
    });
  }

  /**
   * Admin: Updates media metadata.
   */
  async updateMedia(productId, mediaId, data) {
    const media = await prisma.productMedia.findFirst({
      where: { id: mediaId, productId },
    });
    if (!media) throw ApplicationError.notFound(`Media asset "${mediaId}" not found.`);

    if (data.isPrimary) {
      await prisma.productMedia.updateMany({
        where: { productId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    return await prisma.productMedia.update({
      where: { id: mediaId },
      data,
    });
  }

  /**
   * Admin: Deletes media asset.
   */
  async deleteMedia(productId, mediaId) {
    const media = await prisma.productMedia.findFirst({
      where: { id: mediaId, productId },
    });
    if (!media) throw ApplicationError.notFound(`Media asset "${mediaId}" not found.`);

    await prisma.productMedia.delete({ where: { id: mediaId } });

    return { message: 'Media asset removed.' };
  }
}

export const productService = new ProductService();
export default productService;
