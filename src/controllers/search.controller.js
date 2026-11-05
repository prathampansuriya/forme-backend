import searchService from '../services/search.service.js';
import apiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

export const autocomplete = asyncHandler(async (req, res) => {
  const result = await searchService.autocomplete(req.query.q);

  return apiResponse.success(res, {
    message: 'Autocomplete results retrieved successfully.',
    data: result,
  });
});

export const searchProducts = asyncHandler(async (req, res) => {
  const result = await searchService.searchProducts(req.query);

  return apiResponse.success(res, {
    message: `Search results for "${result.query}".`,
    data: result.items,
    pagination: result.pagination,
  });
});

export const searchCategories = asyncHandler(async (req, res) => {
  const categories = await searchService.searchCategories(req.query.q);

  return apiResponse.success(res, {
    message: 'Categories matching search term.',
    data: categories,
  });
});

export const searchCollections = asyncHandler(async (req, res) => {
  const collections = await searchService.searchCollections(req.query.q);

  return apiResponse.success(res, {
    message: 'Collections matching search term.',
    data: collections,
  });
});

export const getSuggestions = asyncHandler(async (req, res) => {
  const suggestions = await searchService.getSuggestions(req.query.q);

  return apiResponse.success(res, {
    message: 'Search query suggestions.',
    data: suggestions,
  });
});

export const getPopularSearches = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 8;
  const popular = await searchService.getPopularSearches({ limit });

  return apiResponse.success(res, {
    message: 'Popular searches retrieved from analytics.',
    data: popular,
  });
});

export default {
  autocomplete,
  searchProducts,
  searchCategories,
  searchCollections,
  getSuggestions,
  getPopularSearches,
};

