import { Router } from 'express';
import productController from '../controllers/product.controller.js';
import mediaController from '../controllers/media.controller.js';
import { authenticate, optionalAuth } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/role.middleware.js';
import validate from '../middleware/validate.middleware.js';
import { uploadMediaMiddleware } from '../middleware/upload.middleware.js';
import {
  listProductsQuerySchema,
  createProductSchema,
  updateProductSchema,
  createVariantSchema,
  updateVariantSchema,
  createMediaSchema,
  updateMediaSchema,
} from '../validators/product.validator.js';

const router = Router();

// Customer Endpoints
router.get('/', validate(listProductsQuerySchema), productController.listProducts);
router.get('/featured', productController.getFeaturedProducts);
router.get('/new-arrivals', productController.getNewArrivals);
router.get('/best-sellers', productController.getBestSellers);
router.get('/trending', productController.getTrendingProducts);
router.get('/recently-viewed', optionalAuth, productController.getRecentlyViewed);
router.post('/recently-viewed', optionalAuth, productController.recordProductView);
router.get('/slug/:slug', optionalAuth, productController.getProductBySlug);
router.get('/:id/related', productController.getRelatedProducts);
router.get('/:id/recommendations', productController.getRecommendations);
router.get('/:id', optionalAuth, productController.getProductById);

// Admin Product CRUD Endpoints
router.post(
  '/upload-media',
  authenticate,
  requireAdmin,
  uploadMediaMiddleware.single('file'),
  mediaController.uploadMediaAsset
);

router.post(
  '/',
  authenticate,
  requireAdmin,
  validate(createProductSchema),
  productController.createProduct
);

router.put(
  '/:id',
  authenticate,
  requireAdmin,
  validate(updateProductSchema),
  productController.updateProduct
);

router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  productController.deleteProduct
);

// Admin Variant CRUD Endpoints
router.post(
  '/:id/variants',
  authenticate,
  requireAdmin,
  validate(createVariantSchema),
  productController.createVariant
);

router.put(
  '/:id/variants/:variantId',
  authenticate,
  requireAdmin,
  validate(updateVariantSchema),
  productController.updateVariant
);

router.delete(
  '/:id/variants/:variantId',
  authenticate,
  requireAdmin,
  productController.deleteVariant
);

// Admin Media CRUD Endpoints
router.post(
  '/:id/media',
  authenticate,
  requireAdmin,
  validate(createMediaSchema),
  productController.attachMedia
);

router.put(
  '/:id/media/:mediaId',
  authenticate,
  requireAdmin,
  validate(updateMediaSchema),
  productController.updateMedia
);

router.delete(
  '/:id/media/:mediaId',
  authenticate,
  requireAdmin,
  productController.deleteMedia
);

export default router;

