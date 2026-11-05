import prisma from '../config/prisma.config.js';
import ApplicationError from '../utils/ApplicationError.js';
import pricingService from './pricing.service.js';
import engagementService from './engagement.service.js';
import { logger } from '../config/logger.config.js';

class CartService {
  /**
   * Resolves or creates a Cart for an authenticated user or guest session.
   */
  async getOrCreateCart({ userId = null, guestSessionId = null }) {
    if (!userId && !guestSessionId) {
      throw ApplicationError.badRequest('Either authenticated user or guest session is required for cart access.');
    }

    if (userId) {
      let cart = await prisma.cart.findUnique({
        where: { userId },
      });
      if (!cart) {
        cart = await prisma.cart.create({
          data: { userId },
        });
      }
      return cart;
    }

    let cart = await prisma.cart.findUnique({
      where: { guestSessionId },
    });
    if (!cart) {
      cart = await prisma.cart.create({
        data: { guestSessionId },
      });
    }
    return cart;
  }

  /**
   * Retrieves the full cart with variant and product details, live stock checks,
   * and server-authoritative pricing calculations.
   */
  async getCart({ userId = null, guestSessionId = null, couponCodeOverride = undefined, shippingAddress = null, stateCode = null }) {
    const cart = await this.getOrCreateCart({ userId, guestSessionId });

    // Fetch cart items with complete variant and product metadata
    const cartItems = await prisma.cartItem.findMany({
      where: { cartId: cart.id },
      include: {
        variant: {
          include: {
            product: {
              include: {
                category: { select: { id: true, name: true, slug: true } },
                media: {
                  orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }],
                  take: 5,
                },
              },
            },
            media: {
              orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }],
              take: 5,
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (cartItems.length === 0) {
      const emptyPricing = pricingService._getEmptyPricingBreakdown();
      return {
        id: cart.id,
        userId: cart.userId,
        guestSessionId: cart.guestSessionId,
        couponCode: cart.couponCode,
        items: [],
        pricing: emptyPricing,
        stockValidation: {
          isValid: true,
          hasStockIssues: false,
          issues: [],
        },
      };
    }

    // 1. Live stock and variant validation
    const stockIssues = [];
    const formattedItems = [];
    const pricingItems = [];

    for (const item of cartItems) {
      const { variant } = item;
      const product = variant?.product;

      let isAvailable = true;
      let stockIssue = null;

      if (!variant || variant.status !== 'ACTIVE' || !product || product.status !== 'PUBLISHED') {
        isAvailable = false;
        stockIssue = {
          itemId: item.id,
          variantId: item.variantId,
          productName: product?.name || 'Garment Unavailable',
          reason: 'This garment variant is no longer available.',
          code: 'VARIANT_UNAVAILABLE',
        };
      } else if (variant.availableQuantity <= 0) {
        isAvailable = false;
        stockIssue = {
          itemId: item.id,
          variantId: variant.id,
          productName: product.name,
          sku: variant.sku,
          size: variant.size,
          color: variant.colorName,
          requestedQuantity: item.quantity,
          availableQuantity: 0,
          reason: `Size ${variant.size} (${variant.colorName}) is currently out of stock.`,
          code: 'OUT_OF_STOCK',
        };
      } else if (item.quantity > variant.availableQuantity) {
        isAvailable = false;
        stockIssue = {
          itemId: item.id,
          variantId: variant.id,
          productName: product.name,
          sku: variant.sku,
          size: variant.size,
          color: variant.colorName,
          requestedQuantity: item.quantity,
          availableQuantity: variant.availableQuantity,
          reason: `Only ${variant.availableQuantity} unit(s) available for Size ${variant.size} (${variant.colorName}).`,
          code: 'INSUFFICIENT_STOCK',
        };
      }

      if (stockIssue) {
        stockIssues.push(stockIssue);
      }

      // Format line item with color-variant specific Cloudinary image
      const variantImage =
        variant.media?.[0]?.secureUrl ||
        variant.media?.[0]?.thumbnailUrl ||
        variant.media?.[0]?.url;
      const productImage =
        product?.media?.find((m) => m.isPrimary)?.secureUrl ||
        product?.media?.[0]?.secureUrl ||
        product?.media?.[0]?.thumbnailUrl ||
        product?.media?.[0]?.url;

      const primaryImage =
        variantImage ||
        productImage ||
        'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?q=80&w=800&auto=format&fit=crop';

      formattedItems.push({
        id: item.id,
        variantId: item.variantId,
        productId: product?.id,
        productName: product?.name || 'Garment',
        productSlug: product?.slug || '',
        category: product?.category || null,
        sku: variant?.sku || '',
        size: variant?.size || '',
        colorName: variant?.colorName || '',
        colorHex: variant?.colorHex || '',
        imageUrl: primaryImage,
        quantity: item.quantity,
        availableQuantity: variant?.availableQuantity || 0,
        isAvailable,
        stockIssue: stockIssue ? stockIssue.code : null,
      });

      // Prepare for authoritative pricing calculation
      pricingItems.push({
        variantId: item.variantId,
        quantity: item.quantity,
      });
    }

    // 2. Authoritative Pricing Engine Execution
    const effectiveCouponCode =
      couponCodeOverride !== undefined && couponCodeOverride !== null
        ? couponCodeOverride
        : cart.couponCode;

    let pricingBreakdown;
    let couponError = null;

    try {
      pricingBreakdown = await pricingService.calculateCartPricing({
        items: pricingItems,
        couponCode: effectiveCouponCode,
        customerId: userId,
        shippingAddress,
        stateCode,
      });
    } catch (err) {
      // If coupon validation failed during pricing, calculate without coupon and attach notification
      if (effectiveCouponCode && (err.code === 'INVALID_COUPON' || err.code === 'MIN_PURCHASE_NOT_MET' || err.code === 'COUPON_EXPIRED')) {
        couponError = {
          code: err.code,
          message: err.message,
        };
        pricingBreakdown = await pricingService.calculateCartPricing({
          items: pricingItems,
          couponCode: null,
          customerId: userId,
          shippingAddress,
          stateCode,
        });
      } else {
        throw err;
      }
    }

    // Merge calculated line item prices into formatted items
    const enrichedItems = formattedItems.map((fi) => {
      const calculatedLine = pricingBreakdown.items.find((pi) => pi.variantId === fi.variantId);
      return {
        ...fi,
        unitSellingPrice: calculatedLine ? calculatedLine.unitSellingPrice : 0,
        unitCompareAtPrice: calculatedLine ? calculatedLine.unitCompareAtPrice : null,
        lineEffectiveSubtotal: calculatedLine ? calculatedLine.lineEffectiveSubtotal : 0,
        lineMrpSubtotal: calculatedLine ? calculatedLine.lineMrpSubtotal : 0,
        lineSavings: calculatedLine ? calculatedLine.lineSavings : 0,
        lineTax: calculatedLine ? calculatedLine.lineTax : 0,
        lineTotal: calculatedLine ? calculatedLine.lineTotal : 0,
        appliedPromotion: calculatedLine ? calculatedLine.appliedPromotion : null,
      };
    });

    return {
      id: cart.id,
      userId: cart.userId,
      guestSessionId: cart.guestSessionId,
      couponCode: cart.couponCode,
      couponError,
      items: enrichedItems,
      pricing: pricingBreakdown,
      stockValidation: {
        isValid: stockIssues.length === 0,
        hasStockIssues: stockIssues.length > 0,
        issues: stockIssues,
      },
    };
  }

  /**
   * Adds an item to the cart after validating product, variant, and live inventory.
   */
  async addItem({ userId = null, guestSessionId = null, variantId, quantity = 1 }) {
    if (!variantId) {
      throw ApplicationError.badRequest('Variant ID is required.', 'MISSING_VARIANT');
    }
    if (quantity < 1) {
      throw ApplicationError.badRequest('Quantity must be at least 1.', 'INVALID_QUANTITY');
    }

    // 1. Fetch and validate variant and product existence
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: true },
    });

