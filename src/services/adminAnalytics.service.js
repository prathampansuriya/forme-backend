import prisma from '../config/prisma.config.js';

export class AdminAnalyticsService {
  /**
   * Retrieves high-level platform KPI summary strictly calculated from authoritative database records.
   *
   * @param {Object} [filter]
   * @param {string} [filter.startDate]
   * @param {string} [filter.endDate]
   */
  async getOverviewKPIs({ startDate, endDate } = {}) {
    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
    const hasDateFilter = startDate || endDate;

    const orderWhere = hasDateFilter ? { placedAt: dateFilter } : {};
    const paymentWhere = {
      status: 'CAPTURED',
      ...(hasDateFilter ? { createdAt: dateFilter } : {}),
    };
    const refundWhere = {
      status: 'PROCESSED',
      ...(hasDateFilter ? { createdAt: dateFilter } : {}),
    };

    // 1. Order Counts and Status Breakdown
    const [
      allOrders,
      capturedPayments,
      processedRefunds,
      registeredCustomers,
      activeCustomers,
      capturedCount,
      pendingCount,
      failedCount,
    ] = await Promise.all([
      prisma.order.findMany({
        where: orderWhere,
        select: {
          id: true,
          orderStatus: true,
          grandTotal: true,
          itemSubtotal: true,
          mrpSubtotal: true,
          offerDiscount: true,
          flashSaleDiscount: true,
          couponDiscount: true,
          tax: true,
          shipping: true,
          placedAt: true,
        },
      }),
      prisma.payment.findMany({
        where: paymentWhere,
        select: {
          id: true,
          amount: true,
          orderId: true,
        },
      }),
      prisma.refund.findMany({
        where: refundWhere,
        select: {
          id: true,
          amount: true,
        },
      }),
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
      prisma.user.count({ where: { role: 'CUSTOMER', status: 'ACTIVE' } }),
      prisma.payment.count({
        where: { status: 'CAPTURED', ...(hasDateFilter ? { createdAt: dateFilter } : {}) },
      }),
      prisma.payment.count({
        where: { status: 'PENDING', ...(hasDateFilter ? { createdAt: dateFilter } : {}) },
      }),
      prisma.payment.count({
        where: { status: 'FAILED', ...(hasDateFilter ? { createdAt: dateFilter } : {}) },
      }),
    ]);

    const totalOrders = allOrders.length;
    const nonCancelledOrders = allOrders.filter((o) => o.orderStatus !== 'CANCELLED');
    const deliveredOrders = allOrders.filter((o) => o.orderStatus === 'DELIVERED').length;
    const cancelledOrders = allOrders.filter((o) => o.orderStatus === 'CANCELLED').length;

    // Financial Reconciliation Breakdown
    const gmv = nonCancelledOrders.reduce((sum, o) => sum + Number(o.grandTotal || 0), 0);
    const grossSales = nonCancelledOrders.reduce(
      (sum, o) => sum + Number(o.mrpSubtotal || o.itemSubtotal || o.grandTotal || 0),
      0
    );
    const productDiscounts = nonCancelledOrders.reduce(
      (sum, o) =>
        sum +
        Math.max(
          0,
          Number(o.mrpSubtotal || o.itemSubtotal || 0) - Number(o.itemSubtotal || 0)
        ),
      0
    );
    const offerDiscounts = nonCancelledOrders.reduce((sum, o) => sum + Number(o.offerDiscount || 0), 0);
    const flashSaleDiscounts = nonCancelledOrders.reduce((sum, o) => sum + Number(o.flashSaleDiscount || 0), 0);
    const couponDiscounts = nonCancelledOrders.reduce((sum, o) => sum + Number(o.couponDiscount || 0), 0);
    const totalDiscounts = productDiscounts + offerDiscounts + flashSaleDiscounts + couponDiscounts;
    const taxCollected = nonCancelledOrders.reduce((sum, o) => sum + Number(o.tax || 0), 0);
    const shippingCollected = nonCancelledOrders.reduce((sum, o) => sum + Number(o.shipping || 0), 0);
    const netSales = Math.max(0, grossSales - totalDiscounts);

    // Net Collected Revenue = Sum of captured payments - Sum of processed refunds
    const grossCaptured = capturedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const totalRefunded = processedRefunds.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const netCollectedRevenue = Math.max(0, grossCaptured - totalRefunded);

    // Average Order Value (AOV)
    const paidOrdersCount = capturedPayments.length;
    const aov =
      paidOrdersCount > 0
        ? netCollectedRevenue / paidOrdersCount
        : nonCancelledOrders.length > 0
        ? gmv / nonCancelledOrders.length
        : 0;

    // Cancellation Rate (%)
    const cancellationRate = totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;

    // Order status breakdown map
    const statusBreakdown = {};
    for (const order of allOrders) {
      statusBreakdown[order.orderStatus] = (statusBreakdown[order.orderStatus] || 0) + 1;
    }

    return {
      kpis: {
        gmv: Number(gmv.toFixed(2)),
        grossSales: Number(grossSales.toFixed(2)),
        netSales: Number(netSales.toFixed(2)),
        productDiscounts: Number(productDiscounts.toFixed(2)),
        offerDiscounts: Number(offerDiscounts.toFixed(2)),
        flashSaleDiscounts: Number(flashSaleDiscounts.toFixed(2)),
        couponDiscounts: Number(couponDiscounts.toFixed(2)),
        totalDiscounts: Number(totalDiscounts.toFixed(2)),
        taxCollected: Number(taxCollected.toFixed(2)),
        shippingCollected: Number(shippingCollected.toFixed(2)),
        grossCaptured: Number(grossCaptured.toFixed(2)),
        totalRefunded: Number(totalRefunded.toFixed(2)),
        netCollectedRevenue: Number(netCollectedRevenue.toFixed(2)),
        totalOrders,
        deliveredOrders,
        cancelledOrders,
        cancellationRate: Number(cancellationRate.toFixed(2)),
        averageOrderValue: Number(aov.toFixed(2)),
        registeredCustomers,
        activeCustomers,
        paymentsCapturedCount: capturedCount,
        pendingPaymentsCount: pendingCount,
        failedPaymentsCount: failedCount,
      },
      statusBreakdown,
      timeframe: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
    };
  }

