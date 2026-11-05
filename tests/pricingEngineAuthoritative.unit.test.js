import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
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
} from '../src/utils/pricingMath.js';
import {
  PricingService,
  INDIAN_STATES_MAP,
  STORE_HOME_STATE,
  DEFAULT_GST_RATE,
} from '../src/services/pricing.service.js';

const Decimal = Prisma.Decimal;

describe('FORME Authoritative Server Pricing Engine & Financial System Audit', () => {
  const service = new PricingService();

  // --------------------------------------------------------------------------
  // PART 1: PRISMA DECIMAL ARITHMETIC & HALF-UP ROUNDING
  // --------------------------------------------------------------------------
  describe('Prisma Decimal Financial Math & Paise Precision', () => {
    it('accurately rounds half-up to exact paise without IEEE-754 floating drift', () => {
      // In JS float: 0.1 + 0.2 = 0.30000000000000004
      const result = add(0.1, 0.2);
      expect(round2(result).toString()).toBe('0.3');
      expect(round2(10.005).toString()).toBe('10.01');
      expect(round2(10.004).toString()).toBe('10');
    });

    it('calculates exact percentage discounts in Decimal', () => {
      // 15% of ₹14,999 = 2249.85
      const disc = calcPercentage(14999, 15);
      expect(disc.toString()).toBe('2249.85');
    });

    it('allocates paise using Hamilton Largest Remainder method without drift', () => {
      // Distribute ₹100.00 coupon across 3 items of ₹1000 each (weight 1:1:1)
      const items = [
        { id: 'item-1', amount: new Decimal('1000.00') },
        { id: 'item-2', amount: new Decimal('1000.00') },
        { id: 'item-3', amount: new Decimal('1000.00') },
      ];
      const alloc = allocateProportionally(new Decimal('100.00'), items);
      const a1 = alloc.get('item-1');
      const a2 = alloc.get('item-2');
      const a3 = alloc.get('item-3');

      // 100 / 3 = 33.3333... cents = 3333 cents + 1 extra cent remainder
      expect(add(a1, a2, a3).toString()).toBe('100');
      expect(a1.toNumber()).toBeGreaterThanOrEqual(33.33);
      expect(a1.toNumber()).toBeLessThanOrEqual(33.34);
    });

    it('handles fractional weights where largest remainder gives exact sum', () => {
      // Distribute ₹10.00 across weights 70, 20, 10
      const items = [
        { id: 'A', amount: new Decimal('70.00') },
        { id: 'B', amount: new Decimal('20.00') },
        { id: 'C', amount: new Decimal('10.00') },
      ];
      const alloc = allocateProportionally(new Decimal('10.00'), items);
      expect(alloc.get('A').toString()).toBe('7');
      expect(alloc.get('B').toString()).toBe('2');
      expect(alloc.get('C').toString()).toBe('1');
      expect(add(alloc.get('A'), alloc.get('B'), alloc.get('C')).toString()).toBe('10');
    });
  });

  // --------------------------------------------------------------------------
  // PART 2: INDIAN STATE RESOLUTION & GST TAX ENGINE
  // --------------------------------------------------------------------------
  describe('Indian State Resolution & Bidirectional GST Codes', () => {
    it('correctly identifies Intra-State transactions for Maharashtra (MH)', () => {
      const resMH = service.resolveIndianStateCode('MH');
      expect(resMH.stateCode).toBe('MH');
      expect(resMH.isInterState).toBe(false);

      const resMhFull = service.resolveIndianStateCode('Maharashtra');
      expect(resMhFull.stateCode).toBe('MH');
      expect(resMhFull.isInterState).toBe(false);
    });

    it('correctly identifies Inter-State transactions for other states (GJ, DL, KA, TN)', () => {
      const resGJ = service.resolveIndianStateCode('Gujarat');
      expect(resGJ.stateCode).toBe('GJ');
      expect(resGJ.isInterState).toBe(true);

      const resDL = service.resolveIndianStateCode('Delhi');
      expect(resDL.stateCode).toBe('DL');
      expect(resDL.isInterState).toBe(true);

      const resKA = service.resolveIndianStateCode('Karnataka');
      expect(resKA.stateCode).toBe('KA');
      expect(resKA.isInterState).toBe(true);
    });

    it('falls back safely to store home state MH when input is null or empty', () => {
      const resEmpty = service.resolveIndianStateCode('');
      expect(resEmpty.stateCode).toBe('MH');
      expect(resEmpty.isInterState).toBe(false);

      const resNull = service.resolveIndianStateCode(null);
      expect(resNull.stateCode).toBe('MH');
      expect(resNull.isInterState).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // PART 3: DETERMINISTIC PROMOTION HIERARCHY & PRIORITY
  // --------------------------------------------------------------------------
  describe('Promotion Priority Hierarchy & Deterministic Ranking', () => {
    const product = {
      id: 'prod-suit-001',
      sellingPrice: new Decimal('10000.00'),
      categoryId: 'cat-tailoring',
      collectionProducts: [{ collectionId: 'col-runway' }],
    };
    const variant = {
      id: 'var-suit-40r',
      priceOverride: null,
    };
    const now = new Date('2026-11-04T12:00:00Z');

    it('Flash Sale (Priority 5) deterministically wins over Ordinary Offers when stacking is false', () => {
      const activeFlashSales = [
        {
          id: 'fs-1',
          name: 'Midnight Flash Drop',
          slug: 'midnight-flash-drop',
          status: 'ACTIVE',
          startTime: new Date('2026-11-04T00:00:00Z'),
          endTime: new Date('2026-11-04T23:59:59Z'),
          products: [
            {
              productId: 'prod-suit-001',
              discountType: 'PERCENTAGE',
              discountValue: 20, // 20% = ₹2,000
            },
          ],
        },
      ];

      const activeOffers = [
        {
          id: 'off-product',
          name: 'Suiting Privilege',
          slug: 'suiting-privilege',
          isActive: true,
          startDate: new Date('2026-11-01T00:00:00Z'),
          endDate: new Date('2026-11-10T23:59:59Z'),
          discountType: 'PERCENTAGE',
          discountValue: 25, // 25% = ₹2,500
          allowStacking: false,
          applicableProducts: [{ productId: 'prod-suit-001' }],
        },
      ];

      const promoResult = service.resolveItemPromotions({
        product,
        variant,
        activeFlashSales,
        activeOffers,
        now,
      });

      expect(promoResult.flashSaleDiscount.toString()).toBe('2000');
      expect(promoResult.offerDiscount.toString()).toBe('0');
      expect(promoResult.appliedPromotion.type).toBe('FLASH_SALE');
    });

    it('Product-specific Offer (Tier 4) beats Category Offer (Tier 3)', () => {
      const activeOffers = [
        {
          id: 'off-category',
          name: 'Category Offer',
          isActive: true,
          startDate: new Date('2026-11-01T00:00:00Z'),
          endDate: new Date('2026-11-10T23:59:59Z'),
          discountType: 'PERCENTAGE',
          discountValue: 30, // 30%
          applicableCategories: [{ categoryId: 'cat-tailoring' }],
        },
        {
          id: 'off-product',
          name: 'Product Specific Offer',
          isActive: true,
          startDate: new Date('2026-11-01T00:00:00Z'),
          endDate: new Date('2026-11-10T23:59:59Z'),
          discountType: 'PERCENTAGE',
          discountValue: 10, // 10%
          applicableProducts: [{ productId: 'prod-suit-001' }],
        },
      ];

      const promoResult = service.resolveItemPromotions({
        product,
        variant,
        activeFlashSales: [],
        activeOffers,
        now,
      });

      expect(promoResult.appliedPromotion.promotionType).toBe('PRODUCT_OFFER');
      expect(promoResult.offerDiscount.toString()).toBe('1000');
    });

    it('Category Offer (Tier 3) beats Collection Offer (Tier 2)', () => {
      const activeOffers = [
        {
          id: 'off-collection',
          name: 'Collection Offer',
          isActive: true,
          startDate: new Date('2026-11-01T00:00:00Z'),
          endDate: new Date('2026-11-10T23:59:59Z'),
          discountType: 'PERCENTAGE',
          discountValue: 25,
          applicableCollections: [{ collectionId: 'col-runway' }],
        },
        {
          id: 'off-category',
          name: 'Category Offer',
          isActive: true,
          startDate: new Date('2026-11-01T00:00:00Z'),
          endDate: new Date('2026-11-10T23:59:59Z'),
          discountType: 'PERCENTAGE',
          discountValue: 15,
          applicableCategories: [{ categoryId: 'cat-tailoring' }],
        },
      ];

      const promoResult = service.resolveItemPromotions({
        product,
        variant,
        activeFlashSales: [],
        activeOffers,
        now,
      });

      expect(promoResult.appliedPromotion.promotionType).toBe('CATEGORY_OFFER');
      expect(promoResult.offerDiscount.toString()).toBe('1500');
    });

    it('Collection Offer (Tier 2) beats Storewide Offer (Tier 1)', () => {
      const activeOffers = [
        {
          id: 'off-storewide',
          name: 'Storewide Autumn Privilege',
          isActive: true,
          startDate: new Date('2026-11-01T00:00:00Z'),
          endDate: new Date('2026-11-10T23:59:59Z'),
          discountType: 'PERCENTAGE',
          discountValue: 20,
          applicableProducts: [],
          applicableCategories: [],
          applicableCollections: [],
        },
        {
          id: 'off-collection',
          name: 'Runway Capsule Offer',
          isActive: true,
          startDate: new Date('2026-11-01T00:00:00Z'),
          endDate: new Date('2026-11-10T23:59:59Z'),
          discountType: 'PERCENTAGE',
          discountValue: 15,
          applicableCollections: [{ collectionId: 'col-runway' }],
        },
      ];

      const promoResult = service.resolveItemPromotions({
        product,
        variant,
        activeFlashSales: [],
        activeOffers,
        now,
      });

      expect(promoResult.appliedPromotion.promotionType).toBe('COLLECTION_OFFER');
      expect(promoResult.offerDiscount.toString()).toBe('1500');
    });
  });

  // --------------------------------------------------------------------------
  // PART 4: STACKING CALCULATIONS
  // --------------------------------------------------------------------------
  describe('Promotion Stacking Math & Re-calculation', () => {
    const product = {
      id: 'prod-dress-002',
      sellingPrice: new Decimal('10000.00'),
      categoryId: 'cat-evening',
      collectionProducts: [],
    };
    const variant = { id: 'var-dress-m', priceOverride: null };
    const now = new Date('2026-11-04T12:00:00Z');

    it('calculates stacking correctly: Flash sale applies first, Offer applies on post-flash price', () => {
      // Base: ₹10,000
      // Flash sale: 20% -> ₹2,000 off -> Post-flash price: ₹8,000
      // Offer: 10% (stacked) -> 10% of ₹8,000 = ₹800 off (NOT 10% of ₹10,000 = ₹1000)
      const activeFlashSales = [
        {
          id: 'fs-dress',
          name: 'Couture Flash',
          status: 'ACTIVE',
          startTime: new Date('2026-11-04T00:00:00Z'),
          endTime: new Date('2026-11-04T23:59:59Z'),
          products: [
            {
              productId: 'prod-dress-002',
              discountType: 'PERCENTAGE',
              discountValue: 20,
            },
          ],
        },
      ];

      const activeOffers = [
        {
          id: 'off-dress',
          name: 'Eveningwear Privilege',
          isActive: true,
          startDate: new Date('2026-11-01T00:00:00Z'),
          endDate: new Date('2026-11-10T23:59:59Z'),
          discountType: 'PERCENTAGE',
          discountValue: 10,
          allowStacking: true,
          applicableCategories: [{ categoryId: 'cat-evening' }],
        },
      ];

      const promoResult = service.resolveItemPromotions({
        product,
        variant,
        activeFlashSales,
        activeOffers,
        now,
      });

      expect(promoResult.appliedPromotion.type).toBe('STACKED');
      expect(promoResult.flashSaleDiscount.toString()).toBe('2000');
      expect(promoResult.offerDiscount.toString()).toBe('800'); // 10% of 8,000
      expect(promoResult.appliedPromotion.totalDiscount.toString()).toBe('2800');
    });

    it('respects maxDiscountAmount cap when stacking is applied', () => {
      // Base: ₹10,000
      // Flash sale: 20% -> ₹2,000 off -> Post-flash price: ₹8,000
      // Offer: 10% capped at ₹500 -> 10% of ₹8,000 = ₹800 -> capped at ₹500
      const activeFlashSales = [
        {
          id: 'fs-dress',
          name: 'Couture Flash',
          status: 'ACTIVE',
          startTime: new Date('2026-11-04T00:00:00Z'),
          endTime: new Date('2026-11-04T23:59:59Z'),
          products: [
            {
              productId: 'prod-dress-002',
              discountType: 'PERCENTAGE',
              discountValue: 20,
            },
          ],
        },
      ];

      const activeOffers = [
        {
          id: 'off-dress',
          name: 'Eveningwear Privilege',
          isActive: true,
          startDate: new Date('2026-11-01T00:00:00Z'),
          endDate: new Date('2026-11-10T23:59:59Z'),
          discountType: 'PERCENTAGE',
          discountValue: 10,
          maxDiscountAmount: new Decimal('500.00'),
          allowStacking: true,
          applicableCategories: [{ categoryId: 'cat-evening' }],
        },
      ];

      const promoResult = service.resolveItemPromotions({
        product,
        variant,
        activeFlashSales,
        activeOffers,
        now,
      });

      expect(promoResult.flashSaleDiscount.toString()).toBe('2000');
      expect(promoResult.offerDiscount.toString()).toBe('500');
      expect(promoResult.appliedPromotion.totalDiscount.toString()).toBe('2500');
    });
  });

  // --------------------------------------------------------------------------
  // PART 5: AUTHORITATIVE ITEM PRICE (PDP & CARD FLOW)
  // --------------------------------------------------------------------------
  describe('Authoritative calculateItemPrice (PDP & Product Card)', () => {
    it('applies variant priceOverride and compareAtPriceOverride correctly', () => {
      const product = {
        id: 'prod-overridden',
        sellingPrice: new Decimal('8000.00'),
        compareAtPrice: new Decimal('10000.00'),
        categoryId: 'cat-default',
      };
      const variant = {
        id: 'var-override',
        priceOverride: new Decimal('9000.00'),
        compareAtPriceOverride: new Decimal('12000.00'),
      };

      const itemPrice = service.calculateItemPrice({
        product,
        variant,
        activeFlashSales: [],
        activeOffers: [],
      });

      expect(itemPrice.mrp.toString()).toBe('12000');
      expect(itemPrice.baseSellingPrice.toString()).toBe('9000');
      expect(itemPrice.sellingPrice.toString()).toBe('9000');
      expect(itemPrice.totalSavings.toString()).toBe('3000');
      expect(itemPrice.discountPercentage).toBe(25); // (12000-9000)/12000 = 25%
      expect(itemPrice.isPriceOverridden).toBe(true);
    });

    it('defaults MRP to baseSellingPrice if compareAtPrice is missing or less than sellingPrice', () => {
      const product = {
        id: 'prod-no-compare',
        sellingPrice: new Decimal('5000.00'),
        compareAtPrice: null,
      };

      const itemPrice = service.calculateItemPrice({
        product,
        variant: null,
      });

      expect(itemPrice.mrp.toString()).toBe('5000');
      expect(itemPrice.baseSellingPrice.toString()).toBe('5000');
      expect(itemPrice.totalSavings.toString()).toBe('0');
      expect(itemPrice.discountPercentage).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // PART 6: GST TAX AUDIT (TAX-INCLUSIVE VS TAX-EXCLUSIVE)
  // --------------------------------------------------------------------------
  describe('GST Tax Calculation Audit', () => {
    it('calculates Tax-Inclusive GST correctly without adding tax twice', () => {
      // In tax-inclusive luxury fashion:
      // Customer garment price = ₹11,200.00 (inclusive of 12% GST)
      // Pre-tax base = 11,200 / 1.12 = ₹10,000.00
      // Tax amount = 11,200 - 10,000 = ₹1,200.00
      // Final payable amount = ₹11,200.00 (+ shipping if any)
      const postDiscountPayable = new Decimal('11200.00');
      const gstRate = new Decimal('12.00');
      const divisor = add(1, div(gstRate, 100)); // 1.12
      const preTaxBase = round2(div(postDiscountPayable, divisor));
      const taxAmount = round2(sub(postDiscountPayable, preTaxBase));

      expect(preTaxBase.toString()).toBe('10000');
      expect(taxAmount.toString()).toBe('1200');

      // Reconciled grand total
      const shipping = new Decimal('0.00');
      const finalPayable = round2(add(postDiscountPayable, shipping));
      expect(finalPayable.toString()).toBe('11200');
    });

    it('splits Intra-state GST into equal CGST and SGST', () => {
      const totalTax = new Decimal('1200.00');
      const cgstRate = new Decimal('6.00');
      const applicableRate = new Decimal('12.00');

      const cgst = round2(mul(totalTax, div(cgstRate, applicableRate)));
      const sgst = round2(sub(totalTax, cgst));

      expect(cgst.toString()).toBe('600');
      expect(sgst.toString()).toBe('600');
      expect(add(cgst, sgst).toString()).toBe('1200');
    });

    it('correctly calculates Tax-Exclusive GST when store setting is tax-exclusive', () => {
      // In tax-exclusive mode:
      // Subtotal: ₹10,000.00
      // 12% IGST added on top: ₹1,200.00
      // Shipping: ₹250.00
      // Grand total = 10,000 + 1,200 + 250 = ₹11,450.00
      const subtotal = new Decimal('10000.00');
      const gstRate = new Decimal('12.00');
      const tax = calcPercentage(subtotal, gstRate);
      const shipping = new Decimal('250.00');
      const finalPayable = round2(add(subtotal, tax, shipping));

      expect(tax.toString()).toBe('1200');
      expect(finalPayable.toString()).toBe('11450');
    });
  });

  // --------------------------------------------------------------------------
  // PART 7: COMPLEX MULTI-ITEM PROPORTIONAL ALLOCATIONS WITH ODD REMAINDERS
  // --------------------------------------------------------------------------
  describe('Complex Multi-Item Proportional Discount Allocation', () => {
    it('distributes discount across 5 items with fractional prices without a single paisa drift', () => {
      // Total discount: ₹333.33 across 5 items with varied prices
      const items = [
        { id: 'item-1', amount: new Decimal('1499.50') },
        { id: 'item-2', amount: new Decimal('2499.00') },
        { id: 'item-3', amount: new Decimal('3999.75') },
        { id: 'item-4', amount: new Decimal('999.25') },
        { id: 'item-5', amount: new Decimal('1799.00') },
      ];
      const totalDiscount = new Decimal('333.33');
      const alloc = allocateProportionally(totalDiscount, items);

      let allocatedSum = new Decimal(0);
      items.forEach((item) => {
        const val = alloc.get(item.id);
        expect(val.toNumber()).toBeGreaterThan(0);
        expect(val.lessThanOrEqualTo(item.amount)).toBe(true);
        allocatedSum = add(allocatedSum, val);
      });

      // EXACT paise match
      expect(allocatedSum.toString()).toBe('333.33');
    });

    it('caps allocated discount at item amount if discount exceeds item value', () => {
      const items = [
        { id: 'low-value', amount: new Decimal('50.00') },
        { id: 'high-value', amount: new Decimal('1000.00') },
      ];
      const alloc = allocateProportionally(new Decimal('100.00'), items);
      const lowVal = alloc.get('low-value');
      expect(lowVal.lessThanOrEqualTo(new Decimal('50.00'))).toBe(true);
      expect(add(alloc.get('low-value'), alloc.get('high-value')).toString()).toBe('100');
    });
  });

  // --------------------------------------------------------------------------
  // PART 8: SAME-TIER TIE BREAKING & STACKING PREFERENCE
  // --------------------------------------------------------------------------
  describe('Same-Tier Tie-Breaking Rules', () => {
    const product = {
      id: 'prod-tie-001',
      sellingPrice: new Decimal('10000.00'),
      categoryId: 'cat-accessories',
      collectionProducts: [],
    };
    const variant = { id: 'var-tie-1', priceOverride: null };
    const now = new Date('2026-11-04T12:00:00Z');

    it('selects the offer with highest absolute discount when multiple offers match the same tier', () => {
      const activeOffers = [
        {
          id: 'off-cat-10pct',
          name: 'Category 10%',
          isActive: true,
          startDate: new Date('2026-11-01T00:00:00Z'),
          endDate: new Date('2026-11-10T23:59:59Z'),
          discountType: 'PERCENTAGE',
          discountValue: 10, // ₹1,000
          applicableCategories: [{ categoryId: 'cat-accessories' }],
        },
        {
          id: 'off-cat-15pct',
          name: 'Category 15%',
          isActive: true,
          startDate: new Date('2026-11-01T00:00:00Z'),
          endDate: new Date('2026-11-10T23:59:59Z'),
          discountType: 'PERCENTAGE',
          discountValue: 15, // ₹1,500
          applicableCategories: [{ categoryId: 'cat-accessories' }],
        },
      ];

      const promoResult = service.resolveItemPromotions({
        product,
        variant,
        activeFlashSales: [],
        activeOffers,
        now,
      });

      expect(promoResult.appliedPromotion.id).toBe('off-cat-15pct');
      expect(promoResult.offerDiscount.toString()).toBe('1500');
    });

    it('prefers offer with allowStacking=true when discounts are tied in the same tier', () => {
      const activeOffers = [
        {
          id: 'off-no-stack',
          name: 'Offer No Stack',
          isActive: true,
          startDate: new Date('2026-11-01T00:00:00Z'),
          endDate: new Date('2026-11-10T23:59:59Z'),
          discountType: 'PERCENTAGE',
          discountValue: 15,
          allowStacking: false,
          applicableCategories: [{ categoryId: 'cat-accessories' }],
        },
        {
          id: 'off-with-stack',
          name: 'Offer With Stack',
          isActive: true,
          startDate: new Date('2026-11-01T00:00:00Z'),
          endDate: new Date('2026-11-10T23:59:59Z'),
          discountType: 'PERCENTAGE',
          discountValue: 15,
          allowStacking: true,
          applicableCategories: [{ categoryId: 'cat-accessories' }],
        },
      ];

      const promoResult = service.resolveItemPromotions({
        product,
        variant,
        activeFlashSales: [],
        activeOffers,
        now,
      });

      expect(promoResult.appliedPromotion.id).toBe('off-with-stack');
      expect(promoResult.appliedPromotion.allowStacking).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // PART 9: RAZORPAY PAISE MATH & VERIFICATION INTEGRITY
  // --------------------------------------------------------------------------
  describe('Razorpay Currency Math & Paise Conversion', () => {
    it('converts Rupee amounts to exact integer paise without rounding drift', () => {
      const rupeeAmount1 = 1499.5;
      const paise1 = Math.round(rupeeAmount1 * 100);
      expect(paise1).toBe(149950);

      const rupeeAmount2 = 8999.99;
      const paise2 = Math.round(rupeeAmount2 * 100);
      expect(paise2).toBe(899999);

      const rupeeAmount3 = 0.05;
      const paise3 = Math.round(rupeeAmount3 * 100);
      expect(paise3).toBe(5);
    });
  });

  // --------------------------------------------------------------------------
  // PART 10: END-TO-END FINANCIAL FORMULA RECONCILIATION
  // --------------------------------------------------------------------------
  describe('Complete Order Financial Breakdown Reconciliation', () => {
    it('reconciles tax-inclusive order: grandTotal === postDiscountSubtotal + shippingCharge', () => {
      const baseSelling = new Decimal('20000.00');
      const flashSaleDiscount = new Decimal('2000.00');
      const offerDiscount = new Decimal('1000.00');
      const couponDiscount = new Decimal('500.00');
      const shipping = new Decimal('250.00');

      // Post-discount payable: 20000 - 2000 - 1000 - 500 = 16500
      const postDiscountPayable = sub(baseSelling, add(flashSaleDiscount, offerDiscount, couponDiscount));
      expect(postDiscountPayable.toString()).toBe('16500');

      // Inclusive GST (12%)
      const divisor = add(1, div(12, 100)); // 1.12
      const preTaxBase = round2(div(postDiscountPayable, divisor));
      const gstAmount = round2(sub(postDiscountPayable, preTaxBase));

      // Grand total = postDiscountPayable + shipping
      const grandTotal = round2(add(postDiscountPayable, shipping));

      expect(grandTotal.toString()).toBe('16750');
      // Sum check: preTaxBase + gstAmount exactly equals postDiscountPayable
      expect(add(preTaxBase, gstAmount).toString()).toBe('16500');
    });

    it('reconciles tax-exclusive order: grandTotal === taxableSubtotal + gstAmount + shippingCharge', () => {
      const taxableSubtotal = new Decimal('10000.00');
      const gstRate = new Decimal('12.00');
      const gstAmount = calcPercentage(taxableSubtotal, gstRate); // 1200
      const shipping = new Decimal('250.00');

      const grandTotal = round2(add(taxableSubtotal, gstAmount, shipping));
      expect(grandTotal.toString()).toBe('11450');
      expect(sub(grandTotal, add(gstAmount, shipping)).toString()).toBe('10000');
    });
  });
});
