import mediaService from '../services/media.service.js';
import apiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApplicationError from '../utils/ApplicationError.js';

export const uploadMediaAsset = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw ApplicationError.badRequest('No media file attached in multipart form.');
  }

  const result = await mediaService.uploadMedia(req.file, {
    folder: req.body.folder || 'forme/catalog',
  });

  return apiResponse.created(res, {
    message: 'Media asset processed and uploaded successfully.',
    data: result,
  });
});

export default {
  uploadMediaAsset,
};

