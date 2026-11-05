import { Router } from 'express';
import collectionController from '../controllers/collection.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/role.middleware.js';
import validate from '../middleware/validate.middleware.js';
import {
  createCollectionSchema,
  updateCollectionSchema,
  addCollectionProductsSchema,
} from '../validators/collection.validator.js';

const router = Router();

// Customer Endpoints
router.get('/', collectionController.listCollections);
router.get('/featured', collectionController.getFeaturedCollection);
router.get('/slug/:slug', collectionController.getCollectionBySlug);
router.get('/:idOrSlug', collectionController.getCollectionBySlug);

// Admin Endpoints
router.post(
  '/',
  authenticate,
  requireAdmin,
  validate(createCollectionSchema),
  collectionController.createCollection
);

router.put(
  '/:id',
  authenticate,
  requireAdmin,
  validate(updateCollectionSchema),
  collectionController.updateCollection
);

router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  collectionController.deleteCollection
);

router.post(
  '/:id/products',
  authenticate,
  requireAdmin,
  validate(addCollectionProductsSchema),
  collectionController.addProductsToCollection
);

router.delete(
  '/:id/products/:productId',
  authenticate,
  requireAdmin,
  collectionController.removeProductFromCollection
);

export default router;

