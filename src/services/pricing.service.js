import prisma from '../config/prisma.config.js';
import ApplicationError from '../utils/ApplicationError.js';
import {
  round2,
  toDecimal,
  add,
  sub,
  mul,
  div,
  calcPercentage,
  minDecimal,
  maxDecimal,
  formatCurrency,
  allocateProportionally,
} from '../utils/pricingMath.js';
import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;

// Default store home state for Indian GST (Intra-state vs Inter-state)
export const STORE_HOME_STATE = 'MH';
export const DEFAULT_GST_RATE = 12.0; // 12% luxury apparel standard GST in India

// Bidirectional Indian States & Union Territories Map
export const INDIAN_STATES_MAP = {
  // States
  'ANDHRA PRADESH': 'AP',
  'ARUNACHAL PRADESH': 'AR',
  'ASSAM': 'AS',
  'BIHAR': 'BR',
  'CHHATTISGARH': 'CG',
  'GOA': 'GA',
  'GUJARAT': 'GJ',
  'HARYANA': 'HR',
  'HIMACHAL PRADESH': 'HP',
  'JHARKHAND': 'JH',
  'KARNATAKA': 'KA',
  'KERALA': 'KL',
  'MADHYA PRADESH': 'MP',
  'MAHARASHTRA': 'MH',
  'MANIPUR': 'MN',
  'MEGHALAYA': 'ML',
  'MIZORAM': 'MZ',
  'NAGALAND': 'NL',
  'ODISHA': 'OD',
  'PUNJAB': 'PB',
  'RAJASTHAN': 'RJ',
  'SIKKIM': 'SK',
  'TAMIL NADU': 'TN',
  'TELANGANA': 'TS',
  'TRIPURA': 'TR',
  'UTTAR PRADESH': 'UP',
  'UTTARAKHAND': 'UK',
  'WEST BENGAL': 'WB',
  // Union Territories
  'ANDAMAN AND NICOBAR ISLANDS': 'AN',
  'CHANDIGARH': 'CH',
  'DADRA AND NAGAR HAVELI AND DAMAN AND DIU': 'DH',
  'DELHI': 'DL',
  'JAMMU AND KASHMIR': 'JK',
  'LADAKH': 'LA',
  'LAKSHADWEEP': 'LD',
  'PUDUCHERRY': 'PY',
};

// Reverse map: code -> standardized name
export const INDIAN_STATE_NAMES = Object.entries(INDIAN_STATES_MAP).reduce((acc, [name, code]) => {
  acc[code] = name;
  return acc;
}, {
  TG: 'TELANGANA', // alternate GST code for Telangana
});

export class PricingService {
  /**
   * Resolves Indian State Code and Inter-State Tax Status.
   * Prevents incorrect default fallback to MH when a valid state name or code is supplied.
   *
   * @param {string|null} input - State name or state code
   * @returns {{ stateCode: string, stateName: string, isInterState: boolean }}
   */
  resolveIndianStateCode(input) {
    if (!input || typeof input !== 'string') {
      return {
        stateCode: STORE_HOME_STATE,
        stateName: INDIAN_STATE_NAMES[STORE_HOME_STATE] || 'MAHARASHTRA',
        isInterState: false,
      };
    }

    const trimmed = input.trim().toUpperCase();
    if (!trimmed) {
      return {
        stateCode: STORE_HOME_STATE,
        stateName: INDIAN_STATE_NAMES[STORE_HOME_STATE] || 'MAHARASHTRA',
        isInterState: false,
      };
    }

    // Direct 2-letter state code match
    if (trimmed.length === 2) {
      const code = trimmed === 'TG' ? 'TS' : trimmed;
      const stateName = INDIAN_STATE_NAMES[code] || code;
      const isInterState = code !== STORE_HOME_STATE;
      return { stateCode: code, stateName, isInterState };
    }

    // Full name or fuzzy match
    if (INDIAN_STATES_MAP[trimmed]) {
      const code = INDIAN_STATES_MAP[trimmed];
      return { stateCode: code, stateName: trimmed, isInterState: code !== STORE_HOME_STATE };
    }

    // Partial substring match in case of variations (e.g. "Gujarat State")
    for (const [name, code] of Object.entries(INDIAN_STATES_MAP)) {
      if (trimmed.includes(name) || name.includes(trimmed)) {
        return { stateCode: code, stateName: name, isInterState: code !== STORE_HOME_STATE };
      }
    }

    // Fallback if unrecognized
    return {
      stateCode: trimmed,
      stateName: trimmed,
      isInterState: trimmed !== STORE_HOME_STATE,
    };
  }

