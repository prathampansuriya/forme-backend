import healthService from '../services/health.service.js';
import apiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

export const getHealth = asyncHandler(async (req, res) => {
  const healthData = await healthService.checkHealth();
  const statusCode = healthData.status === 'healthy' ? 200 : 503;
  return apiResponse.success(res, {
    statusCode,
    message: healthData.status === 'healthy' ? 'FORME API is fully operational' : 'FORME API degraded',
    data: healthData,
  });
});

export const getLiveness = asyncHandler(async (req, res) => {
  const liveness = await healthService.checkLiveness();
  return apiResponse.success(res, {
    statusCode: 200,
    message: 'Server process is responsive',
    data: liveness,
  });
});

export const getReadiness = asyncHandler(async (req, res) => {
  const readiness = await healthService.checkReadiness();
  const statusCode = readiness.status === 'ready' ? 200 : 503;
  return apiResponse.success(res, {
    statusCode,
    message: readiness.status === 'ready' ? 'Server is ready to accept requests' : 'Server is not ready',
    data: readiness,
  });
});

export default {
  getHealth,
  getLiveness,
  getReadiness,
};

