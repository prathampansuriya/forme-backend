import collectionService from '../services/collection.service.js';
import apiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

export const listCollections = asyncHandler(async (req, res) => {
  const includeUnpublished = req.user?.role === 'ADMIN' && req.query.includeUnpublished === 'true';

  const collections = await collectionService.listCollections({ includeUnpublished });

  return apiResponse.success(res, {
    message: 'Collections retrieved successfully.',
    data: collections,
  });
});

export const getCollectionBySlug = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 12;
  const identifier = req.params.slug || req.params.idOrSlug || req.params.id;

  const collection = await collectionService.getCollectionBySlug(identifier, { page, limit });

  return apiResponse.success(res, {
    message: `Collection "${collection.name}" retrieved successfully.`,
    data: collection,
  });
});

export const getFeaturedCollection = asyncHandler(async (req, res) => {
  const collection = await collectionService.getFeaturedCollection();

  return apiResponse.success(res, {
    message: 'Featured collection retrieved successfully.',
    data: collection,
  });
});

export const createCollection = asyncHandler(async (req, res) => {
  const collection = await collectionService.createCollection(req.body);

  return apiResponse.created(res, {
    message: `Collection "${collection.name}" created successfully.`,
    data: collection,
  });
});

export const updateCollection = asyncHandler(async (req, res) => {
  const collection = await collectionService.updateCollection(req.params.id, req.body);

  return apiResponse.success(res, {
    message: `Collection "${collection.name}" updated successfully.`,
    data: collection,
  });
});

export const deleteCollection = asyncHandler(async (req, res) => {
  const result = await collectionService.deleteCollection(req.params.id);

  return apiResponse.success(res, {
    message: result.message,
    data: null,
  });
});

export const addProductsToCollection = asyncHandler(async (req, res) => {
  const result = await collectionService.addProductsToCollection(req.params.id, req.body.productIds);

  return apiResponse.success(res, {
    message: result.message,
    data: null,
  });
});

export const removeProductFromCollection = asyncHandler(async (req, res) => {
  const result = await collectionService.removeProductFromCollection(req.params.id, req.params.productId);

  return apiResponse.success(res, {
    message: result.message,
    data: null,
  });
});

export default {
  listCollections,
  getCollectionBySlug,
  getFeaturedCollection,
  createCollection,
  updateCollection,
  deleteCollection,
  addProductsToCollection,
  removeProductFromCollection,
};

