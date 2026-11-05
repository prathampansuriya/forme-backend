import prisma from '../config/prisma.config.js';
import ApplicationError from '../utils/ApplicationError.js';
import cartService from './cart.service.js';
import engagementService from './engagement.service.js';

class WishlistService {
  /**
   * Resolves or creates a customer's Wishlist.
   */
  async getOrCreateWishlist(userId) {
    if (!userId) {
      throw ApplicationError.unauthorized('Authentication required to access wishlist.');
    }

    let wishlist = await prisma.wishlist.findUnique({
      where: { userId },
    });

    if (!wishlist) {
      wishlist = await prisma.wishlist.create({
        data: { userId },
      });
    }

    return wishlist;
  }

  /**
   * Retrieves customer's wishlist with full garment details and live availability.
   */
  async getWishlist(userId) {
    const wishlist = await this.getOrCreateWishlist(userId);

    const items = await prisma.wishlistItem.findMany({
      where: { wishlistId: wishlist.id },
      include: {
        product: {
          include: {
            category: { select: { id: true, name: true, slug: true } },
            media: {
              orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }],
              take: 4,
            },
            variants: {
              where: { status: 'ACTIVE' },
              select: {
                id: true,
                sku: true,
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
      orderBy: { createdAt: 'desc' },
    });

    const formattedItems = items
      .filter((item) => item.product && item.product.status === 'PUBLISHED')
      .map((item) => {
        const p = item.product;
        const inStock = p.variants.some((v) => v.availableQuantity > 0);
        const primaryImage =
          p.media?.find((m) => m.isPrimary)?.secureUrl ||
          p.media?.[0]?.secureUrl ||
          p.media?.[0]?.thumbnailUrl ||
          p.media?.[0]?.url ||
          'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?q=80&w=800&auto=format&fit=crop';

        const sellingPrice = Number(p.sellingPrice);
        const compareAtPrice = p.compareAtPrice ? Number(p.compareAtPrice) : null;

        const productData = {
          id: p.id,
          name: p.name,
          slug: p.slug,
          baseSku: p.baseSku,
          category: p.category,
          sellingPrice,
          basePrice: sellingPrice,
          price: sellingPrice,
          compareAtPrice,
          imageUrl: primaryImage,
          media: p.media,
          inStock,
          variants: p.variants,
        };

        return {
          id: item.id,
          productId: p.id,
          name: p.name,
          slug: p.slug,
          baseSku: p.baseSku,
          category: p.category,
          sellingPrice,
          basePrice: sellingPrice,
          price: sellingPrice,
          compareAtPrice,
          imageUrl: primaryImage,
          inStock,
          variants: p.variants,
          addedAt: item.createdAt,
          product: productData,
        };
      });

    return {
      id: wishlist.id,
      userId: wishlist.userId,
      itemCount: formattedItems.length,
      items: formattedItems,
    };
  }

  /**
   * Adds a product to customer's wishlist.
   */
  async addItem({ userId, productId }) {
    if (!productId) {
      throw ApplicationError.badRequest('Product ID is required.');
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product || product.status !== 'PUBLISHED') {
      throw ApplicationError.notFound('Product not found or currently unavailable.');
    }

    const wishlist = await this.getOrCreateWishlist(userId);

    // Upsert wishlist item
    const wishlistItem = await prisma.wishlistItem.upsert({
      where: {
        wishlistId_productId: {
          wishlistId: wishlist.id,
          productId,
        },
      },
      update: {},
      create: {
        wishlistId: wishlist.id,
        productId,
      },
    });

    // Track engagement
    engagementService.recordWishlistAddition({ productId, userId }).catch(() => {});

    return {
      wishlistItemId: wishlistItem.id,
      productId,
      isWishlisted: true,
    };
  }

  /**
   * Removes a product from customer's wishlist.
   */
  async removeItem({ userId, productId }) {
    const wishlist = await prisma.wishlist.findUnique({
      where: { userId },
    });

    if (!wishlist) {
      return { success: true, isWishlisted: false };
    }

    await prisma.wishlistItem.deleteMany({
      where: {
        wishlistId: wishlist.id,
        productId,
      },
    });

    return { success: true, isWishlisted: false };
  }

  /**
   * Checks whether a specific product is currently wishlisted by the user.
   */
  async isProductWishlisted({ userId, productId }) {
    if (!userId || !productId) return { isWishlisted: false };

    const wishlist = await prisma.wishlist.findUnique({
      where: { userId },
    });

    if (!wishlist) return { isWishlisted: false };

    const count = await prisma.wishlistItem.count({
      where: {
        wishlistId: wishlist.id,
        productId,
      },
    });

    return { isWishlisted: count > 0 };
  }

  /**
   * Moves a wishlisted garment directly into the customer's shopping bag.
   */
  async moveItemToCart({ userId, productId, variantId, quantity = 1 }) {
    if (!productId || !variantId) {
      throw ApplicationError.badRequest('Both product ID and variant ID are required to add to bag.');
    }

    // 1. Verify variant belongs to product
    const variant = await prisma.productVariant.findFirst({
      where: {
        id: variantId,
        productId,
      },
    });

    if (!variant) {
      throw ApplicationError.badRequest('Selected variant does not belong to this garment.', 'INVALID_VARIANT');
    }

    // 2. Add to cart
    const cart = await cartService.addItem({
      userId,
      variantId,
      quantity,
    });

    // 3. Remove from wishlist
    await this.removeItem({ userId, productId });

    return {
      message: 'Garment moved from wishlist to bag successfully.',
      cart,
    };
  }
}

export default new WishlistService();

