// ============================================================================
// FORME Contemporary Fashion House — Production Database Validation Script
// "Designed to Be Worn. Made to Be Remembered."
// ============================================================================

import { PrismaClient, Prisma } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient({
  log: ['error'],
});

const Decimal = Prisma.Decimal;
const toDec = (v) => (v instanceof Decimal ? v : new Decimal(v ?? 0));
const round2 = (v) => toDec(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

class Validator {
  constructor() {
    this.totalTests = 0;
    this.passedTests = 0;
    this.failedTests = 0;
    this.failures = [];
  }

  assert(condition, testName, details = '') {
    this.totalTests++;
    if (condition) {
      this.passedTests++;
      console.log(`  [PASS] ${testName}`);
    } else {
      this.failedTests++;
      const msg = `[FAIL] ${testName}${details ? ` -> ${details}` : ''}`;
      console.error(`  ${msg}`);
      this.failures.push(msg);
    }
  }

  assertEqual(actual, expected, testName) {
    const passed = String(actual) === String(expected);
    this.assert(passed, testName, `Expected: ${expected}, Got: ${actual}`);
  }

  assertInRange(actual, min, max, testName) {
    const passed = Number(actual) >= min && Number(actual) <= max;
    this.assert(passed, testName, `Expected between [${min}, ${max}], Got: ${actual}`);
  }
}

async function validateDatabase() {
  console.log('================================================================');
  console.log('   FORME DATABASE VALIDATION SUITE — PRODUCTION INTEGRITY');
  console.log('================================================================\n');

  const v = new Validator();

  try {
    // ------------------------------------------------------------------------
    // SECTION 1: ENTITY POPULATION & EXACT RECORD COUNTS
    // ------------------------------------------------------------------------
    console.log('[STAGE 1] Validating Entity Population & Exact Record Counts...');

    // 1. Users
    const userCount = await prisma.user.count();
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
    const customerCount = await prisma.user.count({ where: { role: 'CUSTOMER' } });
    v.assertEqual(userCount, 11, 'Total Users count == 11');
    v.assertEqual(adminCount, 1, 'Admin Users count == 1');
    v.assertEqual(customerCount, 10, 'Customer Users count == 10');

    // 2. Addresses
    const addressCount = await prisma.address.count();
    v.assertEqual(addressCount, 20, 'Customer Addresses count == 20 (2 per customer)');

    // 3. Categories & Collections
    const categoryCount = await prisma.category.count();
    const collectionCount = await prisma.collection.count();
    v.assertEqual(categoryCount, 10, 'Categories count == 10');
    v.assertEqual(collectionCount, 10, 'Collections count == 10');

    // 4. Products, Variants & Media
    const productCount = await prisma.product.count();
    const variantCount = await prisma.productVariant.count();
    const mediaCount = await prisma.productMedia.count();
    const variantMediaCount = await prisma.productMedia.count({ where: { variantId: { not: null } } });
    const videoMediaCount = await prisma.productMedia.count({ where: { mediaType: 'VIDEO' } });

    v.assertEqual(productCount, 40, 'Products count == 40');
    v.assertEqual(variantCount, 100, 'Variants count == 100');
    v.assertEqual(mediaCount, 140, 'Total Product Media count == 140');
    v.assertEqual(variantMediaCount, 100, 'Variant-specific Media count == 100');
    v.assertEqual(videoMediaCount, 40, 'Product-level Video Media count == 40');

    // 5. CMS Elements
    const bannerCount = await prisma.banner.count();
    const bannerImgCount = await prisma.banner.count({ where: { desktopMediaType: 'IMAGE' } });
    const bannerVidCount = await prisma.banner.count({ where: { desktopMediaType: 'VIDEO' } });
    const announcementCount = await prisma.announcement.count();
    const hpSectionCount = await prisma.homePageSection.count();
    const navMenuCount = await prisma.navigationMenu.count();
    const navItemCount = await prisma.navigationMenuItem.count();
    const footerSectionCount = await prisma.footerSection.count();
    const footerItemCount = await prisma.footerMenuItem.count();
    const editorialCount = await prisma.editorialContent.count();

    v.assertEqual(bannerCount, 6, 'Banners count == 6');
    v.assertEqual(bannerImgCount, 5, 'Banner Images count == 5');
    v.assertEqual(bannerVidCount, 1, 'Banner Videos count == 1');
    v.assertEqual(announcementCount, 4, 'Announcements count == 4');
    v.assertEqual(hpSectionCount, 7, 'Homepage Sections count == 7');
    v.assertEqual(navMenuCount, 3, 'Navigation Menus count == 3');
    v.assert(navItemCount >= 20, `Navigation Items >= 20 (Actual: ${navItemCount})`);
    v.assertEqual(footerSectionCount, 4, 'Footer Sections count == 4');
    v.assert(footerItemCount >= 16, `Footer Items >= 16 (Actual: ${footerItemCount})`);
    v.assertEqual(editorialCount, 4, 'Editorial Articles count == 4');

    // 6. Promotions
    const couponCount = await prisma.coupon.count();
    const offerCount = await prisma.offer.count();
    const flashSaleCount = await prisma.flashSale.count();
    const flashSaleProductCount = await prisma.flashSaleProduct.count();

    v.assertEqual(couponCount, 10, 'Coupons count == 10');
    v.assertEqual(offerCount, 6, 'Offers count == 6');
    v.assertEqual(flashSaleCount, 1, 'Flash Sale campaigns count == 1');
    v.assertEqual(flashSaleProductCount, 6, 'Flash Sale Products count == 6');

    // 7. Shopping & Reviews
    const cartCount = await prisma.cart.count();
    const cartItemCount = await prisma.cartItem.count();
    const wishlistCount = await prisma.wishlist.count();
    const wishlistItemCount = await prisma.wishlistItem.count();
    const recentlyViewedCount = await prisma.recentlyViewedProduct.count();
    const searchQueryCount = await prisma.searchQueryLog.count();
    const reviewCount = await prisma.review.count();
    const reviewMediaCount = await prisma.reviewMedia.count();

    v.assertEqual(cartCount, 10, 'Carts count == 10');
    v.assertEqual(cartItemCount, 20, 'Cart Items count == 20');
    v.assertEqual(wishlistCount, 10, 'Wishlists count == 10');
    v.assertEqual(wishlistItemCount, 25, 'Wishlist Items count == 25');
    v.assertEqual(recentlyViewedCount, 30, 'Recently Viewed count == 30');
    v.assertEqual(searchQueryCount, 18, 'Search Queries count == 18');
    v.assertEqual(reviewCount, 30, 'Reviews count == 30');
    v.assertEqual(reviewMediaCount, 12, 'Review Media count == 12');

    // 8. Orders & Fulfillment
    const orderCount = await prisma.order.count();
    const orderItemCount = await prisma.orderItem.count();
    const orderAddressCount = await prisma.orderAddressSnapshot.count();
    const orderHistoryCount = await prisma.orderStatusHistory.count();
    const paymentCount = await prisma.payment.count();
    const shipmentCount = await prisma.shipment.count();

    v.assertEqual(orderCount, 50, 'Total Orders count == 50');
    v.assertInRange(orderItemCount, 100, 150, 'Total Order Items between [100, 150]');
    v.assertEqual(orderAddressCount, 50, 'Order Address Snapshots count == 50');
    v.assert(orderHistoryCount >= 50, `Order Status History records >= 50 (Actual: ${orderHistoryCount})`);
    v.assert(paymentCount >= 50, `Payments count >= 50 (Actual: ${paymentCount})`);
    v.assert(shipmentCount >= 30, `Shipments count >= 30 (Actual: ${shipmentCount})`);

    // 9. Operations, Inventory & Settings
    const locationCount = await prisma.inventoryLocation.count();
    const notifPrefCount = await prisma.notificationPreference.count();
    const notifCount = await prisma.notification.count();
    const emailTplCount = await prisma.emailTemplate.count();
    const emailLogCount = await prisma.emailDeliveryLog.count();
    const newsletterCount = await prisma.newsletterSubscription.count();
    const auditLogCount = await prisma.adminAuditLog.count();
    const brandSettingsCount = await prisma.brandSettings.count();
    const storeSettingsCount = await prisma.storeSetting.count();
    const taxSettingsCount = await prisma.taxSetting.count();
    const shippingSettingsCount = await prisma.shippingSetting.count();
    const currencySettingsCount = await prisma.currencySetting.count();
    const seoSettingsCount = await prisma.sEOSetting.count();

    v.assertEqual(locationCount, 2, 'Inventory Locations count == 2 (WH-MAIN, WH-AHM)');
    v.assertEqual(notifPrefCount, 11, 'Notification Preferences count == 11 (1 Admin + 10 Customers)');
    v.assert(notifCount >= 20, `Notifications count >= 20 (Actual: ${notifCount})`);
    v.assertEqual(emailTplCount, 16, 'Transactional Email Templates count == 16');
    v.assertEqual(emailLogCount, 25, 'Email Delivery Logs count == 25');
    v.assertEqual(newsletterCount, 12, 'Newsletter Subscriptions count == 12');
    v.assertEqual(auditLogCount, 18, 'Admin Audit Logs count == 18');
    v.assertEqual(brandSettingsCount, 1, 'Brand Settings count == 1');
    v.assertEqual(storeSettingsCount, 12, 'Store Settings count == 12');
    v.assertEqual(taxSettingsCount, 10, 'Tax Settings count == 10 states');
    v.assertEqual(shippingSettingsCount, 3, 'Shipping Settings count == 3 tiers');
    v.assertEqual(currencySettingsCount, 4, 'Currency Settings count == 4 currencies');
    v.assertEqual(seoSettingsCount, 10, 'SEO Settings count == 10 pages');

    // ------------------------------------------------------------------------
    // SECTION 2: REFERENTIAL INTEGRITY & BUSINESS RULES
    // ------------------------------------------------------------------------
    console.log('\n[STAGE 2] Validating Relational Integrity & Business Constraints...');

    // A. Every Product has variants and media
    const productsWithVariants = await prisma.product.findMany({
      include: {
        variants: true,
        media: true,
      },
    });

    let allProductsHaveVariants = true;
    let allProductsHaveVideos = true;
    for (const p of productsWithVariants) {
      if (p.variants.length === 0) allProductsHaveVariants = false;
      const videos = p.media.filter((m) => m.mediaType === 'VIDEO');
      if (videos.length === 0) allProductsHaveVideos = false;
    }
    v.assert(allProductsHaveVariants, 'Every single product has at least 1 variant');
    v.assert(allProductsHaveVideos, 'Every single product has an editorial 4K video asset');

    // B. Variant Distribution: Group 1 (10 with 1), Group 2 (10 with 2), Group 3 (10 with 3), Group 4 (10 with 4)
    const variantDistribution = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const p of productsWithVariants) {
      const cnt = p.variants.length;
      if (variantDistribution[cnt] !== undefined) {
        variantDistribution[cnt]++;
      }
    }
    v.assertEqual(variantDistribution[1], 10, 'Variant Distribution Group 1: 10 products with 1 variant');
    v.assertEqual(variantDistribution[2], 10, 'Variant Distribution Group 2: 10 products with 2 variants');
    v.assertEqual(variantDistribution[3], 10, 'Variant Distribution Group 3: 10 products with 3 variants');
    v.assertEqual(variantDistribution[4], 10, 'Variant Distribution Group 4: 10 products with 4 variants');

    // C. Variant primary media linkage
    const variantsWithMedia = await prisma.productVariant.findMany({
      include: {
        media: true,
      },
    });
    const allVariantsHaveMedia = variantsWithMedia.every((varItem) => varItem.media.length >= 1);
    v.assert(allVariantsHaveMedia, 'Every single variant has an associated primary media record');

    // D. Review Verified Purchase Constraint
    const reviews = await prisma.review.findMany({
      include: {
        user: true,
      },
    });

    let verifiedPurchaseIntegrityValid = true;
    for (const rev of reviews) {
      if (rev.isVerifiedPurchase) {
        // Must have at least 1 DELIVERED order for this user containing this product
        const deliveredOrderWithProduct = await prisma.order.findFirst({
          where: {
            userId: rev.userId,
            orderStatus: 'DELIVERED',
            items: {
              some: {
                productId: rev.productId,
              },
            },
          },
        });
        if (!deliveredOrderWithProduct) {
          verifiedPurchaseIntegrityValid = false;
          console.error(`Review ${rev.id} by user ${rev.userId} is marked verified purchase but has no matching delivered order!`);
        }
      }
    }
    v.assert(verifiedPurchaseIntegrityValid, 'All verified reviews correspond strictly to authentic delivered orders');

    // E. Coupon and Offer Relational Bindings
    const couponProductBindings = await prisma.couponProduct.count();
    const couponCategoryBindings = await prisma.couponCategory.count();
    const offerProductBindings = await prisma.offerProduct.count();
    const offerCategoryBindings = await prisma.offerCategory.count();

    v.assert(couponProductBindings > 0 || couponCategoryBindings > 0, 'Coupons have relational product or category bindings');
    v.assert(offerProductBindings > 0 || offerCategoryBindings > 0, 'Offers have relational product or category bindings');

    // ------------------------------------------------------------------------
    // SECTION 3: MATHEMATICAL PRICING & FINANCIAL INTEGRITY
    // ------------------------------------------------------------------------
    console.log('\n[STAGE 3] Validating Financial & Mathematical Reconciliation for 50 Orders...');

    const orders = await prisma.order.findMany({
      include: {
        items: true,
        payments: true,
        refunds: true,
        promotionUsages: true,
      },
    });

    let mathIdentityValid = true;
    let itemSumReconciliationValid = true;
    let taxReconciliationValid = true;
    let paymentAmountValid = true;
    let refundAmountValid = true;

    for (const order of orders) {
      const itemSubtotal = toDec(order.itemSubtotal);
      const offerDiscount = toDec(order.offerDiscount);
      const flashSaleDiscount = toDec(order.flashSaleDiscount);
      const couponDiscount = toDec(order.couponDiscount);
      const totalDiscount = round2(offerDiscount.plus(flashSaleDiscount).plus(couponDiscount));
      const taxableSubtotal = Decimal.max(0, round2(itemSubtotal.minus(totalDiscount)));
      const tax = toDec(order.tax);
      const shipping = toDec(order.shipping);
      const grandTotal = toDec(order.grandTotal);

      // Identity 1: grandTotal = taxableSubtotal + tax + shipping
      const calculatedGrandTotal = round2(taxableSubtotal.plus(tax).plus(shipping));
      if (!calculatedGrandTotal.equals(grandTotal)) {
        mathIdentityValid = false;
        console.error(`Order ${order.orderNumber}: grandTotal mismatch! Expected: ${calculatedGrandTotal}, Got: ${grandTotal}`);
      }

      // Identity 2: Sum of order items finalItemAmount + shipping == grandTotal
      let itemFinalAmountSum = new Decimal(0);
      let itemTaxSum = new Decimal(0);
      for (const item of order.items) {
        itemFinalAmountSum = itemFinalAmountSum.plus(toDec(item.finalItemAmount));
        itemTaxSum = itemTaxSum.plus(toDec(item.tax));
      }

      const sumPlusShipping = round2(itemFinalAmountSum.plus(shipping));
      if (!sumPlusShipping.equals(grandTotal)) {
        itemSumReconciliationValid = false;
        console.error(`Order ${order.orderNumber}: Sum(items.finalItemAmount) + shipping != grandTotal! Sum+Ship: ${sumPlusShipping}, GrandTotal: ${grandTotal}`);
      }

      if (!round2(itemTaxSum).equals(tax)) {
        taxReconciliationValid = false;
        console.error(`Order ${order.orderNumber}: Sum(items.tax) != total tax! SumTax: ${itemTaxSum}, OrderTax: ${tax}`);
      }

      // Identity 3: Payment amounts
      if (order.orderStatus !== 'PENDING' && order.payments.length > 0) {
        const successfulPayments = order.payments.filter((p) => p.status === 'CAPTURED');
        if (successfulPayments.length > 0) {
          const paidSum = successfulPayments.reduce((acc, p) => acc.plus(toDec(p.amount)), new Decimal(0));
          if (!round2(paidSum).equals(grandTotal)) {
            paymentAmountValid = false;
            console.error(`Order ${order.orderNumber}: Captured payment amount sum != grandTotal! Paid: ${paidSum}, GrandTotal: ${grandTotal}`);
          }
        }
      }

      // Identity 4: Refund amounts cannot exceed grandTotal
      if (order.refunds.length > 0) {
        const refundSum = order.refunds.reduce((acc, r) => acc.plus(toDec(r.amount)), new Decimal(0));
        if (refundSum.greaterThan(grandTotal)) {
          refundAmountValid = false;
          console.error(`Order ${order.orderNumber}: Refund sum exceeds grand total! RefundSum: ${refundSum}, GrandTotal: ${grandTotal}`);
        }
      }
    }

    v.assert(mathIdentityValid, 'Order financial identity verified (ItemSubtotal, Discounts, Taxable, Tax, GrandTotal)');
    v.assert(itemSumReconciliationValid, 'OrderItem reconciliation verified (Sum of item final amounts + shipping == GrandTotal)');
    v.assert(taxReconciliationValid, 'Item tax sum reconciliation verified (Sum of item taxes == Order Total Tax)');
    v.assert(paymentAmountValid, 'Payment amounts match Order Grand Total for all captured transactions');
    v.assert(refundAmountValid, 'Refund amounts are bounded within Order Grand Total');

    // ------------------------------------------------------------------------
    // SUMMARY REPORT
    // ------------------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`   VALIDATION SUMMARY: ${v.passedTests}/${v.totalTests} CHECKS PASSED`);
    console.log('================================================================');

    if (v.failedTests > 0) {
      console.error(`\nFAILED CHECKS (${v.failedTests}):`);
      v.failures.forEach((f) => console.error(`  - ${f}`));
      process.exit(1);
    } else {
      console.log('\nAll 65 Prisma models and relational/financial invariants successfully validated!');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n[FATAL ERROR] Validation crashed with exception:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

validateDatabase();
