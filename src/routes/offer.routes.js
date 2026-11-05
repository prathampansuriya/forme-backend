import { Router } from 'express';
import offerController from '../controllers/offer.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/role.middleware.js';
import validate from '../middleware/validate.middleware.js';
import { createOfferSchema, updateOfferSchema } from '../validators/offer.validator.js';

const router = Router();

// Customer Endpoints
router.get('/active', offerController.getActiveOffers);
router.get('/slug/:slug', offerController.getOfferBySlug);

// Admin CRUD Endpoints
router.get('/', authenticate, requireAdmin, offerController.listOffers);
router.get('/:id', authenticate, requireAdmin, offerController.getOfferById);
router.post('/', authenticate, requireAdmin, validate(createOfferSchema), offerController.createOffer);
router.put('/:id', authenticate, requireAdmin, validate(updateOfferSchema), offerController.updateOffer);
router.delete('/:id', authenticate, requireAdmin, offerController.deleteOffer);

export default router;

