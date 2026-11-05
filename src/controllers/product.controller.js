import productService from '../services/product.service.js';
import apiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

export const listProducts = asyncHandler(async (req, res) => {
  const result = await productService.listProducts(req.query);

  return apiResponse.success(res, {
    message: 'Products catalog retrieved successfully.',
    data: {
      items: result.items,
      pagination: result.pagination,
    },
    pagination: result.pagination,
  });
});

export const getProductBySlug = asyncHandler(async (req, res) => {
  const userId = req.user?.id || null;
  const sessionId = req.headers['x-guest-session-id'] || req.query.sessionId || null;

  const product = await productService.getProductBySlug(req.params.slug, { userId, sessionId });

  return apiResponse.success(res, {
    message: `Product "${product.name}" retrieved successfully.`,
    data: product,
  });
});

export const getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const product = await productService.getProductById(id, { includeAllVariants: true });

  return apiResponse.success(res, {
    message: `Product "${product.name}" retrieved successfully.`,
    data: product,
  });
});

export const getFeaturedProducts = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 8;
  const result = await productService.getFeaturedProducts({ limit });

  return apiResponse.success(res, {
    message: 'Featured pieces retrieved successfully.',
    data: result.items,
  });
});

export const getNewArrivals = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 8;
  const result = await productService.getNewArrivals({ limit });

  return apiResponse.success(res, {
    message: 'New arrivals retrieved successfully.',
    data: result.items,
  });
});

export const getBestSellers = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 8;
  const result = await productService.getBestSellers({ limit });

  return apiResponse.success(res, {
    message: 'Best-selling pieces retrieved successfully.',
    data: result.items,
  });
});

export const getTrendingProducts = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 8;
  const result = await productService.getTrendingProducts({ limit });

  return apiResponse.success(res, {
    message: 'Trending pieces retrieved successfully.',
    data: result.items,
  });
});

export const getRelatedProducts = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 4;
  const related = await productService.getRelatedProducts(req.params.id, { limit });

  return apiResponse.success(res, {
    message: 'Related pieces retrieved successfully.',
    data: related,
  });
});

export const getRecommendations = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 4;
  const recommendations = await productService.getRecommendations(req.params.id, { limit });

  return apiResponse.success(res, {
    message: 'Recommendations calculated successfully.',
    data: recommendations,
  });
});

export const getRecentlyViewed = asyncHandler(async (req, res) => {
  const userId = req.user?.id || null;
  const sessionId = req.headers['x-guest-session-id'] || req.query.sessionId || null;
  const limit = parseInt(req.query.limit, 10) || 8;

  const products = await productService.getRecentlyViewed({ userId, sessionId, limit });

  return apiResponse.success(res, {
    message: 'Recently viewed garments retrieved successfully.',
    data: products,
  });
});

export const recordProductView = asyncHandler(async (req, res) => {
  const userId = req.user?.id || null;
  const sessionId = req.body.sessionId || req.headers['x-guest-session-id'] || null;

  await productService.recordProductView({
    productId: req.body.productId,
    userId,
    sessionId,
  });

  return apiResponse.success(res, {
    message: 'View registered.',
    data: null,
  });
});

// Admin Controllers
export const createProduct = asyncHandler(async (req, res) => {
  const product = await productService.createProduct(req.body);

  return apiResponse.created(res, {
    message: `Piece "${product.name}" created successfully.`,
    data: product,
  });
});

export const updateProduct = asyncHandler(async (req, res) => {
  const product = await productService.updateProduct(req.params.id, req.body);

  return apiResponse.success(res, {
    message: `Piece "${product.name}" updated successfully.`,
    data: product,
  });
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const result = await productService.deleteProduct(req.params.id);

  return apiResponse.success(res, {
    message: result.message,
    data: null,
  });
});

export const createVariant = asyncHandler(async (req, res) => {
  const variant = await productService.createVariant(req.params.id, req.body);

  return apiResponse.created(res, {
    message: `Variant SKU "${variant.sku}" created successfully.`,
    data: variant,
  });
});

export const updateVariant = asyncHandler(async (req, res) => {
  const variant = await productService.updateVariant(req.params.id, req.params.variantId, req.body);

  return apiResponse.success(res, {
    message: `Variant SKU "${variant.sku}" updated successfully.`,
    data: variant,
  });
});

export const deleteVariant = asyncHandler(async (req, res) => {
  const result = await productService.deleteVariant(req.params.id, req.params.variantId);

  return apiResponse.success(res, {
    message: result.message,
    data: null,
  });
});

export const attachMedia = asyncHandler(async (req, res) => {
  const media = await productService.attachMedia(req.params.id, req.body);

  return apiResponse.created(res, {
    message: 'Media asset attached successfully.',
    data: media,
  });
});

export const updateMedia = asyncHandler(async (req, res) => {
  const media = await productService.updateMedia(req.params.id, req.params.mediaId, req.body);

  return apiResponse.success(res, {
    message: 'Media asset updated successfully.',
    data: media,
  });
});

export const deleteMedia = asyncHandler(async (req, res) => {
  const result = await productService.deleteMedia(req.params.id, req.params.mediaId);

  return apiResponse.success(res, {
    message: result.message,
    data: null,
  });
});

export default {
  listProducts,
  getProductBySlug,
  getProductById,
  getFeaturedProducts,
  getNewArrivals,
  getBestSellers,
  getTrendingProducts,
  getRelatedProducts,
  getRecommendations,
  getRecentlyViewed,
  recordProductView,
  createProduct,
  updateProduct,
  deleteProduct,
  createVariant,
  updateVariant,
  deleteVariant,
  attachMedia,
  updateMedia,
  deleteMedia,
};