  /**
   * Determine item-level promotional discount and winner based on strict priority and stacking rules.
   *
   * Deterministic Priority Hierarchy:
   * 1. Flash Sale (Priority 5, highest priority)
   * 2. Product-specific offer (Priority 4)
   * 3. Category-specific offer (Priority 3)
   * 4. Collection-specific offer (Priority 2)
   * 5. Storewide offer (Priority 1)
   *
   * Stacking Rules:
   * - By default, ordinary offers and flash sales do NOT stack on the same item (`allowStacking=false`). Flash sale wins.
   * - When `allowStacking=true`:
   *     Flash sale applies first on baseSellingPrice.
   *     Post-flash price = baseSellingPrice - flashSaleDiscount.
   *     Offer discount is recalculated on post-flash price.
   *     Total promotional discount = flashSaleDiscount + offerDiscount.
   *
   * @param {Object} params
   * @param {Object} params.product - Product record with category and collections
   * @param {Object} params.variant - ProductVariant record
   * @param {Array} params.activeFlashSales - Preloaded active flash sales
   * @param {Array} params.activeOffers - Preloaded active offers
   * @param {Date} params.now - Current timestamp
   * @returns {Object} { offerDiscount, flashSaleDiscount, appliedPromotion }
   */
  resolveItemPromotions({ product, variant, activeFlashSales = [], activeOffers = [], now = new Date() }) {
    const baseSellingPrice = variant?.priceOverride != null ? toDecimal(variant.priceOverride) : toDecimal(product.sellingPrice);
    const categoryId = product.categoryId;
    const collectionIds = [
      ...(product.collectionProducts || []).map((cp) => cp.collectionId || cp.collection?.id),
      ...(product.collections || []).map((c) => c.id || c.collectionId),
      ...(product.collectionIds || []),
    ].filter(Boolean);

    let flashSaleDiscount = new Decimal(0);
    let winningFlashSale = null;

    // 1. Check Flash Sale (Priority 5 - Highest)
    for (const fs of activeFlashSales) {
      if (fs.status !== 'ACTIVE') continue;
      const startTime = new Date(fs.startTime);
      const endTime = new Date(fs.endTime);
      if (now < startTime || now > endTime) continue;

      // Find matching product/variant in flash sale
      const match = (fs.products || []).find((fsp) => {
        if (fsp.productId !== product.id) return false;
        if (fsp.variantId && variant?.id && fsp.variantId !== variant.id) return false;
        // Check stock limit if configured
        if (fsp.stockLimit > 0 && fsp.soldCount >= fsp.stockLimit) return false;
        return true;
      });

      if (match) {
        let disc = new Decimal(0);
        if (match.discountType === 'PERCENTAGE') {
          disc = calcPercentage(baseSellingPrice, match.discountValue);
        } else {
          disc = minDecimal(toDecimal(match.discountValue), baseSellingPrice);
        }

        if (disc.greaterThan(flashSaleDiscount)) {
          flashSaleDiscount = disc;
          winningFlashSale = {
            id: fs.id,
            flashSaleId: fs.id,
            name: fs.name,
            slug: fs.slug,
            type: 'FLASH_SALE',
            promotionType: 'FLASH_SALE',
            discountType: match.discountType,
            discountValue: Number(match.discountValue),
            discountAmount: round2(disc),
            badge: match.discountType === 'PERCENTAGE' ? `${match.discountValue}% OFF FLASH` : `₹${match.discountValue} OFF`,
            endTime: fs.endTime,
            countdownEndTimestamp: new Date(fs.endTime).getTime(),
          };
        }
      }
    }

    // 2. Check Offers (Product > Category > Collection > Storewide)
    let offerDiscount = new Decimal(0);
    let winningOffer = null;
    let winningOfferRaw = null;
    let highestOfferTier = 0; // 4 = product, 3 = category, 2 = collection, 1 = storewide

    for (const offer of activeOffers) {
      if (!offer.isActive) continue;
      const startDate = new Date(offer.startDate);
      const endDate = new Date(offer.endDate);
      if (now < startDate || now > endDate) continue;

      let tier = 0;
      let isApplicable = false;

      // Product-specific check (Tier 4)
      if (offer.applicableProducts && offer.applicableProducts.length > 0) {
        if (offer.applicableProducts.some((ap) => ap.productId === product.id)) {
          tier = 4;
          isApplicable = true;
        }
      }

      // Category-specific check (Tier 3)
      if (!isApplicable && offer.applicableCategories && offer.applicableCategories.length > 0) {
        if (offer.applicableCategories.some((ac) => ac.categoryId === categoryId)) {
          tier = 3;
          isApplicable = true;
        }
      }

      // Collection-specific check (Tier 2)
      if (!isApplicable && offer.applicableCollections && offer.applicableCollections.length > 0) {
        if (offer.applicableCollections.some((ac) => collectionIds.includes(ac.collectionId))) {
          tier = 2;
          isApplicable = true;
        }
      }

      // Storewide check (Tier 1)
      if (
        !isApplicable &&
        (!offer.applicableProducts || offer.applicableProducts.length === 0) &&
        (!offer.applicableCategories || offer.applicableCategories.length === 0) &&
        (!offer.applicableCollections || offer.applicableCollections.length === 0)
      ) {
        tier = 1;
        isApplicable = true;
      }

      if (isApplicable) {
        let disc = new Decimal(0);
        if (offer.discountType === 'PERCENTAGE') {
          disc = calcPercentage(baseSellingPrice, offer.discountValue);
          if (offer.maxDiscountAmount != null) {
            disc = minDecimal(disc, toDecimal(offer.maxDiscountAmount));
          }
        } else {
          disc = minDecimal(toDecimal(offer.discountValue), baseSellingPrice);
        }

        // Deterministic winner selection:
        // 1. Higher tier wins (Tier 4 > Tier 3 > Tier 2 > Tier 1)
        // 2. If same tier: higher discount amount wins
        // 3. If tied: allowStacking = true wins, then higher discountValue
        const isBetter =
          tier > highestOfferTier ||
          (tier === highestOfferTier && disc.greaterThan(offerDiscount)) ||
          (tier === highestOfferTier &&
            disc.equals(offerDiscount) &&
            !winningOffer?.allowStacking &&
            offer.allowStacking);

        if (isBetter) {
          highestOfferTier = tier;
          offerDiscount = disc;
          winningOfferRaw = offer;
          winningOffer = {
            id: offer.id,
            name: offer.name,
            slug: offer.slug,
            type: 'OFFER',
            promotionType:
              tier === 4
                ? 'PRODUCT_OFFER'
                : tier === 3
                ? 'CATEGORY_OFFER'
                : tier === 2
                ? 'COLLECTION_OFFER'
                : 'STOREWIDE_OFFER',
            discountType: offer.discountType,
            discountValue: Number(offer.discountValue),
            discountAmount: round2(disc),
            allowStacking: Boolean(offer.allowStacking),
            badge: offer.discountType === 'PERCENTAGE' ? `${offer.discountValue}% OFF` : `₹${offer.discountValue} OFF`,
            endTime: offer.endDate,
            countdownEndTimestamp: new Date(offer.endDate).getTime(),
            description: offer.description,
          };
        }
      }
    }

    // 3. Stacking & Conflict Resolution between Flash Sale and Offer
    if (!flashSaleDiscount.isZero() && !offerDiscount.isZero()) {
      if (winningOffer?.allowStacking) {
        // Stacking permitted:
        // Flash sale applies first on baseSellingPrice.
        // Offer percentage is recalculated against post-flash-sale price.
        const postFlashPrice = sub(baseSellingPrice, flashSaleDiscount);
        let recalculatedOfferDiscount = new Decimal(0);

        if (winningOfferRaw.discountType === 'PERCENTAGE') {
          recalculatedOfferDiscount = calcPercentage(postFlashPrice, winningOfferRaw.discountValue);
          if (winningOfferRaw.maxDiscountAmount != null) {
            recalculatedOfferDiscount = minDecimal(recalculatedOfferDiscount, toDecimal(winningOfferRaw.maxDiscountAmount));
          }
        } else {
          recalculatedOfferDiscount = minDecimal(toDecimal(winningOfferRaw.discountValue), postFlashPrice);
        }

        recalculatedOfferDiscount = minDecimal(recalculatedOfferDiscount, postFlashPrice);

        return {
          flashSaleDiscount: round2(flashSaleDiscount),
          offerDiscount: round2(recalculatedOfferDiscount),
          appliedPromotion: {
            type: 'STACKED',
            promotionType: 'STACKED',
            badge: `${winningFlashSale.badge} + ${winningOffer.badge}`,
            totalDiscount: round2(add(flashSaleDiscount, recalculatedOfferDiscount)),
            flashSale: winningFlashSale,
            offer: {
              ...winningOffer,
              discountAmount: round2(recalculatedOfferDiscount),
            },
            endTime: winningFlashSale.endTime,
            countdownEndTimestamp: winningFlashSale.countdownEndTimestamp,
          },
        };
      } else {
        // Flash sale has deterministic priority over ordinary offers when stacking is disabled
        return {
          flashSaleDiscount: round2(flashSaleDiscount),
          offerDiscount: new Decimal(0),
          appliedPromotion: winningFlashSale,
        };
      }
    }

    if (!flashSaleDiscount.isZero()) {
      return {
        flashSaleDiscount: round2(flashSaleDiscount),
        offerDiscount: new Decimal(0),
        appliedPromotion: winningFlashSale,
      };
    }

    if (!offerDiscount.isZero()) {
      return {
        flashSaleDiscount: new Decimal(0),
        offerDiscount: round2(offerDiscount),
        appliedPromotion: winningOffer,
      };
    }

    return {
      flashSaleDiscount: new Decimal(0),
      offerDiscount: new Decimal(0),
      appliedPromotion: null,
    };
  }

