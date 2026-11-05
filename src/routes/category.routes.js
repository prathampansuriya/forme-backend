import { Router } from 'express';
import categoryController from '../controllers/category.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/role.middleware.js';
import validate from '../middleware/validate.middleware.js';
import { createCategorySchema, updateCategorySchema } from '../validators/category.validator.js';

const router = Router();

// Customer Endpoints
router.get('/', categoryController.listCategories);
router.get('/slug/:slug', categoryController.getCategoryBySlug);
router.get('/slug/:slug/filters', categoryController.getCategoryFilters);
router.get('/:idOrSlug', categoryController.getCategoryBySlug);
router.get('/:idOrSlug/filters', categoryController.getCategoryFilters);

// Admin Endpoints
router.post(
  '/',
  authenticate,
  requireAdmin,
  validate(createCategorySchema),
  categoryController.createCategory
);

router.put(
  '/:id',
  authenticate,
  requireAdmin,
  validate(updateCategorySchema),
  categoryController.updateCategory
);

router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  categoryController.deleteCategory
);

export default router;

