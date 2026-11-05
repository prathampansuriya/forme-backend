import { Router } from 'express';
import couponController from '../controllers/coupon.controller.js';
import { authenticate, optionalAuth } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/role.middleware.js';
import validate from '../middleware/validate.middleware.js';
import {
  validateCouponSchema,
  applicableCouponsSchema,
  createCouponSchema,
  updateCouponSchema,
} from '../validators/coupon.validator.js';

const router = Router();

// Customer Endpoints
router.post('/validate', optionalAuth, validate(validateCouponSchema), couponController.validateCoupon);
router.post('/applicable', optionalAuth, validate(applicableCouponsSchema), couponController.getApplicableCoupons);
router.get('/active', couponController.listActiveCoupons);

// Admin CRUD Endpoints
router.get('/', authenticate, requireAdmin, couponController.listCoupons);
router.get('/:id', authenticate, requireAdmin, couponController.getCouponById);
router.post('/', authenticate, requireAdmin, validate(createCouponSchema), couponController.createCoupon);
router.put('/:id', authenticate, requireAdmin, validate(updateCouponSchema), couponController.updateCoupon);
router.delete('/:id', authenticate, requireAdmin, couponController.deleteCoupon);

export default router;

