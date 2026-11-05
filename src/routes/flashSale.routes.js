import { Router } from 'express';
import flashSaleController from '../controllers/flashSale.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/role.middleware.js';
import validate from '../middleware/validate.middleware.js';
import {
  createFlashSaleSchema,
  updateFlashSaleSchema,
  addFlashSaleProductsSchema,
} from '../validators/flashSale.validator.js';

const router = Router();

// Customer Endpoints
router.get('/active', flashSaleController.getActiveFlashSales);
router.get('/slug/:slug', flashSaleController.getFlashSaleBySlug);
router.get('/:idOrSlug', flashSaleController.getFlashSaleByIdOrSlug);

// Admin CRUD Endpoints
router.get('/', authenticate, requireAdmin, flashSaleController.listFlashSales);
router.post('/', authenticate, requireAdmin, validate(createFlashSaleSchema), flashSaleController.createFlashSale);
router.put('/:id', authenticate, requireAdmin, validate(updateFlashSaleSchema), flashSaleController.updateFlashSale);
router.delete('/:id', authenticate, requireAdmin, flashSaleController.deleteFlashSale);
router.post('/:id/products', authenticate, requireAdmin, validate(addFlashSaleProductsSchema), flashSaleController.addProducts);
router.delete('/:id/products/:productId', authenticate, requireAdmin, flashSaleController.removeProduct);

export default router;