  /**
   * Retrieves sales and revenue grouped by date (daily, weekly, or monthly).
   */
  async getSalesTrends({ days = 30, startDate = null, endDate = null, interval = 'daily' } = {}) {
    const numDays = Math.min(365, Math.max(1, parseInt(days, 10) || 30));
    let start = startDate ? new Date(startDate) : new Date();
    if (!startDate) {
      start.setDate(start.getDate() - numDays);
    }
    const end = endDate ? new Date(endDate) : new Date();

    const orders = await prisma.order.findMany({
      where: {
        placedAt: { gte: start, lte: end },
        orderStatus: { not: 'CANCELLED' },
      },
      select: {
        id: true,
        grandTotal: true,
        paymentStatus: true,
        placedAt: true,
      },
      orderBy: { placedAt: 'asc' },
    });

    const trendMap = new Map();

    // Helper for interval grouping keys
    const getKey = (d) => {
      if (interval === 'monthly') {
        return d.toISOString().slice(0, 7); // YYYY-MM
      }
      return d.toISOString().split('T')[0]; // YYYY-MM-DD
    };

    if (!startDate && interval === 'daily') {
      for (let i = 0; i < numDays; i++) {
        const d = new Date();
        d.setDate(d.getDate() - (numDays - 1 - i));
        const key = getKey(d);
        trendMap.set(key, { date: key, ordersCount: 0, revenue: 0, capturedRevenue: 0 });
      }
    }

    for (const order of orders) {
      const key = getKey(order.placedAt);
      if (!trendMap.has(key)) {
        trendMap.set(key, { date: key, ordersCount: 0, revenue: 0, capturedRevenue: 0 });
      }
      const item = trendMap.get(key);
      item.ordersCount += 1;
      item.revenue += Number(order.grandTotal || 0);
      if (order.paymentStatus === 'CAPTURED') {
        item.capturedRevenue += Number(order.grandTotal || 0);
      }
    }

    return Array.from(trendMap.values()).map((row) => ({
      ...row,
      revenue: Number(row.revenue.toFixed(2)),
      capturedRevenue: Number(row.capturedRevenue.toFixed(2)),
    }));
  }

