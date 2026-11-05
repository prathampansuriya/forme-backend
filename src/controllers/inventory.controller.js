import inventoryService from '../services/inventory.service.js';
import apiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

export const createReservation = asyncHandler(async (req, res) => {
  const userId = req.user?.id || null;
  const { items, cartId, checkoutSessionId, ttlMinutes } = req.body;

  const result = await inventoryService.createReservation({
    items,
    userId,
    cartId,
    checkoutSessionId,
    ttlMinutes,
  });

  return apiResponse.success(res, {
    message: 'Temporary inventory reservation created.',
    data: result,
    statusCode: 201,
  });
});

export const releaseReservation = asyncHandler(async (req, res) => {
  const { reservationIds, checkoutSessionId, cartId } = req.body;

  const result = await inventoryService.releaseReservation({
    reservationIds,
    checkoutSessionId,
    cartId,
  });

  return apiResponse.success(res, {
    message: result.message,
    data: result,
  });
});

export const listInventory = asyncHandler(async (req, res) => {
  const page = req.query.page ? Number(req.query.page) : 1;
  const limit = req.query.limit ? Number(req.query.limit) : 20;
  const search = req.query.search;
  const status = req.query.status;
  const lowStockOnly = req.query.lowStockOnly === true || req.query.lowStockOnly === 'true';
  const threshold = req.query.threshold ? Number(req.query.threshold) : 5;

  const result = await inventoryService.listInventory({
    page,
    limit,
    search,
    status,
    lowStockOnly,
    threshold,
  });

  return apiResponse.success(res, {
    message: 'Inventory records retrieved.',
    data: result.items,
    meta: result.pagination,
  });
});

export const getLowStockVariants = asyncHandler(async (req, res) => {
  const threshold = req.query.threshold ? Number(req.query.threshold) : 5;
  const result = await inventoryService.getLowStockVariants({ threshold });

  return apiResponse.success(res, {
    message: 'Low stock variants retrieved.',
    data: result.items,
    meta: result.pagination,
  });
});

export const getVariantStockDetails = asyncHandler(async (req, res) => {
  const { variantId } = req.params;
  const details = await inventoryService.getVariantStockDetails(variantId);

  return apiResponse.success(res, {
    message: 'Variant stock details retrieved.',
    data: details,
  });
});

export const adjustStock = asyncHandler(async (req, res) => {
  const adminUserId = req.user?.id || null;
  const { variantId, newStockQuantity, reason, locationId } = req.body;

  const result = await inventoryService.adjustStock({
    variantId,
    newStockQuantity: Number(newStockQuantity),
    reason,
    adminUserId,
    locationId,
  });

  return apiResponse.success(res, {
    message: 'Inventory physical stock adjusted successfully.',
    data: result,
  });
});

export const replenishStock = asyncHandler(async (req, res) => {
  const adminUserId = req.user?.id || null;
  const { variantId, quantity, reason, costPerUnit, locationId } = req.body;

  const result = await inventoryService.replenishStock({
    variantId,
    quantity: Number(quantity),
    reason,
    costPerUnit,
    adminUserId,
    locationId,
  });

  return apiResponse.success(res, {
    message: 'Inventory replenishment recorded.',
    data: result,
    statusCode: 201,
  });
});

export const reduceStock = asyncHandler(async (req, res) => {
  const adminUserId = req.user?.id || null;
  const { variantId, quantity, reason, locationId } = req.body;

  const result = await inventoryService.reduceStock({
    variantId,
    quantity: Number(quantity),
    reason,
    adminUserId,
    locationId,
  });

  return apiResponse.success(res, {
    message: 'Stock write-off processed.',
    data: result,
  });
});

export const getInventoryHistory = asyncHandler(async (req, res) => {
  const { variantId } = req.params;
  const page = req.query.page ? Number(req.query.page) : 1;
  const limit = req.query.limit ? Number(req.query.limit) : 20;

  const history = await inventoryService.getInventoryHistory(variantId, { page, limit });

  return apiResponse.success(res, {
    message: 'Inventory audit history retrieved.',
    data: history.logs,
    meta: history.pagination,
  });
});

export const listReservations = asyncHandler(async (req, res) => {
  const page = req.query.page ? Number(req.query.page) : 1;
  const limit = req.query.limit ? Number(req.query.limit) : 20;
  const status = req.query.status;
  const variantId = req.query.variantId;
  const cartId = req.query.cartId;
  const orderId = req.query.orderId;

  const result = await inventoryService.listReservations({
    page,
    limit,
    status,
    variantId,
    cartId,
    orderId,
  });

  return apiResponse.success(res, {
    message: 'Reservations retrieved.',
    data: result.reservations,
    meta: result.pagination,
  });
});

export const triggerReservationExpiry = asyncHandler(async (req, res) => {
  const result = await inventoryService.expireReservations();

  return apiResponse.success(res, {
    message: `Expired reservation sweeper executed. Restored ${result.expiredCount} reservation(s).`,
    data: result,
  });
});

export const getInventoryReports = asyncHandler(async (req, res) => {
  const reports = await inventoryService.getInventoryReports();

  return apiResponse.success(res, {
    message: 'Executive inventory metrics retrieved.',
    data: reports,
  });
});

export const restockReturn = asyncHandler(async (req, res) => {
  const adminUserId = req.user?.id || null;
  const { orderId, variantId, quantity, reason } = req.body;

  const result = await inventoryService.restockReturnedItem({
    orderId,
    variantId,
    quantity: quantity ? Number(quantity) : 1,
    reason,
    adminUserId,
  });

  return apiResponse.success(res, {
    message: 'Garment return restocked into warehouse inventory.',
    data: result,
  });
});

export default {
  createReservation,
  releaseReservation,
  listInventory,
  getLowStockVariants,
  getVariantStockDetails,
  adjustStock,
  replenishStock,
  reduceStock,
  getInventoryHistory,
  listReservations,
  triggerReservationExpiry,
  getInventoryReports,
  restockReturn,
};

