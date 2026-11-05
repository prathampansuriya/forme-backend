import wishlistService from '../services/wishlist.service.js';
import apiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

export const getWishlist = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const wishlist = await wishlistService.getWishlist(userId);

  return apiResponse.success(res, {
    message: 'Wishlist retrieved successfully.',
    data: wishlist,
  });
});

export const addItem = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { productId } = req.body;

  const result = await wishlistService.addItem({ userId, productId });

  return apiResponse.success(res, {
    message: 'Garment saved to wishlist.',
    data: result,
    statusCode: 201,
  });
});

export const removeItem = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { productId } = req.params;

  const result = await wishlistService.removeItem({ userId, productId });

  return apiResponse.success(res, {
    message: 'Garment removed from wishlist.',
    data: result,
  });
});

export const checkStatus = asyncHandler(async (req, res) => {
  const userId = req.user?.id || null;
  const { productId } = req.params;

  const status = await wishlistService.isProductWishlisted({ userId, productId });

  return apiResponse.success(res, {
    message: 'Wishlist status checked.',
    data: status,
  });
});

export const moveToCart = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { productId, variantId, quantity } = req.body;

  const result = await wishlistService.moveItemToCart({
    userId,
    productId,
    variantId,
    quantity: quantity ? Number(quantity) : 1,
  });

  return apiResponse.success(res, {
    message: result.message,
    data: result.cart,
  });
});

export default {
  getWishlist,
  addItem,
  removeItem,
  checkStatus,
  moveToCart,
};

