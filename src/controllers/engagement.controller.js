import engagementService from '../services/engagement.service.js';
import apiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

export const trackView = asyncHandler(async (req, res) => {
  const userId = req.user?.id || null;
  const { productId, sessionId } = req.body;

  const result = await engagementService.recordProductView({
    productId,
    userId,
    sessionId: sessionId || req.headers['x-guest-session-id'] || null,
  });

  return apiResponse.success(res, {
    message: 'Product view tracked.',
    data: result,
  });
});

export const trackSearch = asyncHandler(async (req, res) => {
  const { query, resultsCount } = req.body;

  const log = await engagementService.recordSearchQuery({
    query,
    resultsCount: resultsCount ? Number(resultsCount) : 0,
  });

  return apiResponse.success(res, {
    message: 'Search query tracked.',
    data: log,
  });
});

export const getRecentlyViewed = asyncHandler(async (req, res) => {
  const userId = req.user?.id || null;
  const sessionId = req.headers['x-guest-session-id'] || req.query.sessionId || null;
  const limit = req.query.limit ? Number(req.query.limit) : 8;

  const products = await engagementService.getRecentlyViewed({
    userId,
    sessionId,
    limit,
  });

  return apiResponse.success(res, {
    message: 'Recently viewed garments retrieved.',
    data: products,
  });
});

export const getTrendingMetrics = asyncHandler(async (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 8;
  const trending = await engagementService.getTrendingMetrics({ limit });

  return apiResponse.success(res, {
    message: 'Trending metrics calculated from actual engagement signals.',
    data: trending,
  });
});

export default {
  trackView,
  trackSearch,
  getRecentlyViewed,
  getTrendingMetrics,
};

