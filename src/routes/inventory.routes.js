import { Router } from 'express';
import inventoryController from '../controllers/inventory.controller.js';
import { authenticate, optionalAuth } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/role.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  reserveStockSchema,
  releaseStockSchema,
  adjustStockSchema,
  replenishStockSchema,
  reduceStockSchema,
  queryInventorySchema,
  queryReservationsSchema,
  restockReturnSchema,
} from '../validators/inventory.validator.js';

const router = Router();

// ==========================================
// 1. Checkout Reservation Lifecycle
// ==========================================
router.post('/reserve', optionalAuth, validate(reserveStockSchema), inventoryController.createReservation);
router.post('/release', validate(releaseStockSchema), inventoryController.releaseReservation);

// ==========================================
// 2. Admin Inventory Operations
// ==========================================
router.use(authenticate, requireAdmin);

router.get('/', validate(queryInventorySchema), inventoryController.listInventory);
router.get('/low-stock', inventoryController.getLowStockVariants);
router.get('/reports', inventoryController.getInventoryReports);
router.get('/reservations', validate(queryReservationsSchema), inventoryController.listReservations);
router.post('/reservations/clean-expired', inventoryController.triggerReservationExpiry);
router.get('/variant/:variantId', inventoryController.getVariantStockDetails);
router.get('/history/:variantId', inventoryController.getInventoryHistory);
router.post('/adjust', validate(adjustStockSchema), inventoryController.adjustStock);
router.post('/replenish', validate(replenishStockSchema), inventoryController.replenishStock);
router.post('/reduce', validate(reduceStockSchema), inventoryController.reduceStock);
router.post('/return-restock', validate(restockReturnSchema), inventoryController.restockReturn);

export default router;

