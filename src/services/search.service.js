import prisma from '../config/prisma.config.js';
import productService from './product.service.js';

class SearchService {
  /**
   * Helper: Logs a search query in the database analytics table.
   */
  async _logSearchQuery(term, resultsCount = 0) {
    if (!term || term.length < 2) return;
    const normalized = term.toLowerCase().trim();

    try {
      await prisma.searchQueryLog.upsert({
        where: { query: normalized },
        update: {
          count: { increment: 1 },
          resultsCount,
          updatedAt: new Date(),
        },
        create: {
          query: normalized,
          count: 1,
          resultsCount,
        },
      });
    } catch (err) {
      // Non-blocking for customer experience
    }
  }

  /**
   * Search Autocomplete: Returns instant suggestions for products, categories, and collections.
   */
  async autocomplete(query) {
    const term = (query || '').trim();
    if (!term) {
      return { products: [], categories: [], collections: [] };
    }

    const [products, categories, collections] = await Promise.all([
      prisma.product.findMany({
        where: {
          status: 'PUBLISHED',
          deletedAt: null,
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { productType: { contains: term, mode: 'insensitive' } },
            { tags: { has: term } },
          ],
        },
        take: 5,
        select: {
          id: true,
          name: true,
          slug: true,
          sellingPrice: true,
          compareAtPrice: true,
          productType: true,
          media: {
            where: { isPrimary: true },
            take: 1,
            select: { secureUrl: true, thumbnailUrl: true },
          },
        },
      }),
      prisma.category.findMany({
        where: {
          status: 'ACTIVE',
          name: { contains: term, mode: 'insensitive' },
        },
        take: 3,
        select: {
          id: true,
          name: true,
          slug: true,
          thumbnailUrl: true,
          _count: { select: { products: { where: { status: 'PUBLISHED', deletedAt: null } } } },
        },
      }),
      prisma.collection.findMany({
        where: {
          isPublished: true,
          name: { contains: term, mode: 'insensitive' },
        },
        take: 2,
        select: {
          id: true,
          name: true,
          slug: true,
          thumbnailUrl: true,
        },
      }),
    ]);

    return {
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        productType: p.productType,
        price: Number(p.sellingPrice),
        sellingPrice: Number(p.sellingPrice),
        compareAtPrice: p.compareAtPrice ? Number(p.compareAtPrice) : null,
        thumbnailUrl: p.media[0]?.thumbnailUrl || p.media[0]?.secureUrl || null,
        primaryImageUrl: p.media[0]?.secureUrl || p.media[0]?.thumbnailUrl || null,
      })),
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        thumbnailUrl: c.thumbnailUrl,
        productCount: c._count.products,
      })),
      collections: collections.map((col) => ({
        id: col.id,
        name: col.name,
        slug: col.slug,
        thumbnailUrl: col.thumbnailUrl,
      })),
    };
  }

  /**
   * Search Products: Full text database search with filtering, sorting, and analytics.
   */
  async searchProducts({ q, page = 1, limit = 12, category, collection, minPrice, maxPrice, sort = 'relevance' }) {
    const term = (q || '').trim();

    // Map relevance sort to default or best sellers
    const effectiveSort = sort === 'relevance' ? 'popularity' : sort;

    const result = await productService.listProducts({
      search: term,
      page,
      limit,
      category,
      collection,
      minPrice,
      maxPrice,
      sort: effectiveSort,
    });

    // Record search query analytics asynchronously
    this._logSearchQuery(term, result.pagination.total);

    return {
      query: term,
      ...result,
    };
  }

  /**
   * Search Categories: Finds categories matching query.
   */
  async searchCategories(query) {
    const term = (query || '').trim();
    if (!term) return [];

    const categories = await prisma.category.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { slug: { contains: term, mode: 'insensitive' } },
        ],
      },
      include: {
        _count: { select: { products: { where: { status: 'PUBLISHED', deletedAt: null } } } },
      },
      take: 10,
    });

    return categories.map((c) => ({
      ...c,
      productCount: c._count.products,
    }));
  }

  /**
   * Search Collections: Finds collections matching query.
   */
  async searchCollections(query) {
    const term = (query || '').trim();
    if (!term) return [];

    const collections = await prisma.collection.findMany({
      where: {
        isPublished: true,
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { slug: { contains: term, mode: 'insensitive' } },
        ],
      },
      include: {
        _count: { select: { collectionProducts: true } },
      },
      take: 10,
    });

    return collections.map((col) => ({
      ...col,
      productCount: col._count.collectionProducts,
    }));
  }

  /**
   * Generates search suggestions based on product types, tags, and category names.
   */
  async getSuggestions(query) {
    const term = (query || '').trim();
    if (!term) return [];

    const [products, categories] = await Promise.all([
      prisma.product.findMany({
        where: {
          status: 'PUBLISHED',
          deletedAt: null,
          OR: [
            { productType: { contains: term, mode: 'insensitive' } },
            { tags: { has: term } },
            { fabric: { contains: term, mode: 'insensitive' } },
          ],
        },
        select: { productType: true, tags: true, fabric: true },
        take: 20,
      }),
      prisma.category.findMany({
        where: {
          status: 'ACTIVE',
          name: { contains: term, mode: 'insensitive' },
        },
        select: { name: true },
        take: 5,
      }),
    ]);

    const suggestions = new Set();

    categories.forEach((c) => suggestions.add(c.name));
    products.forEach((p) => {
      if (p.productType && p.productType.toLowerCase().includes(term.toLowerCase())) {
        suggestions.add(p.productType);
      }
      if (p.fabric && p.fabric.toLowerCase().includes(term.toLowerCase())) {
        suggestions.add(p.fabric);
      }
      (p.tags || []).forEach((t) => {
        if (t.toLowerCase().includes(term.toLowerCase())) {
          suggestions.add(t);
        }
      });
    });

    return Array.from(suggestions).slice(0, 8);
  }

  /**
   * Popular Searches: Returns top searched terms based on actual search analytics.
   */
  async getPopularSearches({ limit = 8 } = {}) {
    const popular = await prisma.searchQueryLog.findMany({
      where: { resultsCount: { gt: 0 } },
      orderBy: { count: 'desc' },
      take: limit,
      select: {
        query: true,
        count: true,
        resultsCount: true,
      },
    });

    return popular;
  }
}

export const searchService = new SearchService();
export default searchService;
