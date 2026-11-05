import multer from 'multer';
import ApplicationError from '../utils/ApplicationError.js';

// Memory storage keeps file buffer in memory for direct stream upload
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/avif',
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime',
  ];

  if (allowedMimeTypes.includes(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    cb(
      ApplicationError.badRequest(
        `Unsupported media format: ${file.mimetype}. Allowed formats: JPG, PNG, WEBP, AVIF, GIF, MP4, WEBM, MOV.`
      ),
      false
    );
  }
};

export const uploadMediaMiddleware = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
  fileFilter,
});

export default uploadMediaMiddleware;

