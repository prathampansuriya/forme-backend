import categoryService from '../services/category.service.js';
import apiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

export const listCategories = asyncHandler(async (req, res) => {
  const flat = req.query.flat === 'true';
  const includeInactive = req.user?.role === 'ADMIN' && req.query.includeInactive === 'true';

  const categories = await categoryService.listCategories({ includeInactive, flat });

  return apiResponse.success(res, {
    message: 'Categories retrieved successfully.',
    data: categories,
  });
});

export const getCategoryBySlug = asyncHandler(async (req, res) => {
  const identifier = req.params.slug || req.params.idOrSlug || req.params.id;
  const category = await categoryService.getCategoryBySlug(identifier);

  return apiResponse.success(res, {
    message: `Category "${category.name}" retrieved successfully.`,
    data: category,
  });
});

export const getCategoryFilters = asyncHandler(async (req, res) => {
  const identifier = req.params.slug || req.params.idOrSlug || req.params.id;
  const filters = await categoryService.getCategoryFilters(identifier);

  return apiResponse.success(res, {
    message: 'Category facet filters calculated successfully.',
    data: filters,
  });
});

export const createCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.createCategory(req.body);

  return apiResponse.created(res, {
    message: `Category "${category.name}" created successfully.`,
    data: category,
  });
});

export const updateCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.updateCategory(req.params.id, req.body);

  return apiResponse.success(res, {
    message: `Category "${category.name}" updated successfully.`,
    data: category,
  });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const result = await categoryService.deleteCategory(req.params.id);

  return apiResponse.success(res, {
    message: result.message,
    data: null,
  });
});

export default {
  listCategories,
  getCategoryBySlug,
  getCategoryFilters,
  createCategory,
  updateCategory,
  deleteCategory,
};

