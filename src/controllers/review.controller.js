import reviewService from '../services/review.service.js';
import apiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

export const submitReview = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { productId, rating, headline, content, media, verifiedOnly } = req.body;

  const review = await reviewService.submitReview({
    userId,
    productId,
    rating: Number(rating),
    headline,
    content,
    media,
    verifiedOnly: Boolean(verifiedOnly),
  });

  return apiResponse.success(res, {
    message: 'Editorial review submitted successfully.',
    data: review,
    statusCode: 201,
  });
});

export const updateReview = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const { id } = req.params;

  const review = await reviewService.updateReview(id, userId, userRole, req.body);

  return apiResponse.success(res, {
    message: 'Review updated successfully.',
    data: review,
  });
});

export const deleteReview = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const { id } = req.params;

  const result = await reviewService.deleteReview(id, userId, userRole);

  return apiResponse.success(res, {
    message: result.message,
    data: result,
  });
});

export const getProductReviews = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const page = req.query.page ? Number(req.query.page) : 1;
  const limit = req.query.limit ? Number(req.query.limit) : 10;
  const sort = req.query.sort || 'recent';

  const data = await reviewService.getProductReviews({ productId, page, limit, sort });

  return apiResponse.success(res, {
    message: 'Product reviews retrieved.',
    data: data.reviews,
    meta: data.pagination,
  });
});

export const getProductReviewStats = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const stats = await reviewService.getProductReviewStats(productId);

  return apiResponse.success(res, {
    message: 'Product review analytics retrieved.',
    data: stats,
  });
});

export const checkEligibility = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { productId } = req.params;

  const eligibility = await reviewService.checkEligibility(userId, productId);

  return apiResponse.success(res, {
    message: 'Review eligibility checked.',
    data: eligibility,
  });
});

export const getMyReviews = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const page = req.query.page ? Number(req.query.page) : 1;
  const limit = req.query.limit ? Number(req.query.limit) : 20;

  const data = await reviewService.getMyReviews(userId, { page, limit });

  return apiResponse.success(res, {
    message: 'Customer reviews retrieved.',
    data: data.reviews,
    meta: data.pagination,
  });
});

export const listReviewsAdmin = asyncHandler(async (req, res) => {
  const page = req.query.page ? Number(req.query.page) : 1;
  const limit = req.query.limit ? Number(req.query.limit) : 20;
  const status = req.query.status || 'all';

  const data = await reviewService.listReviewsAdmin({ page, limit, status });

  return apiResponse.success(res, {
    message: 'Reviews retrieved for admin moderation.',
    data: data.reviews,
    meta: data.pagination,
  });
});

export const moderateReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isApproved } = req.body;

  const review = await reviewService.moderateReview(id, isApproved);

  return apiResponse.success(res, {
    message: `Review has been ${isApproved ? 'approved' : 'hidden'}.`,
    data: review,
  });
});

export const getAdminReviewSummary = asyncHandler(async (req, res) => {
  const summary = await reviewService.getAdminReviewSummary();

  return apiResponse.success(res, {
    message: 'Admin review summary analytics retrieved.',
    data: summary,
  });
});

export default {
  submitReview,
  updateReview,
  deleteReview,
  getProductReviews,
  getProductReviewStats,
  checkEligibility,
  getMyReviews,
  listReviewsAdmin,
  moderateReview,
  getAdminReviewSummary,
};

