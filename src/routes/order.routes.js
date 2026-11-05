import { Router } from 'express';
import orderController from '../controllers/order.controller.js';
import { authenticate, optionalAuth } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/role.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  checkoutSchema,
  verifyPaymentSchema,
  paymentFailureSchema,
  queryOrdersSchema,
  cancelOrderSchema,
  returnOrderSchema,
  updateOrderStatusSchema,
  shipOrderSchema,
  adminNotesSchema,
  processRefundSchema,
  adminReturnActionSchema,
} from '../validators/order.validator.js';

const router = Router();

// ==========================================
// 1. Webhook Route (Open endpoint, HMAC rawBody verified)
// ==========================================
router.post('/webhook', orderController.handleRazorpayWebhook);

// Public / Authenticated Order Tracking by Order Number
router.get('/track/:orderNumber', optionalAuth, orderController.trackOrderByNumber);

// ==========================================
// 2. Customer Order Routes (Authenticated)
// ==========================================
router.post('/checkout', authenticate, validate(checkoutSchema), orderController.checkout);
router.post('/verify-payment', authenticate, validate(verifyPaymentSchema), orderController.verifyPayment);
router.post('/payment-failure', authenticate, validate(paymentFailureSchema), orderController.handlePaymentFailure);

router.get('/', authenticate, validate(queryOrdersSchema), orderController.getCustomerOrders);
router.get('/:id', authenticate, orderController.getOrderDetails);
router.post('/:id/cancel', authenticate, validate(cancelOrderSchema), orderController.cancelOrder);
router.post('/:id/return', authenticate, validate(returnOrderSchema), orderController.requestReturn);
router.get('/:id/track', authenticate, orderController.trackOrder);
router.get('/:id/invoice', authenticate, orderController.getInvoice);

// ==========================================
// 3. Admin Order Management Routes
// ==========================================
export const adminOrderRouter = Router();
adminOrderRouter.use(authenticate, requireAdmin);

adminOrderRouter.get('/', validate(queryOrdersSchema), orderController.listAdminOrders);
adminOrderRouter.get('/:id', orderController.getOrderDetails);
adminOrderRouter.get('/:id/invoice', orderController.getInvoice);
adminOrderRouter.patch('/:id/status', validate(updateOrderStatusSchema), orderController.updateOrderStatus);
adminOrderRouter.post('/:id/ship', validate(shipOrderSchema), orderController.shipOrder);
adminOrderRouter.patch('/:id/return-action', validate(adminReturnActionSchema), orderController.adminReturnAction);
adminOrderRouter.post('/:id/refund', validate(processRefundSchema), orderController.processRefund);
adminOrderRouter.post('/:id/notes', validate(adminNotesSchema), orderController.addAdminNote);

export default router;