  /**
   * Calculate single product/variant price with active promotions.
   * Authoritative calculation used for PDP, cards, and variant selectors.
   *
   * @param {Object} params
   * @param {Object} params.product
   * @param {Object} [params.variant]
   * @param {Array} [params.activeFlashSales]
   * @param {Array} [params.activeOffers]
   * @param {Date} [params.now]
   * @returns {Object} Authoritative price summary
   */
  calculateItemPrice({ product, variant = null, activeFlashSales = [], activeOffers = [], now = new Date() }) {
    // 1. Compare-At / MRP Price
    let compareAtPrice = null;
    if (variant?.compareAtPriceOverride != null) {
      compareAtPrice = toDecimal(variant.compareAtPriceOverride);
    } else if (product?.compareAtPrice != null) {
      compareAtPrice = toDecimal(product.compareAtPrice);
    }

    // 2. Base Selling Price
    const baseSellingPrice =
      variant?.priceOverride != null ? toDecimal(variant.priceOverride) : toDecimal(product.sellingPrice);

    // If no compareAtPrice specified, effective MRP equals baseSellingPrice (0% markdown)
    const effectiveMrp = compareAtPrice != null && compareAtPrice.greaterThan(baseSellingPrice)
      ? compareAtPrice
      : baseSellingPrice;

    // 3. Promotional discounts
    const { flashSaleDiscount, offerDiscount, appliedPromotion } = this.resolveItemPromotions({
      product,
      variant,
      activeFlashSales,
      activeOffers,
      now,
    });

    // 4. Effective Selling Price
    const totalPromotionalDiscount = add(flashSaleDiscount, offerDiscount);
    const effectiveSellingPrice = maxDecimal(new Decimal(0), sub(baseSellingPrice, totalPromotionalDiscount));

    // 5. Total Savings from MRP
    const totalSavings = maxDecimal(new Decimal(0), sub(effectiveMrp, effectiveSellingPrice));
    const discountPercentage = effectiveMrp.greaterThan(0)
      ? round2(totalSavings.dividedBy(effectiveMrp).times(100)).toNumber()
      : 0;

    return {
      mrp: round2(effectiveMrp),
      compareAtPrice: compareAtPrice ? round2(compareAtPrice) : null,
      baseSellingPrice: round2(baseSellingPrice),
      sellingPrice: round2(effectiveSellingPrice),
      effectiveSellingPrice: round2(effectiveSellingPrice),
      productDiscount: maxDecimal(new Decimal(0), sub(effectiveMrp, baseSellingPrice)),
      offerDiscount: round2(offerDiscount),
      flashSaleDiscount: round2(flashSaleDiscount),
      totalSavings: round2(totalSavings),
      discountPercentage,
      appliedPromotion,
      hasPromotion: appliedPromotion !== null,
      isPriceOverridden: variant?.priceOverride != null,
    };
  }

