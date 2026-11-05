import prisma from '../config/prisma.config.js';
import ApplicationError from '../utils/ApplicationError.js';

class CollectionService {
  /**
   * Retrieves collection listing respecting publication schedule.
   */
  async listCollections({ includeUnpublished = false } = {}) {
    const now = new Date();

    const where = includeUnpublished
      ? {}
      : {
          isPublished: true,
          OR: [
            { scheduleStart: null, scheduleEnd: null },
            { scheduleStart: { lte: now }, scheduleEnd: null },
            { scheduleStart: null, scheduleEnd: { gte: now } },
            { scheduleStart: { lte: now }, scheduleEnd: { gte: now } },
          ],
        };

    const collections = await prisma.collection.findMany({
      where,
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
      include: {
        _count: {
          select: {
            collectionProducts: true,
          },
        },
      },
    });

    return collections.map((col) => ({
      ...col,
      productCount: col._count?.collectionProducts || 0,
    }));
  }

  /**
   * Retrieves single collection by slug or ID with paginated products.
   */
  async getCollectionBySlug(identifier, { page = 1, limit = 12 } = {}) {
    const now = new Date();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

    const collection = await prisma.collection.findFirst({
      where: isUuid ? { id: identifier } : { slug: identifier },
      include: {
        collectionProducts: {
          orderBy: { displayOrder: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            product: {
              include: {
                category: { select: { id: true, name: true, slug: true } },
                media: {
                  where: { isPrimary: true },
                  take: 1,
                  select: { secureUrl: true, thumbnailUrl: true, altText: true },
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
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            collectionProducts: true,
          },
        },
      },
    });

    if (!collection) {
      throw ApplicationError.notFound(`Collection "${identifier}" not found.`);
    }

    const totalProducts = collection._count.collectionProducts;
    const totalPages = Math.ceil(totalProducts / limit);

    return {
      ...collection,
      products: collection.collectionProducts.map((cp) => cp.product),
      pagination: {
        total: totalProducts,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Retrieves the current primary featured collection.
   */
  async getFeaturedCollection() {
    const now = new Date();

    const collection = await prisma.collection.findFirst({
      where: {
        isPublished: true,
        OR: [
          { scheduleStart: null, scheduleEnd: null },
          { scheduleStart: { lte: now }, scheduleEnd: null },
          { scheduleStart: null, scheduleEnd: { gte: now } },
          { scheduleStart: { lte: now }, scheduleEnd: { gte: now } },
        ],
      },
      orderBy: [{ displayOrder: 'asc' }, { updatedAt: 'desc' }],
      include: {
        _count: { select: { collectionProducts: true } },
      },
    });

    if (!collection) {
      return null;
    }

    return {
      ...collection,
      productCount: collection._count?.collectionProducts || 0,
    };
  }

  /**
   * Admin: Creates a new collection.
   */
  async createCollection(data) {
    const existing = await prisma.collection.findUnique({
      where: { slug: data.slug },
    });

    if (existing) {
      throw ApplicationError.conflict(`A collection with slug "${data.slug}" already exists.`);
    }

    return await prisma.collection.create({
      data,
    });
  }

  /**
   * Admin: Updates an existing collection.
   */
  async updateCollection(id, data) {
    const collection = await prisma.collection.findUnique({ where: { id } });
    if (!collection) {
      throw ApplicationError.notFound(`Collection with ID "${id}" not found.`);
    }

    if (data.slug && data.slug !== collection.slug) {
      const duplicate = await prisma.collection.findUnique({ where: { slug: data.slug } });
      if (duplicate) {
        throw ApplicationError.conflict(`Collection slug "${data.slug}" is already taken.`);
      }
    }

    return await prisma.collection.update({
      where: { id },
      data,
    });
  }

  /**
   * Admin: Deletes a collection.
   */
  async deleteCollection(id) {
    const collection = await prisma.collection.findUnique({ where: { id } });
    if (!collection) {
      throw ApplicationError.notFound(`Collection with ID "${id}" not found.`);
    }

    await prisma.collection.delete({ where: { id } });
    return { message: `Collection "${collection.name}" was successfully removed.` };
  }

  /**
   * Admin: Adds products to collection.
   */
  async addProductsToCollection(collectionId, productIds = []) {
    const collection = await prisma.collection.findUnique({ where: { id: collectionId } });
    if (!collection) {
      throw ApplicationError.notFound(`Collection with ID "${collectionId}" not found.`);
    }

    const highest = await prisma.collectionProduct.findFirst({
      where: { collectionId },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true },
    });

    let currentOrder = (highest?.displayOrder || 0) + 1;

    for (const productId of productIds) {
      await prisma.collectionProduct.upsert({
        where: {
          collectionId_productId: { collectionId, productId },
        },
        update: {},
        create: {
          collectionId,
          productId,
          displayOrder: currentOrder++,
        },
      });
    }

    return { message: `Successfully associated ${productIds.length} pieces with collection "${collection.name}".` };
  }

  /**
   * Admin: Removes a product from collection.
   */
  async removeProductFromCollection(collectionId, productId) {
    await prisma.collectionProduct.deleteMany({
      where: { collectionId, productId },
    });
    return { message: 'Piece removed from collection.' };
  }
}

export const collectionService = new CollectionService();
export default collectionService;