    if (!variant) {
      throw ApplicationError.notFound('Product variant not found.', 'VARIANT_NOT_FOUND');
    }
    if (variant.status !== 'ACTIVE') {
      throw ApplicationError.badRequest('This product variant is currently not available for purchase.', 'VARIANT_INACTIVE');
    }
    if (!variant.product || variant.product.status !== 'PUBLISHED') {
      throw ApplicationError.badRequest('This product is currently unavailable.', 'PRODUCT_UNAVAILABLE');
    }

    const cart = await this.getOrCreateCart({ userId, guestSessionId });

    // 2. Check existing item in cart
    const existingItem = await prisma.cartItem.findUnique({
      where: {
        cartId_variantId: {
          cartId: cart.id,
          variantId,
        },
      },
    });

    const currentQtyInCart = existingItem ? existingItem.quantity : 0;
    const requestedTotalQty = currentQtyInCart + quantity;

    // 3. Stock validation
    if (requestedTotalQty > variant.availableQuantity) {
      throw ApplicationError.badRequest(
        `Cannot add ${quantity} unit(s). Only ${variant.availableQuantity} unit(s) are available in stock (you already have ${currentQtyInCart} in your bag).`,
        'INSUFFICIENT_STOCK'
      );
    }

    // 4. Upsert item
    if (existingItem) {
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: requestedTotalQty },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          variantId,
          quantity,
        },
      });
    }

    // 5. Track Engagement Event
    engagementService.recordCartAddition({
      productId: variant.productId,
      variantId,
      quantity,
      userId,
      sessionId: guestSessionId,
    }).catch(() => {});

    // 6. Return fresh cart
    return this.getCart({ userId, guestSessionId });
  }

  /**
   * Updates line item quantity. If quantity <= 0, the item is removed.
   */
  async updateItemQuantity({ userId = null, guestSessionId = null, itemId, quantity }) {
    if (quantity < 0) {
      throw ApplicationError.badRequest('Quantity cannot be negative.', 'INVALID_QUANTITY');
    }

    const cart = await this.getOrCreateCart({ userId, guestSessionId });

    const cartItem = await prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cartId: cart.id,
      },
      include: { variant: true },
    });

    if (!cartItem) {
      throw ApplicationError.notFound('Cart item not found in your bag.', 'CART_ITEM_NOT_FOUND');
    }

    // If quantity is 0, remove item
    if (quantity === 0) {
      await prisma.cartItem.delete({
        where: { id: cartItem.id },
      });
      return this.getCart({ userId, guestSessionId });
    }

    // Stock validation
    if (quantity > cartItem.variant.availableQuantity) {
      throw ApplicationError.badRequest(
        `Only ${cartItem.variant.availableQuantity} unit(s) available in stock.`,
        'INSUFFICIENT_STOCK'
      );
    }

    await prisma.cartItem.update({
      where: { id: cartItem.id },
      data: { quantity },
    });

    return this.getCart({ userId, guestSessionId });
  }

  /**
   * Removes a specific item from the cart.
   */
  async removeItem({ userId = null, guestSessionId = null, itemId }) {
    const cart = await this.getOrCreateCart({ userId, guestSessionId });

    const cartItem = await prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cartId: cart.id,
      },
    });

    if (!cartItem) {
      throw ApplicationError.notFound('Cart item not found in your bag.', 'CART_ITEM_NOT_FOUND');
    }

    await prisma.cartItem.delete({
      where: { id: cartItem.id },
    });

    return this.getCart({ userId, guestSessionId });
  }

  /**
   * Clears all items from the cart.
   */
  async clearCart({ userId = null, guestSessionId = null }) {
    const cart = await this.getOrCreateCart({ userId, guestSessionId });

    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    await prisma.cart.update({
      where: { id: cart.id },
      data: { couponCode: null },
    });

    return this.getCart({ userId, guestSessionId });
  }

  /**
   * Validates and applies a coupon code to the cart.
   */
  async applyCoupon({ userId = null, guestSessionId = null, couponCode }) {
    if (!couponCode || !couponCode.trim()) {
      throw ApplicationError.badRequest('Coupon code is required.', 'INVALID_COUPON');
    }

    const normalizedCode = couponCode.trim().toUpperCase();
    const cart = await this.getOrCreateCart({ userId, guestSessionId });

    const cartItems = await prisma.cartItem.findMany({
      where: { cartId: cart.id },
      select: { variantId: true, quantity: true },
    });

    if (cartItems.length === 0) {
      throw ApplicationError.badRequest('Cannot apply coupon to an empty bag.', 'EMPTY_CART');
    }

    // Validate coupon against current cart contents using Pricing Engine
    await pricingService.calculateCartPricing({
      items: cartItems,
      couponCode: normalizedCode,
      customerId: userId,
    });

    // Save coupon to Cart
    await prisma.cart.update({
      where: { id: cart.id },
      data: { couponCode: normalizedCode },
    });

    return this.getCart({ userId, guestSessionId });
  }

  /**
   * Removes applied coupon from the cart.
   */
  async removeCoupon({ userId = null, guestSessionId = null }) {
    const cart = await this.getOrCreateCart({ userId, guestSessionId });

    await prisma.cart.update({
      where: { id: cart.id },
      data: { couponCode: null },
    });

    return this.getCart({ userId, guestSessionId });
  }

  /**
   * Explicitly validates live stock for all items in the cart.
   */
  async validateCartStock({ userId = null, guestSessionId = null }) {
    const fullCart = await this.getCart({ userId, guestSessionId });
    return fullCart.stockValidation;
  }

  /**
   * Merges a guest cart into an authenticated customer's cart upon login.
   */
  async mergeGuestCart({ userId, guestSessionId }) {
    if (!userId || !guestSessionId) {
      throw ApplicationError.badRequest('User ID and guest session ID are required to merge carts.');
    }

    const guestCart = await prisma.cart.findUnique({
      where: { guestSessionId },
      include: { items: true },
    });

    if (!guestCart || guestCart.items.length === 0) {
      // Nothing to merge; return customer's current cart
      return this.getCart({ userId });
    }

    const userCart = await this.getOrCreateCart({ userId });

    // Migrate each item from guest cart to user cart
    for (const gItem of guestCart.items) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: gItem.variantId },
      });

      if (!variant || variant.status !== 'ACTIVE') continue;

      const existingUserItem = await prisma.cartItem.findUnique({
        where: {
          cartId_variantId: {
            cartId: userCart.id,
            variantId: gItem.variantId,
          },
        },
      });

      if (existingUserItem) {
        const combinedQty = Math.min(variant.availableQuantity, existingUserItem.quantity + gItem.quantity);
        await prisma.cartItem.update({
          where: { id: existingUserItem.id },
          data: { quantity: combinedQty },
        });
      } else {
        const initialQty = Math.min(variant.availableQuantity, gItem.quantity);
        if (initialQty > 0) {
          await prisma.cartItem.create({
            data: {
              cartId: userCart.id,
              variantId: gItem.variantId,
              quantity: initialQty,
            },
          });
        }
      }
    }

    // Migrate coupon if user cart has none
    if (!userCart.couponCode && guestCart.couponCode) {
      await prisma.cart.update({
        where: { id: userCart.id },
        data: { couponCode: guestCart.couponCode },
      });
    }

    // Delete guest cart
    await prisma.cartItem.deleteMany({ where: { cartId: guestCart.id } });
    await prisma.cart.delete({ where: { id: guestCart.id } });

    logger.info(`[CART MERGE] Successfully merged guest cart ${guestCart.id} into user cart ${userCart.id}`);
    return this.getCart({ userId });
  }
}

export default new CartService();

