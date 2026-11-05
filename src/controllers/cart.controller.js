import crypto from 'node:crypto';
import cartService from '../services/cart.service.js';
import apiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

const getSessionDetails = (req, res) => {
  const userId = req.user?.id || null;
  let guestSessionId =
    req.headers['x-guest-session-id'] ||
    req.cookies?.guestSessionId ||
    req.query?.guestSessionId ||
    req.body?.guestSessionId ||
    null;

  if (!userId && !guestSessionId) {
    guestSessionId = crypto.randomUUID();
    res.setHeader('X-Guest-Session-Id', guestSessionId);
    res.cookie('guestSessionId', guestSessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
  }

  return { userId, guestSessionId };
};

export const getCart = asyncHandler(async (req, res) => {
  const { userId, guestSessionId } = getSessionDetails(req, res);
  const couponCodeOverride = req.query.couponCode;
  const stateCode = req.query.stateCode;

  const cart = await cartService.getCart({
    userId,
    guestSessionId,
    couponCodeOverride,
    stateCode,
  });

  return apiResponse.success(res, {
    message: 'Shopping bag retrieved successfully.',
    data: cart,
  });
});

export const addItem = asyncHandler(async (req, res) => {
  const { userId, guestSessionId } = getSessionDetails(req, res);
  const { variantId, quantity } = req.body;

  const cart = await cartService.addItem({
    userId,
    guestSessionId,
    variantId,
    quantity: quantity ? Number(quantity) : 1,
  });

  return apiResponse.success(res, {
    message: 'Garment added to bag successfully.',
    data: cart,
    statusCode: 201,
  });
});

export const updateQuantity = asyncHandler(async (req, res) => {
  const { userId, guestSessionId } = getSessionDetails(req, res);
  const { itemId } = req.params;
  const { quantity } = req.body;

  const cart = await cartService.updateItemQuantity({
    userId,
    guestSessionId,
    itemId,
    quantity: Number(quantity),
  });

  return apiResponse.success(res, {
    message: 'Bag item quantity updated successfully.',
    data: cart,
  });
});

export const removeItem = asyncHandler(async (req, res) => {
  const { userId, guestSessionId } = getSessionDetails(req, res);
  const { itemId } = req.params;

  const cart = await cartService.removeItem({
    userId,
    guestSessionId,
    itemId,
  });

  return apiResponse.success(res, {
    message: 'Garment removed from bag.',
    data: cart,
  });
});

export const clearCart = asyncHandler(async (req, res) => {
  const { userId, guestSessionId } = getSessionDetails(req, res);

  const cart = await cartService.clearCart({
    userId,
    guestSessionId,
  });

  return apiResponse.success(res, {
    message: 'Shopping bag cleared successfully.',
    data: cart,
  });
});

export const applyCoupon = asyncHandler(async (req, res) => {
  const { userId, guestSessionId } = getSessionDetails(req, res);
  const couponCode = req.body.couponCode || req.body.code;

  const cart = await cartService.applyCoupon({
    userId,
    guestSessionId,
    couponCode,
  });

  return apiResponse.success(res, {
    message: `Promotion code ${couponCode ? couponCode.toUpperCase() : ''} applied successfully.`,
    data: cart,
  });
});

export const removeCoupon = asyncHandler(async (req, res) => {
  const { userId, guestSessionId } = getSessionDetails(req, res);

  const cart = await cartService.removeCoupon({
    userId,
    guestSessionId,
  });

  return apiResponse.success(res, {
    message: 'Promotion code removed.',
    data: cart,
  });
});

export const validateStock = asyncHandler(async (req, res) => {
  const { userId, guestSessionId } = getSessionDetails(req, res);

  const stockValidation = await cartService.validateCartStock({
    userId,
    guestSessionId,
  });

  return apiResponse.success(res, {
    message: stockValidation.isValid ? 'All items in bag are in stock.' : 'Some items in your bag have stock constraints.',
    data: stockValidation,
  });
});

export const mergeCart = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const { guestSessionId } = req.body;

  const cart = await cartService.mergeGuestCart({
    userId,
    guestSessionId,
  });

  return apiResponse.success(res, {
    message: 'Guest bag merged with your customer account.',
    data: cart,
  });
});

export default {
  getCart,
  addItem,
  updateQuantity,
  removeItem,
  clearCart,
  applyCoupon,
  removeCoupon,
  validateStock,
  mergeCart,
};

