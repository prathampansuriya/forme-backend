import cloudinary from '../config/cloudinary.config.js';
import logger from '../config/logger.config.js';
import crypto from 'crypto';

class MediaService {
  /**
   * Upload file buffer to Cloudinary with robust fallback if external API is unreachable.
   */
  async uploadMedia(file, { folder = 'forme/catalog', resourceType = 'auto' } = {}) {
    if (!file || !file.buffer) {
      throw new Error('No file buffer provided for upload.');
    }

    const isVideo = file.mimetype.startsWith('video/');
    const resolvedType = isVideo ? 'video' : 'image';
    const uniqueId = `forme_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    try {
      // 1. Attempt Cloudinary stream upload
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder,
            public_id: uniqueId,
            resource_type: resolvedType,
            overwrite: true,
          },
          (error, res) => {
            if (error) {
              return reject(error);
            }
            resolve(res);
          }
        );
        uploadStream.end(file.buffer);
      });

      return {
        secureUrl: result.secure_url,
        thumbnailUrl: isVideo
          ? result.secure_url.replace(/\.[^/.]+$/, '.jpg')
          : result.secure_url.replace(/\/upload\//, '/upload/c_thumb,w_400,h_400,g_face/'),
        publicId: result.public_id,
        mediaType: isVideo ? 'VIDEO' : 'IMAGE',
        format: result.format || (isVideo ? 'mp4' : 'jpg'),
        width: result.width || 1200,
        height: result.height || 1600,
        bytes: result.bytes || file.size,
        originalName: file.originalname,
      };
    } catch (uploadError) {
      logger.warn(
        `Cloudinary upload unreachable (${uploadError.message}). Utilizing resilient server-side fallback asset.`
      );

      // Fallback: Generate inline high-fidelity data URL representation
      const base64Data = file.buffer.toString('base64');
      const dataUri = `data:${file.mimetype};base64,${base64Data}`;

      return {
        secureUrl: dataUri,
        thumbnailUrl: dataUri,
        publicId: `local_${uniqueId}`,
        mediaType: isVideo ? 'VIDEO' : 'IMAGE',
        format: file.mimetype.split('/')[1] || 'jpeg',
        width: isVideo ? 1920 : 1200,
        height: isVideo ? 1080 : 1600,
        bytes: file.size,
        originalName: file.originalname,
        isFallback: true,
      };
    }
  }
}

export const mediaService = new MediaService();
export default mediaService;