  /**
   * Returns breakdown of orders and revenue grouped by payment method.
   */
  async getPaymentMethodBreakdown() {
    const payments = await prisma.payment.findMany({
      where: { status: 'CAPTURED' },
      select: {
        method: true,
        amount: true,
      },
    });

    const breakdown = {
      RAZORPAY_UPI: { count: 0, totalAmount: 0 },
      RAZORPAY_CARD: { count: 0, totalAmount: 0 },
      RAZORPAY_NETBANKING: { count: 0, totalAmount: 0 },
      COD: { count: 0, totalAmount: 0 },
    };

    for (const p of payments) {
      if (!breakdown[p.method]) {
        breakdown[p.method] = { count: 0, totalAmount: 0 };
      }
      breakdown[p.method].count += 1;
      breakdown[p.method].totalAmount += Number(p.amount);
    }

    return Object.entries(breakdown).map(([method, data]) => ({
      method,
      count: data.count,
      totalAmount: Number(data.totalAmount.toFixed(2)),
    }));
  }

  /**
   * Identifies top-performing products by units sold and gross revenue from OrderItem records.
   */
  async getBestSellingProducts({ limit = 10 } = {}) {
    const take = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));

    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: { orderStatus: { not: 'CANCELLED' } },
      },
      select: {
        productId: true,
        productName: true,
        productSlug: true,
        sku: true,
        productImage: true,
        quantity: true,
        finalItemAmount: true,
      },
    });

    const productAggMap = new Map();

    for (const item of orderItems) {
      const pid = item.productId || item.sku;
      if (!productAggMap.has(pid)) {
        productAggMap.set(pid, {
          productId: item.productId,
          name: item.productName || 'Unknown Product',
          slug: item.productSlug || '',
          sku: item.sku || '',
          imageUrl: item.productImage || null,
          unitsSold: 0,
          totalRevenue: 0,
        });
      }
      const agg = productAggMap.get(pid);
      agg.unitsSold += item.quantity;
      agg.totalRevenue += Number(item.finalItemAmount);
    }

    const sorted = Array.from(productAggMap.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, take);

    // Enrich missing images with product primary media if available
    const missingImgPids = sorted.filter((p) => !p.imageUrl && p.productId).map((p) => p.productId);
    if (missingImgPids.length > 0) {
      const medias = await prisma.productMedia.findMany({
        where: { productId: { in: missingImgPids } },
        orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }],
      });
      const mediaMap = new Map();
      for (const m of medias) {
        if (!mediaMap.has(m.productId)) {
          mediaMap.set(m.productId, m.secureUrl || m.thumbnailUrl);
        }
      }
      for (const p of sorted) {
        if (!p.imageUrl && mediaMap.has(p.productId)) {
          p.imageUrl = mediaMap.get(p.productId);
        }
      }
    }

    return sorted.map((p) => ({
      ...p,
      totalRevenue: Number(p.totalRevenue.toFixed(2)),
    }));
  }

  /**
   * Calculates category sales performance.
   */
  async getCategoryPerformance() {
    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: { orderStatus: { not: 'CANCELLED' } },
      },
      select: {
        quantity: true,
        finalItemAmount: true,
        product: {
          select: {
            category: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
      },
    });

    const categoryMap = new Map();

    for (const item of orderItems) {
      const cat = item.product?.category;
      const catId = cat ? cat.id : 'uncategorized';
      const catName = cat ? cat.name : 'Uncategorized';

      if (!categoryMap.has(catId)) {
        categoryMap.set(catId, {
          categoryId: catId,
          name: catName,
          unitsSold: 0,
          totalRevenue: 0,
        });
      }

      const agg = categoryMap.get(catId);
      agg.unitsSold += item.quantity;
      agg.totalRevenue += Number(item.finalItemAmount);
    }

    return Array.from(categoryMap.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .map((c) => ({
        ...c,
        totalRevenue: Number(c.totalRevenue.toFixed(2)),
      }));
  }

  /**
   * Calculates collection sales performance.
   */
  async getCollectionPerformance() {
    const collections = await prisma.collection.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        collectionProducts: {
          select: { productId: true },
        },
      },
    });

    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: { orderStatus: { not: 'CANCELLED' } },
      },
      select: {
        productId: true,
        quantity: true,
        finalItemAmount: true,
      },
    });

    const productSalesMap = new Map();
    for (const item of orderItems) {
      if (!item.productId) continue;
      const current = productSalesMap.get(item.productId) || { units: 0, revenue: 0 };
      current.units += item.quantity;
      current.revenue += Number(item.finalItemAmount);
      productSalesMap.set(item.productId, current);
    }

    const performance = collections.map((col) => {
      let unitsSold = 0;
      let totalRevenue = 0;

      for (const cp of col.collectionProducts) {
        const sales = productSalesMap.get(cp.productId);
        if (sales) {
          unitsSold += sales.units;
          totalRevenue += sales.revenue;
        }
      }

      return {
        collectionId: col.id,
        name: col.name,
        slug: col.slug,
        unitsSold,
        totalRevenue: Number(totalRevenue.toFixed(2)),
      };
    });

    return performance.sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  /**
   * Comprehensive inventory valuation report based on current variant stock and retail pricing.
   */
  async getInventoryValuation() {
    const variants = await prisma.productVariant.findMany({
      select: {
        id: true,
        sku: true,
        stockQuantity: true,
        reservedQuantity: true,
        availableQuantity: true,
        priceOverride: true,
        status: true,
        product: {
          select: {
            id: true,
            name: true,
            sellingPrice: true,
            compareAtPrice: true,
          },
        },
      },
    });

    let totalStockUnits = 0;
    let totalReservedUnits = 0;
    let totalRetailValuation = 0;
    let totalCompareValuation = 0;
    let outOfStockCount = 0;
    let lowStockCount = 0;

    for (const v of variants) {
      const stock = v.stockQuantity;
      const reserved = v.reservedQuantity;
      const retailPrice = Number(v.priceOverride || v.product.sellingPrice || 0);
      const comparePrice = Number(v.product.compareAtPrice || retailPrice);

      totalStockUnits += stock;
      totalReservedUnits += reserved;
      totalRetailValuation += stock * retailPrice;
      totalCompareValuation += stock * comparePrice;

      if (stock <= 0) {
        outOfStockCount += 1;
      } else if (stock <= 5) {
        lowStockCount += 1;
      }
    }

    return {
      totalVariants: variants.length,
      totalStockUnits,
      totalReservedUnits,
      totalAvailableUnits: Math.max(0, totalStockUnits - totalReservedUnits),
      outOfStockVariantsCount: outOfStockCount,
      lowStockVariantsCount: lowStockCount,
      totalRetailValuation: Number(totalRetailValuation.toFixed(2)),
      totalCompareValuation: Number(totalCompareValuation.toFixed(2)),
    };
  }

  /**
   * Conversion funnel metrics tracking customer journey from view to cart to order to payment.
   */
  async getConversionFunnel() {
    const [viewsCount, cartItemsCount, ordersCount, paidOrdersCount] = await Promise.all([
      prisma.recentlyViewedProduct.count(),
      prisma.cartItem.count(),
      prisma.order.count(),
      prisma.payment.count({ where: { status: 'CAPTURED' } }),
    ]);

    const viewToCartRate = viewsCount > 0 ? (cartItemsCount / viewsCount) * 100 : 0;
    const cartToOrderRate = cartItemsCount > 0 ? (ordersCount / cartItemsCount) * 100 : 0;
    const orderToPaymentRate = ordersCount > 0 ? (paidOrdersCount / ordersCount) * 100 : 0;

    return {
      funnel: [
        { stage: 'PRODUCT_VIEWS', count: viewsCount },
        { stage: 'CART_ITEMS_ADDED', count: cartItemsCount },
        { stage: 'ORDERS_PLACED', count: ordersCount },
        { stage: 'PAYMENTS_CAPTURED', count: paidOrdersCount },
      ],
      conversionRates: {
        viewToCartPercentage: Number(viewToCartRate.toFixed(2)),
        cartToOrderPercentage: Number(cartToOrderRate.toFixed(2)),
        orderToPaymentPercentage: Number(orderToPaymentRate.toFixed(2)),
      },
    };
  }

  /**
   * Promotional campaigns performance: sales driven by Flash Sales and Offers.
   */
  async getPromotionPerformance() {
    const [flashSales, offers, orders] = await Promise.all([
      prisma.flashSale.findMany({
        select: { id: true, name: true, slug: true, status: true, startTime: true, endTime: true },
      }),
      prisma.offer.findMany({
        select: { id: true, name: true, slug: true, isActive: true, discountType: true, discountValue: true },
      }),
      prisma.order.findMany({
        where: { orderStatus: { not: 'CANCELLED' } },
        select: {
          id: true,
          grandTotal: true,
          offerDiscount: true,
          flashSaleDiscount: true,
          appliedPromotionSnapshot: true,
        },
      }),
    ]);

    const promoMap = new Map();

    for (const fs of flashSales) {
      promoMap.set(`fs_${fs.id}`, {
        id: fs.id,
        name: fs.name,
        slug: fs.slug,
        type: 'FLASH_SALE',
        ordersCount: 0,
        totalDiscountGiven: 0,
        totalSalesVolume: 0,
      });
    }

    for (const off of offers) {
      promoMap.set(`off_${off.id}`, {
        id: off.id,
        name: off.name,
        slug: off.slug,
        type: 'OFFER',
        ordersCount: 0,
        totalDiscountGiven: 0,
        totalSalesVolume: 0,
      });
    }

    for (const o of orders) {
      const snap = o.appliedPromotionSnapshot;
      if (Array.isArray(snap)) {
        for (const itemPromo of snap) {
          const key = itemPromo.type === 'FLASH_SALE' ? `fs_${itemPromo.id || itemPromo.flashSaleId}` : `off_${itemPromo.id}`;
          if (promoMap.has(key)) {
            const entry = promoMap.get(key);
            entry.ordersCount += 1;
            entry.totalDiscountGiven += Number(itemPromo.discountAmount || 0);
            entry.totalSalesVolume += Number(o.grandTotal || 0);
          }
        }
      } else if (Number(o.flashSaleDiscount) > 0 || Number(o.offerDiscount) > 0) {
        // Fallback for orders with discounts
        if (Number(o.flashSaleDiscount) > 0 && flashSales.length > 0) {
          const entry = promoMap.get(`fs_${flashSales[0].id}`);
          if (entry) {
            entry.ordersCount += 1;
            entry.totalDiscountGiven += Number(o.flashSaleDiscount);
            entry.totalSalesVolume += Number(o.grandTotal);
          }
        }
        if (Number(o.offerDiscount) > 0 && offers.length > 0) {
          const entry = promoMap.get(`off_${offers[0].id}`);
          if (entry) {
            entry.ordersCount += 1;
            entry.totalDiscountGiven += Number(o.offerDiscount);
            entry.totalSalesVolume += Number(o.grandTotal);
          }
        }
      }
    }

    return Array.from(promoMap.values()).map((p) => ({
      ...p,
      totalDiscountGiven: Number(p.totalDiscountGiven.toFixed(2)),
      totalSalesVolume: Number(p.totalSalesVolume.toFixed(2)),
    }));
  }

  /**
   * Coupon performance: redemption frequency and sales generated.
   */
  async getCouponPerformance() {
    const coupons = await prisma.coupon.findMany({
      include: {
        usages: {
          select: {
            discountAmountCaptured: true,
            order: {
              select: {
                grandTotal: true,
                orderStatus: true,
              },
            },
          },
        },
      },
    });

    return coupons.map((c) => {
      const validUsages = (c.usages || []).filter((u) => u.order?.orderStatus !== 'CANCELLED');
      const totalDiscountGiven = validUsages.reduce(
        (sum, u) => sum + Number(u.discountAmountCaptured || 0),
        0
      );
      const totalSalesDriven = validUsages.reduce(
        (sum, u) => sum + Number(u.order?.grandTotal || 0),
        0
      );

      return {
        id: c.id,
        code: c.code,
        discountType: c.discountType,
        discountValue: Number(c.discountValue),
        timesRedeemed: c.timesRedeemed || validUsages.length,
        totalDiscountGiven: Number(totalDiscountGiven.toFixed(2)),
        totalSalesDriven: Number(totalSalesDriven.toFixed(2)),
        isActive: c.isActive,
      };
    });
  }
}

export const adminAnalyticsService = new AdminAnalyticsService();
export default adminAnalyticsService;
