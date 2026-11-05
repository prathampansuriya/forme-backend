import prisma from '../config/prisma.config.js';
import ApplicationError from '../utils/ApplicationError.js';
import { logger } from '../config/logger.config.js';

class InventoryService {
  /**
   * Calculates live available stock for a variant based on the authoritative formula:
   * Available Stock = Physical Stock − Active Reserved Stock
   */
  async calculateAvailableStock(variantId) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      select: {
        id: true,
        sku: true,
        stockQuantity: true,
        reservedQuantity: true,
        availableQuantity: true,
        status: true,
      },
    });

    if (!variant) {
      throw ApplicationError.notFound('Product variant not found.', 'VARIANT_NOT_FOUND');
    }

    const now = new Date();

    // Query active non-expired reservations
    const reservationAgg = await prisma.inventoryReservation.aggregate({
      where: {
        variantId,
        status: 'ACTIVE',
        expiresAt: { gt: now },
      },
      _sum: { quantity: true },
    });

    const activeReserved = reservationAgg._sum.quantity || 0;
    const available = Math.max(0, variant.stockQuantity - activeReserved);

    return {
      variantId: variant.id,
      sku: variant.sku,
      physicalStock: variant.stockQuantity,
      reservedStock: activeReserved,
      availableStock: available,
      status: variant.status,
      inStock: available > 0,
    };
  }

  /**
   * Reconciles variant stock fields in PostgreSQL to ensure zero drift.
   */
  async reconcileVariantStock(variantId, tx = prisma) {
    const now = new Date();

    const reservationAgg = await tx.inventoryReservation.aggregate({
      where: {
        variantId,
        status: 'ACTIVE',
        expiresAt: { gt: now },
      },
      _sum: { quantity: true },
    });

    const activeReserved = reservationAgg._sum.quantity || 0;

    const variant = await tx.productVariant.findUnique({
      where: { id: variantId },
      select: { stockQuantity: true },
    });

    if (!variant) return null;

    const available = Math.max(0, variant.stockQuantity - activeReserved);

    return tx.productVariant.update({
      where: { id: variantId },
      data: {
        reservedQuantity: activeReserved,
        availableQuantity: available,
      },
    });
  }

  /**
   * Creates a 15-minute optimistic inventory reservation during checkout initiation.
   * Uses PostgreSQL row-level locking (SELECT ... FOR UPDATE) to guarantee atomic isolation
   * and prevent overselling under high concurrency.
   */
  async createReservation({ items = [], userId = null, cartId = null, checkoutSessionId = null, ttlMinutes = 15 }) {
    if (!items || items.length === 0) {
      throw ApplicationError.badRequest('Items array is required for stock reservation.');
    }

    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    return prisma.$transaction(async (tx) => {
      const createdReservations = [];

      for (const item of items) {
        const { variantId, quantity } = item;

        // 1. Acquire exclusive row lock on ProductVariant to prevent race conditions
        const lockedRows = await tx.$queryRaw`
          SELECT id, "productId", sku, "stockQuantity", "reservedQuantity", "availableQuantity", status
          FROM "ProductVariant"
          WHERE id = ${variantId}
          FOR UPDATE
        `;

        if (!lockedRows || lockedRows.length === 0) {
          throw ApplicationError.notFound(`Variant ${variantId} does not exist.`, 'VARIANT_NOT_FOUND');
        }

        const variant = lockedRows[0];

        if (variant.status !== 'ACTIVE') {
          throw ApplicationError.badRequest(
            `Variant ${variant.sku} is not active and cannot be reserved.`,
            'VARIANT_INACTIVE'
          );
        }

        // 2. Evaluate active non-expired reservations for this variant
        const activeResAgg = await tx.inventoryReservation.aggregate({
          where: {
            variantId,
            status: 'ACTIVE',
            expiresAt: { gt: new Date() },
          },
          _sum: { quantity: true },
        });

        const currentActiveReserved = activeResAgg._sum.quantity || 0;
        const trulyAvailable = variant.stockQuantity - currentActiveReserved;

        if (trulyAvailable < quantity) {
          throw ApplicationError.badRequest(
            `Insufficient stock for garment variant ${variant.sku}. Requested ${quantity}, but only ${Math.max(0, trulyAvailable)} unit(s) are available.`,
            'INSUFFICIENT_STOCK'
          );
        }

        // 3. Create Reservation record
        const reservation = await tx.inventoryReservation.create({
          data: {
            variantId,
            cartId,
            checkoutSessionId,
            quantity,
            expiresAt,
            status: 'ACTIVE',
          },
        });

        // 4. Update variant reserved and available stock
        const newReserved = currentActiveReserved + quantity;
        const newAvailable = Math.max(0, variant.stockQuantity - newReserved);

        await tx.productVariant.update({
          where: { id: variantId },
          data: {
            reservedQuantity: newReserved,
            availableQuantity: newAvailable,
          },
        });

        // 5. Write audit log
        await tx.inventoryLog.create({
          data: {
            variantId,
            previousStock: variant.stockQuantity,
            newStock: variant.stockQuantity,
            changeQuantity: 0, // Physical stock unchanged; reservation locked
            reason: `15-Minute Checkout Reservation (Hold: ${quantity} units until ${expiresAt.toISOString()})`,
            referenceType: 'CHECKOUT_RESERVATION',
            referenceId: reservation.id,
            adminUserId: userId,
          },
        });

        createdReservations.push({
          id: reservation.id,
          variantId,
          sku: variant.sku,
          quantity,
          expiresAt,
          status: reservation.status,
        });
      }

      logger.info(`[INVENTORY] Created ${createdReservations.length} reservation(s) expiring at ${expiresAt.toISOString()}`);
      return {
        checkoutSessionId,
        expiresAt,
        ttlMinutes,
        reservations: createdReservations,
      };
    });
  }

  /**
   * Releases active reservations when customer cancels or leaves checkout.
   */
  async releaseReservation({ reservationIds = [], checkoutSessionId = null, cartId = null, orderId = null }) {
    return prisma.$transaction(async (tx) => {
      const where = { status: 'ACTIVE' };

      if (reservationIds && reservationIds.length > 0) {
        where.id = { in: reservationIds };
      } else if (checkoutSessionId) {
        where.checkoutSessionId = checkoutSessionId;
      } else if (cartId) {
        where.cartId = cartId;
      } else if (orderId) {
        where.orderId = orderId;
      } else {
        throw ApplicationError.badRequest('Reservation IDs, checkoutSessionId, cartId, or orderId required to release reservations.');
      }

      const activeReservations = await tx.inventoryReservation.findMany({
        where,
      });

      if (activeReservations.length === 0) {
        return { releasedCount: 0, message: 'No active reservations found to release.' };
      }

      for (const res of activeReservations) {
        // Lock variant
        await tx.$queryRaw`
          SELECT id FROM "ProductVariant" WHERE id = ${res.variantId} FOR UPDATE
        `;

        // Update reservation status
        await tx.inventoryReservation.update({
          where: { id: res.id },
          data: { status: 'RELEASED' },
        });

        // Reconcile variant stock
        await this.reconcileVariantStock(res.variantId, tx);

        // Audit log
        await tx.inventoryLog.create({
          data: {
            variantId: res.variantId,
            previousStock: 0,
            newStock: 0,
            changeQuantity: 0,
            reason: `Reservation released (${res.quantity} units returned to circulation)`,
            referenceType: 'RESERVATION_RELEASED',
            referenceId: res.id,
          },
        });
      }

      logger.info(`[INVENTORY] Released ${activeReservations.length} reservation(s).`);
      return {
        releasedCount: activeReservations.length,
        message: 'Reservations released successfully.',
      };
    });
  }

  /**
   * Sweeper job: Transitions expired reservations to EXPIRED and returns stock to circulation.
   */
  async expireReservations() {
    const now = new Date();

    return prisma.$transaction(async (tx) => {
      const expiredList = await tx.inventoryReservation.findMany({
        where: {
          status: 'ACTIVE',
          expiresAt: { lt: now },
        },
      });

      if (expiredList.length === 0) {
        return { expiredCount: 0 };
      }

      const affectedVariantIds = new Set();

      for (const res of expiredList) {
        // Lock variant
        await tx.$queryRaw`
          SELECT id FROM "ProductVariant" WHERE id = ${res.variantId} FOR UPDATE
        `;

        await tx.inventoryReservation.update({
          where: { id: res.id },
          data: { status: 'EXPIRED' },
        });

        affectedVariantIds.add(res.variantId);

        await tx.inventoryLog.create({
          data: {
            variantId: res.variantId,
            previousStock: 0,
            newStock: 0,
            changeQuantity: 0,
            reason: `15-minute reservation expired (${res.quantity} units restored)`,
            referenceType: 'RESERVATION_EXPIRY',
            referenceId: res.id,
          },
        });
      }

      // Reconcile each affected variant
      for (const variantId of affectedVariantIds) {
        await this.reconcileVariantStock(variantId, tx);
      }

      logger.info(`[INVENTORY SWEEPER] Successfully expired ${expiredList.length} reservation(s).`);
      return { expiredCount: expiredList.length };
    });
  }

  /**
   * Commits inventory permanently upon successful payment or confirmed order placement (COD / Razorpay).
   */
  async commitReservation({ checkoutSessionId = null, orderId, reservationIds = [], paymentMethod = 'RAZORPAY' }) {
    if (!orderId) {
      throw ApplicationError.badRequest('Order ID is required to commit inventory.');
    }

    return prisma.$transaction(async (tx) => {
      const where = { status: 'ACTIVE' };
      if (reservationIds && reservationIds.length > 0) {
        where.id = { in: reservationIds };
      } else if (checkoutSessionId) {
        where.checkoutSessionId = checkoutSessionId;
      } else if (orderId) {
        where.orderId = orderId;
      }

      const reservations = await tx.inventoryReservation.findMany({ where });

      if (reservations.length === 0) {
        // If no reservations found, attempt to deduct directly from order items
        return this.commitDirectOrderStock(orderId, tx);
      }

      for (const res of reservations) {
        const lockedRows = await tx.$queryRaw`
          SELECT id, sku, "stockQuantity", "reservedQuantity", "availableQuantity"
          FROM "ProductVariant"
          WHERE id = ${res.variantId}
          FOR UPDATE
        `;

        const variant = lockedRows[0];
        const previousStock = variant.stockQuantity;
        const newStock = Math.max(0, previousStock - res.quantity);

        // Update reservation
        await tx.inventoryReservation.update({
          where: { id: res.id },
          data: {
            status: 'COMMITTED',
            orderId,
          },
        });

        // Deduct physical stock
        await tx.productVariant.update({
          where: { id: res.variantId },
          data: {
            stockQuantity: newStock,
          },
        });

        // Reconcile to update available & reserved quantities accurately
        await this.reconcileVariantStock(res.variantId, tx);

        // Record official Stock Movement
        await tx.stockMovement.create({
          data: {
            variantId: res.variantId,
            type: 'ORDER_FULFILLMENT',
            quantity: -res.quantity,
            balanceAfter: newStock,
            notes: `Order fulfillment commit for Order ${orderId} (${paymentMethod})`,
          },
        });

        // Record Inventory Log
        await tx.inventoryLog.create({
          data: {
            variantId: res.variantId,
            previousStock,
            newStock,
            changeQuantity: -res.quantity,
            reason: `Order fulfillment commitment for order ${orderId} (${paymentMethod})`,
            referenceType: 'ORDER',
            referenceId: orderId,
          },
        });
      }

      logger.info(`[INVENTORY] Committed ${reservations.length} reservation(s) to Order ${orderId}.`);
      return { success: true, committedCount: reservations.length };
    });
  }

  /**
   * Direct stock commitment for orders placed without a prior reservation.
   */
  async commitDirectOrderStock(orderId, tx = prisma) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw ApplicationError.notFound(`Order ${orderId} not found.`);
    }

    for (const item of order.items) {
      if (!item.variantId) continue;

      const lockedRows = await tx.$queryRaw`
        SELECT id, sku, "stockQuantity", "reservedQuantity", "availableQuantity"
        FROM "ProductVariant"
        WHERE id = ${item.variantId}
        FOR UPDATE
      `;

      const variant = lockedRows[0];
      const previousStock = variant.stockQuantity;
      const newStock = Math.max(0, previousStock - item.quantity);

      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stockQuantity: newStock },
      });

      await this.reconcileVariantStock(item.variantId, tx);

      await tx.stockMovement.create({
        data: {
          variantId: item.variantId,
          type: 'ORDER_FULFILLMENT',
          quantity: -item.quantity,
          balanceAfter: newStock,
          notes: `Direct stock deduction for order ${orderId}`,
        },
      });

      await tx.inventoryLog.create({
        data: {
          variantId: item.variantId,
          previousStock,
          newStock,
          changeQuantity: -item.quantity,
          reason: `Direct stock commitment for order ${orderId}`,
          referenceType: 'ORDER',
          referenceId: orderId,
        },
      });
    }

    return { success: true, committedCount: order.items.length };
  }

  /**
   * Restores inventory when an order is cancelled prior to fulfillment.
   */
  async restoreOrderStock({ orderId, reason = 'Order cancelled', adminUserId = null }) {
    if (!orderId) {
      throw ApplicationError.badRequest('Order ID is required to restore stock.');
    }

    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!order) {
        throw ApplicationError.notFound(`Order ${orderId} not found.`);
      }

      for (const item of order.items) {
        if (!item.variantId) continue;

        const lockedRows = await tx.$queryRaw`
          SELECT id, sku, "stockQuantity", "reservedQuantity", "availableQuantity"
          FROM "ProductVariant"
          WHERE id = ${item.variantId}
          FOR UPDATE
        `;

        const variant = lockedRows[0];
        const previousStock = variant.stockQuantity;
        const newStock = previousStock + item.quantity;

        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stockQuantity: newStock },
        });

        await this.reconcileVariantStock(item.variantId, tx);

        await tx.stockMovement.create({
          data: {
            variantId: item.variantId,
            type: 'ORDER_CANCELLATION',
            quantity: item.quantity,
            balanceAfter: newStock,
            notes: `Restoration due to order cancellation: Order ${order.orderNumber} - ${reason}`,
          },
        });

        await tx.inventoryLog.create({
          data: {
            variantId: item.variantId,
            previousStock,
            newStock,
            changeQuantity: item.quantity,
            reason: `Order cancelled restoration: ${reason}`,
            referenceType: 'ORDER',
            referenceId: orderId,
            adminUserId,
          },
        });
      }

      logger.info(`[INVENTORY] Restored stock for cancelled Order ${order.orderNumber}.`);
      return { success: true, restoredItemsCount: order.items.length };
    });
  }

  /**
   * Restocks returned garments after physical warehouse inspection and admin approval.
   */
  async restockReturnedItem({ orderId, variantId, quantity = 1, reason = 'Customer return accepted', adminUserId = null }) {
    if (!orderId || !variantId) {
      throw ApplicationError.badRequest('Both orderId and variantId are required for return restock.');
    }

    return prisma.$transaction(async (tx) => {
      const lockedRows = await tx.$queryRaw`
        SELECT id, sku, "stockQuantity", "reservedQuantity", "availableQuantity"
        FROM "ProductVariant"
        WHERE id = ${variantId}
        FOR UPDATE
      `;

      if (!lockedRows || lockedRows.length === 0) {
        throw ApplicationError.notFound(`Variant ${variantId} not found.`);
      }

      const variant = lockedRows[0];
      const previousStock = variant.stockQuantity;
      const newStock = previousStock + quantity;

      await tx.productVariant.update({
        where: { id: variantId },
        data: { stockQuantity: newStock },
      });

      await this.reconcileVariantStock(variantId, tx);

      await tx.stockMovement.create({
        data: {
          variantId,
          type: 'RETURN_RESTOCK',
          quantity,
          balanceAfter: newStock,
          notes: `Return restock for Order ${orderId}: ${reason}`,
        },
      });

      await tx.inventoryLog.create({
        data: {
          variantId,
          previousStock,
          newStock,
          changeQuantity: quantity,
          reason: `Garment return approved and restocked: ${reason}`,
          referenceType: 'RETURN',
          referenceId: orderId,
          adminUserId,
        },
      });

      logger.info(`[INVENTORY] Restocked ${quantity} unit(s) of variant ${variant.sku} from return on Order ${orderId}.`);
      return {
        success: true,
        variantId,
        sku: variant.sku,
        restockedQuantity: quantity,
        currentStock: newStock,
      };
    });
  }

  /**
   * Admin manual stock adjustment to synchronize warehouse counts.
   */
  async adjustStock({ variantId, newStockQuantity, reason, adminUserId = null, locationId = null }) {
    return prisma.$transaction(async (tx) => {
      const lockedRows = await tx.$queryRaw`
        SELECT id, sku, "stockQuantity", "reservedQuantity", "availableQuantity"
        FROM "ProductVariant"
        WHERE id = ${variantId}
        FOR UPDATE
      `;

      if (!lockedRows || lockedRows.length === 0) {
        throw ApplicationError.notFound('Product variant not found.', 'VARIANT_NOT_FOUND');
      }

      const variant = lockedRows[0];

      // Physical stock cannot be adjusted below current active reservations
      if (newStockQuantity < variant.reservedQuantity) {
        throw ApplicationError.badRequest(
          `Cannot set physical stock to ${newStockQuantity}. There are currently ${variant.reservedQuantity} active reserved unit(s).`,
          'CANNOT_ADJUST_BELOW_RESERVED'
        );
      }

      const previousStock = variant.stockQuantity;
      const diff = newStockQuantity - previousStock;

      await tx.productVariant.update({
        where: { id: variantId },
        data: { stockQuantity: newStockQuantity },
      });

      const updated = await this.reconcileVariantStock(variantId, tx);

      await tx.stockMovement.create({
        data: {
          variantId,
          locationId,
          type: 'MANUAL_ADJUSTMENT',
          quantity: diff,
          balanceAfter: newStockQuantity,
          notes: `Admin manual adjustment: ${reason}`,
        },
      });

      await tx.inventoryLog.create({
        data: {
          variantId,
          locationId,
          previousStock,
          newStock: newStockQuantity,
          changeQuantity: diff,
          reason: `Manual inventory adjustment: ${reason}`,
          referenceType: 'MANUAL_ADJUSTMENT',
          adminUserId,
        },
      });

      return {
        variantId,
        sku: variant.sku,
        previousStock,
        newStock: newStockQuantity,
        difference: diff,
        availableStock: updated.availableQuantity,
        reservedStock: updated.reservedQuantity,
      };
    });
  }

  /**
   * Admin stock addition (e.g. newly arrived atelier garments).
   */
  async replenishStock({ variantId, quantity, reason = 'Warehouse replenishment', costPerUnit = null, adminUserId = null, locationId = null }) {
    return prisma.$transaction(async (tx) => {
      const lockedRows = await tx.$queryRaw`
        SELECT id, sku, "stockQuantity", "reservedQuantity", "availableQuantity"
        FROM "ProductVariant"
        WHERE id = ${variantId}
        FOR UPDATE
      `;

      if (!lockedRows || lockedRows.length === 0) {
        throw ApplicationError.notFound('Product variant not found.', 'VARIANT_NOT_FOUND');
      }

      const variant = lockedRows[0];
      const previousStock = variant.stockQuantity;
      const newStock = previousStock + quantity;

      await tx.productVariant.update({
        where: { id: variantId },
        data: { stockQuantity: newStock },
      });

      const updated = await this.reconcileVariantStock(variantId, tx);

      await tx.stockMovement.create({
        data: {
          variantId,
          locationId,
          type: 'PURCHASE_RECEIPT',
          quantity,
          balanceAfter: newStock,
          costPerUnit: costPerUnit !== null ? Number(costPerUnit) : null,
          notes: `Stock replenishment: ${reason}`,
        },
      });

      await tx.inventoryLog.create({
        data: {
          variantId,
          locationId,
          previousStock,
          newStock,
          changeQuantity: quantity,
          reason: `Stock replenishment: ${reason}`,
          referenceType: 'REPLENISHMENT',
          adminUserId,
        },
      });

      return {
        variantId,
        sku: variant.sku,
        addedQuantity: quantity,
        totalPhysicalStock: newStock,
        availableStock: updated.availableQuantity,
      };
    });
  }

  /**
   * Admin stock write-off (damage, showroom sample loss).
   */
  async reduceStock({ variantId, quantity, reason, adminUserId = null, locationId = null }) {
    return prisma.$transaction(async (tx) => {
      const lockedRows = await tx.$queryRaw`
        SELECT id, sku, "stockQuantity", "reservedQuantity", "availableQuantity"
        FROM "ProductVariant"
        WHERE id = ${variantId}
        FOR UPDATE
      `;

      if (!lockedRows || lockedRows.length === 0) {
        throw ApplicationError.notFound('Product variant not found.', 'VARIANT_NOT_FOUND');
      }

      const variant = lockedRows[0];

      if (quantity > variant.availableQuantity) {
        throw ApplicationError.badRequest(
          `Cannot write off ${quantity} unit(s). Only ${variant.availableQuantity} unit(s) are available (unreserved).`,
          'INSUFFICIENT_AVAILABLE_STOCK'
        );
      }

      const previousStock = variant.stockQuantity;
      const newStock = previousStock - quantity;

      await tx.productVariant.update({
        where: { id: variantId },
        data: { stockQuantity: newStock },
      });

      const updated = await this.reconcileVariantStock(variantId, tx);

      await tx.stockMovement.create({
        data: {
          variantId,
          locationId,
          type: 'DAMAGE_WRITE_OFF',
          quantity: -quantity,
          balanceAfter: newStock,
          notes: `Stock write-off: ${reason}`,
        },
      });

      await tx.inventoryLog.create({
        data: {
          variantId,
          locationId,
          previousStock,
          newStock,
          changeQuantity: -quantity,
          reason: `Stock write-off: ${reason}`,
          referenceType: 'WRITE_OFF',
          adminUserId,
        },
      });

      return {
        variantId,
        sku: variant.sku,
        reducedQuantity: quantity,
        remainingStock: newStock,
        availableStock: updated.availableQuantity,
      };
    });
  }

  /**
   * Lists inventory across all variants with pagination, search, and low-stock filters.
   */
  async listInventory({ page = 1, limit = 20, search, status, lowStockOnly = false, threshold = 5 } = {}) {
    const where = {};

    if (status) {
      where.status = status;
    }

    if (lowStockOnly) {
      where.availableQuantity = { lte: Number(threshold) };
    }

    if (search) {
      const term = search.trim();
      where.OR = [
        { sku: { contains: term, mode: 'insensitive' } },
        { colorName: { contains: term, mode: 'insensitive' } },
        { product: { name: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const skip = (page - 1) * limit;

    const [total, variants] = await Promise.all([
      prisma.productVariant.count({ where }),
      prisma.productVariant.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ availableQuantity: 'asc' }, { updatedAt: 'desc' }],
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              baseSku: true,
              category: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ]);

    const items = variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      size: v.size,
      colorName: v.colorName,
      colorHex: v.colorHex,
      status: v.status,
      stockQuantity: v.stockQuantity,
      reservedQuantity: v.reservedQuantity,
      availableQuantity: v.availableQuantity,
      isLowStock: v.availableQuantity <= threshold && v.availableQuantity > 0,
      isOutOfStock: v.availableQuantity <= 0,
      product: v.product,
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      items,
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
   * Returns quick list of low-stock garment variants.
   */
  async getLowStockVariants({ threshold = 5 } = {}) {
    return this.listInventory({
      lowStockOnly: true,
      threshold,
      limit: 50,
    });
  }

  /**
   * Returns comprehensive stock inspection for a single variant.
   */
  async getVariantStockDetails(variantId) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        product: { select: { id: true, name: true, slug: true, baseSku: true } },
        reservations: {
          where: { status: 'ACTIVE', expiresAt: { gt: new Date() } },
          orderBy: { expiresAt: 'asc' },
        },
        stockMovements: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!variant) {
      throw ApplicationError.notFound('Product variant not found.', 'VARIANT_NOT_FOUND');
    }

    return {
      variantId: variant.id,
      sku: variant.sku,
      product: variant.product,
      size: variant.size,
      colorName: variant.colorName,
      stockQuantity: variant.stockQuantity,
      reservedQuantity: variant.reservedQuantity,
      availableQuantity: variant.availableQuantity,
      status: variant.status,
      activeReservations: variant.reservations,
      recentMovements: variant.stockMovements,
    };
  }

  /**
   * Returns audit history logs for a variant.
   */
  async getInventoryHistory(variantId, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;

    const [total, logs] = await Promise.all([
      prisma.inventoryLog.count({ where: { variantId } }),
      prisma.inventoryLog.findMany({
        where: { variantId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      logs,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Lists reservations with status filter for admin inspection.
   */
  async listReservations({ page = 1, limit = 20, status, variantId, cartId, orderId } = {}) {
    const where = {};
    if (status) where.status = status;
    if (variantId) where.variantId = variantId;
    if (cartId) where.cartId = cartId;
    if (orderId) where.orderId = orderId;

    const skip = (page - 1) * limit;

    const [total, reservations] = await Promise.all([
      prisma.inventoryReservation.count({ where }),
      prisma.inventoryReservation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          variant: {
            select: {
              sku: true,
              size: true,
              colorName: true,
              product: { select: { name: true, slug: true } },
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      reservations,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Computes authoritative executive inventory metrics and valuation reports.
   */
  async getInventoryReports() {
    const variants = await prisma.productVariant.findMany({
      select: {
        id: true,
        stockQuantity: true,
        reservedQuantity: true,
        availableQuantity: true,
        priceOverride: true,
        product: { select: { sellingPrice: true } },
      },
    });

    let totalPhysicalUnits = 0;
    let totalReservedUnits = 0;
    let totalAvailableUnits = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalValuation = 0;

    for (const v of variants) {
      totalPhysicalUnits += v.stockQuantity;
      totalReservedUnits += v.reservedQuantity;
      totalAvailableUnits += v.availableQuantity;

      if (v.availableQuantity <= 0) {
        outOfStockCount++;
      } else if (v.availableQuantity <= 5) {
        lowStockCount++;
      }

      const unitPrice = v.priceOverride ? Number(v.priceOverride) : Number(v.product.sellingPrice);
      totalValuation += v.stockQuantity * unitPrice;
    }

    return {
      totalVariants: variants.length,
      totalPhysicalUnits,
      totalReservedUnits,
      totalAvailableUnits,
      lowStockCount,
      outOfStockCount,
      totalValuation: Math.round(totalValuation * 100) / 100,
      currency: 'INR',
    };
  }
}

export default new InventoryService();