  /**
   * Centralized, Server-Authoritative Pricing Engine.
   * Used for Cart calculations, Coupon validation, Checkout summaries, Orders, and Invoices.
   *
   * @param {Object} params
   * @param {Array<{ variantId: string, quantity: number, productId?: string }>} params.items
   * @param {string|null} [params.couponCode]
   * @param {string|null} [params.customerId]
   * @param {string|null} [params.stateCode]
   * @param {string|null} [params.shippingState]
   * @param {Object|null} [params.shippingAddress]
   * @param {boolean|null} [params.isTaxInclusiveOverride]
   * @param {Date} [params.now]
   * @returns {Promise<Object>} Complete Authoritative Pricing Breakdown
   */
  async calculateCartPricing({
    items = [],
    couponCode = null,
    customerId = null,
    stateCode = null,
    shippingState = null,
    shippingAddress = null,
    isTaxInclusiveOverride = null,
    now = new Date(),
  }) {
    if (!items || items.length === 0) {
      return this._getEmptyPricingBreakdown();
    }

    // 1. Fetch Variants and Products from DB
    const variantIds = items.map((i) => i.variantId).filter(Boolean);
    const variantsFromDb = await prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: {
        product: {
          include: {
            category: true,
            collectionProducts: {
              include: { collection: true },
            },
            media: {
              where: { isPrimary: true },
              take: 1,
            },
          },
        },
        media: {
          take: 1,
        },
      },
    });

    const variantMap = new Map(variantsFromDb.map((v) => [v.id, v]));

    // Validate that all items exist
    for (const item of items) {
      if (!variantMap.has(item.variantId)) {
        throw ApplicationError.notFound(`Product variant "${item.variantId}" not found`);
      }
    }

    // 2. Fetch Active Promotions (Flash Sales and Offers)
    const activeFlashSales = await prisma.flashSale.findMany({
      where: {
        status: 'ACTIVE',
        startTime: { lte: now },
        endTime: { gte: now },
      },
      include: {
        products: true,
      },
      orderBy: { priority: 'desc' },
    });

    const activeOffers = await prisma.offer.findMany({
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
    });

    // 3. Calculate Item-Level MRP, Base Selling Price, and Promotional Discounts
    const calculatedItems = [];
    let mrpSubtotal = new Decimal(0);
    let baseSellingSubtotal = new Decimal(0);
    let totalOfferDiscount = new Decimal(0);
    let totalFlashSaleDiscount = new Decimal(0);
    const cartAppliedPromotions = [];

    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      const variant = variantMap.get(item.variantId);
      const product = variant.product;
      const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);

      const itemPrice = this.calculateItemPrice({
        product,
        variant,
        activeFlashSales,
        activeOffers,
        now,
      });

      const lineMrpSubtotal = mul(itemPrice.mrp, quantity);
      const lineBaseSellingSubtotal = mul(itemPrice.baseSellingPrice, quantity);
      const lineOfferDiscount = mul(itemPrice.offerDiscount, quantity);
      const lineFlashSaleDiscount = mul(itemPrice.flashSaleDiscount, quantity);
      const lineEffectiveSubtotal = mul(itemPrice.effectiveSellingPrice, quantity);

      mrpSubtotal = add(mrpSubtotal, lineMrpSubtotal);
      baseSellingSubtotal = add(baseSellingSubtotal, lineBaseSellingSubtotal);
      totalOfferDiscount = add(totalOfferDiscount, lineOfferDiscount);
      totalFlashSaleDiscount = add(totalFlashSaleDiscount, lineFlashSaleDiscount);

      if (itemPrice.appliedPromotion) {
        cartAppliedPromotions.push({
          itemId: `${variant.id}_${index}`,
          productId: product.id,
          productName: product.name,
          ...itemPrice.appliedPromotion,
        });
      }

      // Primary image resolution
      const primaryImage =
        variant.media?.[0]?.secureUrl ||
        variant.media?.[0]?.thumbnailUrl ||
        variant.media?.[0]?.url ||
        product.media?.find((m) => m.isPrimary)?.secureUrl ||
        product.media?.[0]?.secureUrl ||
        product.media?.[0]?.thumbnailUrl ||
        product.media?.[0]?.url ||
        'https://images.unsplash.com/photo-1539533018447-63fcce667823?auto=format&fit=crop&w=800&q=80';

      const lineKey = `${variant.id}_${index}`;

      calculatedItems.push({
        lineKey,
        variantId: variant.id,
        productId: product.id,
        name: product.name,
        slug: product.slug,
        sku: variant.sku,
        size: variant.size,
        colorName: variant.colorName,
        colorHex: variant.colorHex,
        primaryImage,
        quantity,
        stockAvailable: variant.stockQuantity,
        inStock: variant.stockQuantity >= quantity,
        categoryId: product.categoryId,
        categoryName: product.category?.name,
        collectionIds: (product.collectionProducts || product.collections || []).map((cp) => cp.collectionId || cp.id),
        mrp: itemPrice.mrp,
        baseSellingPrice: itemPrice.baseSellingPrice,
        unitSellingPrice: itemPrice.effectiveSellingPrice,
        lineMrpSubtotal: round2(lineMrpSubtotal),
        lineBaseSellingSubtotal: round2(lineBaseSellingSubtotal),
        lineOfferDiscount: round2(lineOfferDiscount),
        lineFlashSaleDiscount: round2(lineFlashSaleDiscount),
        lineEffectiveSubtotal: round2(lineEffectiveSubtotal),
        appliedPromotion: itemPrice.appliedPromotion,
        // Coupon discount & tax will be allocated below
        lineCouponDiscount: new Decimal(0),
        taxableAmount: round2(lineEffectiveSubtotal),
        lineTax: new Decimal(0),
        finalItemAmount: round2(lineEffectiveSubtotal),
      });
    }

    // 4. Coupon Validation & Proportional Discount Allocation
    let couponDiscount = new Decimal(0);
    let appliedCoupon = null;

    if (couponCode && couponCode.trim()) {
      const normalizedCode = couponCode.trim().toUpperCase();
      const coupon = await prisma.coupon.findUnique({
        where: { code: normalizedCode },
        include: {
          applicableProducts: true,
          applicableCategories: true,
          applicableCollections: true,
          usages: customerId ? { where: { userId: customerId } } : false,
        },
      });

      if (!coupon) {
        throw ApplicationError.badRequest(`Coupon code "${normalizedCode}" does not exist`, 'INVALID_COUPON');
      }

      if (!coupon.isActive) {
        throw ApplicationError.badRequest(`Coupon "${normalizedCode}" is currently inactive`, 'COUPON_INACTIVE');
      }

      const couponStart = new Date(coupon.startDate);
      const couponEnd = new Date(coupon.endDate);
      if (now < couponStart) {
        throw ApplicationError.badRequest(`Coupon "${normalizedCode}" has not started yet`, 'COUPON_NOT_STARTED');
      }
      if (now > couponEnd) {
        throw ApplicationError.badRequest(`Coupon "${normalizedCode}" has expired`, 'COUPON_EXPIRED');
      }

      if (coupon.usageLimit > 0 && coupon.timesRedeemed >= coupon.usageLimit) {
        throw ApplicationError.badRequest(`Coupon "${normalizedCode}" has reached its maximum global usage limit`, 'COUPON_USAGE_LIMIT');
      }

      if (customerId && coupon.perCustomerLimit > 0) {
        const customerUsageCount = await prisma.promotionUsage.count({
          where: { couponId: coupon.id, userId: customerId },
        });
        if (customerUsageCount >= coupon.perCustomerLimit) {
          throw ApplicationError.badRequest(
            `You have already redeemed coupon "${normalizedCode}" the maximum allowed number of times (${coupon.perCustomerLimit})`,
            'CUSTOMER_USAGE_EXCEEDED'
          );
        }
      }

      // Filter eligible items for this coupon
      const hasProductRestrictions = coupon.applicableProducts && coupon.applicableProducts.length > 0;
      const hasCategoryRestrictions = coupon.applicableCategories && coupon.applicableCategories.length > 0;
      const hasCollectionRestrictions = coupon.applicableCollections && coupon.applicableCollections.length > 0;

      const eligibleItems = calculatedItems.filter((item) => {
        // Exclude promotional items if configured
        if (coupon.conditions?.excludeDiscountedItems && item.appliedPromotion) {
          return false;
        }

        if (hasProductRestrictions) {
          return coupon.applicableProducts.some((ap) => ap.productId === item.productId);
        }
        if (hasCategoryRestrictions) {
          return coupon.applicableCategories.some((ac) => ac.categoryId === item.categoryId);
        }
        if (hasCollectionRestrictions) {
          return coupon.applicableCollections.some((ac) => item.collectionIds.includes(ac.collectionId));
        }
        return true;
      });

      if (eligibleItems.length === 0) {
        throw ApplicationError.badRequest(
          `Coupon "${normalizedCode}" is not applicable to any garments currently in your bag`,
          'COUPON_NO_ELIGIBLE_ITEMS'
        );
      }

      // Calculate post-promotional eligible subtotal
      const eligibleSubtotal = eligibleItems.reduce(
        (sum, item) => add(sum, item.lineEffectiveSubtotal),
        new Decimal(0)
      );

      const minPurchase = toDecimal(coupon.minPurchaseAmount);
      if (eligibleSubtotal.lessThan(minPurchase)) {
        throw ApplicationError.badRequest(
          `Minimum bag value of ₹${formatCurrency(minPurchase)} required for coupon "${normalizedCode}" (eligible bag value: ₹${formatCurrency(eligibleSubtotal)})`,
          'MIN_PURCHASE_NOT_MET'
        );
      }

      // Calculate raw coupon discount
      let rawCouponDiscount = new Decimal(0);
      if (coupon.discountType === 'PERCENTAGE') {
        rawCouponDiscount = calcPercentage(eligibleSubtotal, coupon.discountValue);
        if (coupon.maxDiscountAmount != null) {
          rawCouponDiscount = minDecimal(rawCouponDiscount, toDecimal(coupon.maxDiscountAmount));
        }
      } else {
        // FLAT coupon
        rawCouponDiscount = minDecimal(toDecimal(coupon.discountValue), eligibleSubtotal);
      }

      // Never allow discount amount to exceed eligible payable amount
      couponDiscount = round2(minDecimal(rawCouponDiscount, eligibleSubtotal));

      // Proportionally allocate coupon discount across eligible items (Hamilton Largest Remainder method)
      const allocationMap = allocateProportionally(
        couponDiscount,
        eligibleItems.map((item) => ({ id: item.lineKey, amount: item.lineEffectiveSubtotal }))
      );

      eligibleItems.forEach((item) => {
        const itemDiscount = allocationMap.get(item.lineKey) || new Decimal(0);
        item.lineCouponDiscount = itemDiscount;
        item.taxableAmount = maxDecimal(new Decimal(0), sub(item.lineEffectiveSubtotal, itemDiscount));
      });

      appliedCoupon = {
        id: coupon.id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: Number(coupon.discountValue),
        discountAmount: round2(couponDiscount),
        description: coupon.description,
      };
    }

    // 5. Calculate Subtotals
    const productDiscount = maxDecimal(new Decimal(0), sub(mrpSubtotal, baseSellingSubtotal));
    const postDiscountPayableSubtotal = maxDecimal(
      new Decimal(0),
      sub(baseSellingSubtotal, add(totalOfferDiscount, totalFlashSaleDiscount, couponDiscount))
    );

    // 6. Tax Settings & Indian GST Breakdown
    const rawStateInput = stateCode || shippingState || shippingAddress?.state || shippingAddress?.stateCode;
    const { stateCode: destStateCode, stateName: destStateName, isInterState } =
      this.resolveIndianStateCode(rawStateInput);

    let taxSetting = await prisma.taxSetting.findFirst({
      where: {
        OR: [
          { stateCode: destStateCode },
          { stateName: { equals: destStateName, mode: 'insensitive' } },
        ],
      },
    });

    if (!taxSetting || !taxSetting.isActive) {
      taxSetting = {
        stateCode: destStateCode,
        stateName: destStateName,
        cgstRate: new Decimal(6.0),
        sgstRate: new Decimal(6.0),
        igstRate: new Decimal(12.0),
      };
    }

    // Check store pricing tax mode: default to tax-inclusive luxury pricing
    let isTaxInclusive = true;
    if (isTaxInclusiveOverride !== null) {
      isTaxInclusive = Boolean(isTaxInclusiveOverride);
    } else {
      const storeSetting = await prisma.storeSetting.findUnique({
        where: { key: 'tax_exclusive_pricing' },
      });
      if (storeSetting && storeSetting.value && typeof storeSetting.value === 'object') {
        if (storeSetting.value.inclusive !== undefined) {
          isTaxInclusive = Boolean(storeSetting.value.inclusive);
        } else if (storeSetting.value.exclusive !== undefined) {
          isTaxInclusive = !storeSetting.value.exclusive;
        }
      }
    }

    const cgstRate = toDecimal(taxSetting.cgstRate);
    const sgstRate = toDecimal(taxSetting.sgstRate);
    const igstRate = toDecimal(taxSetting.igstRate);
    const applicableGstRate = isInterState ? igstRate : add(cgstRate, sgstRate);

    let totalTax = new Decimal(0);
    let cgst = new Decimal(0);
    let sgst = new Decimal(0);
    let igst = new Decimal(0);
    let preTaxSubtotal = new Decimal(0);

    if (isTaxInclusive) {
      // INCLUSIVE TAX: Selling prices already include GST.
      // preTaxSubtotal = postDiscountPayableSubtotal / (1 + applicableGstRate / 100)
      const taxDivisor = add(new Decimal(1), div(applicableGstRate, 100));
      preTaxSubtotal = round2(div(postDiscountPayableSubtotal, taxDivisor));
      totalTax = round2(sub(postDiscountPayableSubtotal, preTaxSubtotal));

      if (isInterState) {
        igst = totalTax;
      } else {
        // Intra-state split between CGST and SGST
        if (applicableGstRate.greaterThan(0)) {
          cgst = round2(mul(totalTax, div(cgstRate, applicableGstRate)));
          sgst = round2(sub(totalTax, cgst)); // exact paise reconciliation
        }
      }

      // Allocate tax component to each line item
      const taxAllocationMap = allocateProportionally(
        totalTax,
        calculatedItems.map((item) => ({ id: item.lineKey, amount: item.taxableAmount }))
      );

      calculatedItems.forEach((item) => {
        item.lineTax = taxAllocationMap.get(item.lineKey) || new Decimal(0);
        item.finalItemAmount = round2(item.taxableAmount); // Inclusive: final amount is already tax-inclusive
      });
    } else {
      // EXCLUSIVE TAX: Tax is added on top of the taxable subtotal
      preTaxSubtotal = postDiscountPayableSubtotal;
      if (isInterState) {
        igst = calcPercentage(preTaxSubtotal, igstRate);
        totalTax = round2(igst);
      } else {
        cgst = calcPercentage(preTaxSubtotal, cgstRate);
        sgst = calcPercentage(preTaxSubtotal, sgstRate);
        totalTax = round2(add(cgst, sgst));
      }

      const taxAllocationMap = allocateProportionally(
        totalTax,
        calculatedItems.map((item) => ({ id: item.lineKey, amount: item.taxableAmount }))
      );

      calculatedItems.forEach((item) => {
        item.lineTax = taxAllocationMap.get(item.lineKey) || new Decimal(0);
        item.finalItemAmount = round2(add(item.taxableAmount, item.lineTax));
      });
    }

    // 7. Shipping Calculation
    const activeShippingSettings = await prisma.shippingSetting.findMany({
      where: { isActive: true },
      orderBy: { minOrderAmount: 'asc' },
    });

    let shippingCharge = new Decimal(250.0); // Standard express courier default
    let shippingMethod = 'Standard Express Delivery';

    for (const setting of activeShippingSettings) {
      if (postDiscountPayableSubtotal.greaterThanOrEqualTo(toDecimal(setting.minOrderAmount))) {
        shippingCharge = setting.isFreeShipping ? new Decimal(0) : toDecimal(setting.rate);
        shippingMethod = setting.name;
      }
    }

    shippingCharge = round2(shippingCharge);

    // 8. Final Payable & Savings Breakdown
    const additionalCharges = new Decimal(0);
    const totalSavings = round2(add(productDiscount, totalOfferDiscount, totalFlashSaleDiscount, couponDiscount));

    // When inclusive: final = postDiscountPayableSubtotal + shippingCharge
    // When exclusive: final = preTaxSubtotal + totalTax + shippingCharge
    const finalPayableAmount = isTaxInclusive
      ? round2(add(postDiscountPayableSubtotal, shippingCharge, additionalCharges))
      : round2(add(preTaxSubtotal, totalTax, shippingCharge, additionalCharges));

    return {
      mrpSubtotal: round2(mrpSubtotal),
      baseSellingSubtotal: round2(baseSellingSubtotal),
      productDiscount: round2(productDiscount),
      offerDiscount: round2(totalOfferDiscount),
      flashSaleDiscount: round2(totalFlashSaleDiscount),
      couponDiscount: round2(couponDiscount),
      taxableSubtotal: round2(postDiscountPayableSubtotal),
      preTaxSubtotal: round2(preTaxSubtotal),
      tax: round2(totalTax),
      shippingCharge: round2(shippingCharge),
      additionalCharges: round2(additionalCharges),
      totalSavings: round2(totalSavings),
      finalPayableAmount: round2(finalPayableAmount),
      currency: 'INR',
      appliedCoupon,
      appliedPromotions: cartAppliedPromotions,
      appliedPromotion: cartAppliedPromotions.length > 0 ? cartAppliedPromotions[0] : null,
      taxBreakdown: {
        state: destStateCode,
        stateName: destStateName,
        rate: applicableGstRate.toNumber(),
        isInterState,
        isTaxInclusive,
        cgst: round2(cgst),
        sgst: round2(sgst),
        igst: round2(igst),
        totalTax: round2(totalTax),
      },
      shippingBreakdown: {
        method: shippingMethod,
        rate: round2(shippingCharge),
        isFree: shippingCharge.isZero(),
      },
      items: calculatedItems.map((item) => ({
        variantId: item.variantId,
        productId: item.productId,
        name: item.name,
        slug: item.slug,
        sku: item.sku,
        size: item.size,
        colorName: item.colorName,
        colorHex: item.colorHex,
        primaryImage: item.primaryImage,
        quantity: item.quantity,
        stockAvailable: item.stockAvailable,
        inStock: item.inStock,
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        collectionIds: item.collectionIds,
        mrp: item.mrp,
        baseSellingPrice: item.baseSellingPrice,
        unitSellingPrice: item.unitSellingPrice,
        lineMrpSubtotal: item.lineMrpSubtotal,
        lineBaseSellingSubtotal: item.lineBaseSellingSubtotal,
        lineOfferDiscount: item.lineOfferDiscount,
        lineFlashSaleDiscount: item.lineFlashSaleDiscount,
        lineEffectiveSubtotal: item.lineEffectiveSubtotal,
        lineCouponDiscount: item.lineCouponDiscount,
        taxableAmount: item.taxableAmount,
        lineTax: item.lineTax,
        finalItemAmount: item.finalItemAmount,
        appliedPromotion: item.appliedPromotion,
      })),
    };
  }

  /**
   * Return all active coupons and determine their applicability state for the current cart.
   *
   * @param {Object} params
   * @param {Array} params.items - Cart items
   * @param {string|null} [params.customerId] - Customer ID
   * @param {Date} [params.now]
   * @returns {Promise<Array>} Coupons with applicability explanation
   */
  async getApplicableCoupons({ items = [], customerId = null, now = new Date() }) {
    const activeCoupons = await prisma.coupon.findMany({
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
      orderBy: { discountValue: 'desc' },
    });

    if (activeCoupons.length === 0) return [];

    let cartPricing = null;
    try {
      cartPricing = await this.calculateCartPricing({ items, couponCode: null, customerId, now });
    } catch {
      cartPricing = null;
    }

    const results = [];

    for (const coupon of activeCoupons) {
      let isApplicable = true;
      let reason = 'Ready to apply';
      let potentialDiscount = new Decimal(0);
      const minPurchase = toDecimal(coupon.minPurchaseAmount);

      if (coupon.usageLimit > 0 && coupon.timesRedeemed >= coupon.usageLimit) {
        isApplicable = false;
        reason = 'Coupon has reached its maximum global redemption limit';
      }

      if (isApplicable && customerId && coupon.perCustomerLimit > 0) {
        const customerUsageCount = await prisma.promotionUsage.count({
          where: { couponId: coupon.id, userId: customerId },
        });
        if (customerUsageCount >= coupon.perCustomerLimit) {
          isApplicable = false;
          reason = `Maximum redemption limit of ${coupon.perCustomerLimit} per customer reached`;
        }
      }

      if (isApplicable && cartPricing && cartPricing.items.length > 0) {
        const hasProductRestrictions = coupon.applicableProducts && coupon.applicableProducts.length > 0;
        const hasCategoryRestrictions = coupon.applicableCategories && coupon.applicableCategories.length > 0;
        const hasCollectionRestrictions = coupon.applicableCollections && coupon.applicableCollections.length > 0;

        const eligibleItems = cartPricing.items.filter((item) => {
          if (coupon.conditions?.excludeDiscountedItems && item.appliedPromotion) return false;
          if (hasProductRestrictions) {
            return coupon.applicableProducts.some((ap) => ap.productId === item.productId);
          }
          if (hasCategoryRestrictions) {
            return coupon.applicableCategories.some((ac) => ac.categoryId === item.categoryId);
          }
          if (hasCollectionRestrictions) {
            return coupon.applicableCollections.some((ac) => item.collectionIds.includes(ac.collectionId));
          }
          return true;
        });

        if (eligibleItems.length === 0) {
          isApplicable = false;
          reason = 'Not applicable to any garments in your bag';
        } else {
          const eligibleSubtotal = eligibleItems.reduce(
            (sum, item) => add(sum, item.lineEffectiveSubtotal),
            new Decimal(0)
          );

          if (eligibleSubtotal.lessThan(minPurchase)) {
            isApplicable = false;
            const diff = sub(minPurchase, eligibleSubtotal);
            reason = `Add ₹${formatCurrency(diff)} more to unlock this coupon`;
          } else {
            if (coupon.discountType === 'PERCENTAGE') {
              let disc = calcPercentage(eligibleSubtotal, coupon.discountValue);
              if (coupon.maxDiscountAmount != null) {
                disc = minDecimal(disc, toDecimal(coupon.maxDiscountAmount));
              }
              potentialDiscount = minDecimal(disc, eligibleSubtotal);
            } else {
              potentialDiscount = minDecimal(toDecimal(coupon.discountValue), eligibleSubtotal);
            }
          }
        }
      }

      results.push({
        id: coupon.id,
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: Number(coupon.discountValue),
        maxDiscountAmount: coupon.maxDiscountAmount ? round2(coupon.maxDiscountAmount) : null,
        minPurchaseAmount: round2(minPurchase),
        endDate: coupon.endDate,
        isApplicable,
        reason,
        potentialDiscount: round2(potentialDiscount),
      });
    }

    return results;
  }

  /**
   * Helper for empty bag
   * @private
   */
  _getEmptyPricingBreakdown() {
    return {
      mrpSubtotal: new Decimal(0),
      baseSellingSubtotal: new Decimal(0),
      productDiscount: new Decimal(0),
      offerDiscount: new Decimal(0),
      flashSaleDiscount: new Decimal(0),
      couponDiscount: new Decimal(0),
      taxableSubtotal: new Decimal(0),
      preTaxSubtotal: new Decimal(0),
      tax: new Decimal(0),
      shippingCharge: new Decimal(0),
      additionalCharges: new Decimal(0),
      totalSavings: new Decimal(0),
      finalPayableAmount: new Decimal(0),
      currency: 'INR',
      appliedCoupon: null,
      appliedPromotions: [],
      appliedPromotion: null,
      taxBreakdown: {
        state: STORE_HOME_STATE,
        stateName: 'MAHARASHTRA',
        rate: DEFAULT_GST_RATE,
        isInterState: false,
        isTaxInclusive: true,
        cgst: new Decimal(0),
        sgst: new Decimal(0),
        igst: new Decimal(0),
        totalTax: new Decimal(0),
      },
      shippingBreakdown: {
        method: 'Standard Express Delivery',
        rate: new Decimal(0),
        isFree: true,
      },
      items: [],
    };
  }
}

export const pricingService = new PricingService();
export default pricingService;
