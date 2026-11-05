import asyncHandler from '../utils/asyncHandler.js';
import apiResponse from '../utils/apiResponse.js';
import orderService from '../services/order.service.js';

class OrderController {
  /**
   * 1. Customer Checkout
   * POST /api/v1/orders/checkout
   */
  checkout = asyncHandler(async (req, res) => {
    const result = await orderService.checkout({
      userId: req.user.id,
      ...req.body,
    });

    return apiResponse.created(res, {
      message: 'Order created successfully.',
      data: result,
    });
  });

  /**
   * 2. Verify Razorpay Payment Signature
   * POST /api/v1/orders/verify-payment
   */
  verifyPayment = asyncHandler(async (req, res) => {
    const result = await orderService.verifyPayment({
      ...req.body,
      userId: req.user.id,
    });

    return apiResponse.success(res, {
      message: result.message,
      data: result,
    });
  });

  /**
   * 3. Handle Client-Side Payment Failure
   * POST /api/v1/orders/payment-failure
   */
  handlePaymentFailure = asyncHandler(async (req, res) => {
    const result = await orderService.handlePaymentFailure({
      ...req.body,
      userId: req.user.id,
    });

    return apiResponse.success(res, {
      message: result.message,
      data: result,
    });
  });

  /**
   * 4. Razorpay Webhook Listener
   * POST /api/v1/orders/webhook (or /api/v1/payments/webhook)
   */
  handleRazorpayWebhook = asyncHandler(async (req, res) => {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));

    const result = await orderService.handleRazorpayWebhook({
      rawBody,
      signature,
      eventPayload: req.body,
    });

    return res.status(200).json({ status: 'ok', ...result });
  });

  /**
   * 5. Get Authenticated Customer Orders
   * GET /api/v1/orders
   */
  getCustomerOrders = asyncHandler(async (req, res) => {
    const result = await orderService.getCustomerOrders({
      userId: req.user.id,
      ...req.query,
    });

    return apiResponse.paginated(res, {
      data: result.orders,
      page: result.pagination.page,
      limit: result.pagination.limit,
      total: result.pagination.total,
      message: 'Customer order history retrieved.',
    });
  });

  /**
   * 6. Get Order Details by ID
   * GET /api/v1/orders/:id
   */
  getOrderDetails = asyncHandler(async (req, res) => {
    const order = await orderService.getOrderDetails({
      orderId: req.params.id,
      userId: req.user.id,
      role: req.user.role,
    });

    return apiResponse.success(res, {
      data: order,
      message: 'Order details retrieved.',
    });
  });

  /**
   * 7. Customer Order Cancellation
   * POST /api/v1/orders/:id/cancel
   */
  cancelOrder = asyncHandler(async (req, res) => {
    const updated = await orderService.cancelOrderByCustomer({
      orderId: req.params.id,
      reason: req.body.reason,
      userId: req.user.id,
    });

    return apiResponse.success(res, {
      data: updated,
      message: 'Order has been cancelled successfully.',
    });
  });

  /**
   * 8. Customer Return Request
   * POST /api/v1/orders/:id/return
   */
  requestReturn = asyncHandler(async (req, res) => {
    const updated = await orderService.requestReturn({
      orderId: req.params.id,
      reason: req.body.reason,
      itemIds: req.body.itemIds || [],
      userId: req.user.id,
    });

    return apiResponse.success(res, {
      data: updated,
      message: 'Return request submitted successfully. Our atelier concierge will review your request.',
    });
  });

  /**
   * 9. Track Order Shipment
   * GET /api/v1/orders/:id/track
   */
  trackOrder = asyncHandler(async (req, res) => {
    const tracking = await orderService.getOrderTracking({
      orderId: req.params.id,
      userId: req.user.id,
      role: req.user.role,
    });

    return apiResponse.success(res, {
      data: tracking,
      message: 'Order tracking retrieved.',
    });
  });

  /**
   * 9b. Track Order Shipment By Order Number (Public / Authenticated)
   * GET /api/v1/orders/track/:orderNumber
   */
  trackOrderByNumber = asyncHandler(async (req, res) => {
    const { orderNumber } = req.params;
    const tracking = await orderService.getOrderTracking({
      orderId: orderNumber,
      userId: null,
      role: 'ADMIN',
    });

    return apiResponse.success(res, {
      data: tracking,
      message: 'Order tracking retrieved.',
    });
  });

  /**
   * 10. Download / View Invoice (JSON or Luxury HTML)
   * GET /api/v1/orders/:id/invoice
   */
  getInvoice = asyncHandler(async (req, res) => {
    const format = req.query.format || 'json';

    if (format === 'html') {
      const html = await orderService.getInvoiceHtml({
        orderId: req.params.id,
        userId: req.user.id,
        role: req.user.role,
      });
      res.setHeader('Content-Type', 'text/html');
      return res.send(html);
    }

    const data = await orderService.getInvoiceData({
      orderId: req.params.id,
      userId: req.user.id,
      role: req.user.role,
    });

    return apiResponse.success(res, {
      data,
      message: 'Order tax invoice generated.',
    });
  });

  // ==========================================
  // ADMIN ORDER CONTROLLERS
  // ==========================================

  /**
   * 11. Admin: List All Orders with Filters
   * GET /api/v1/admin/orders
   */
  listAdminOrders = asyncHandler(async (req, res) => {
    const result = await orderService.listAdminOrders(req.query);

    return apiResponse.paginated(res, {
      data: result.orders,
      page: result.pagination.page,
      limit: result.pagination.limit,
      total: result.pagination.total,
      message: 'Admin orders retrieved.',
    });
  });

  /**
   * 12. Admin: Update Order Status
   * PATCH /api/v1/admin/orders/:id/status
   */
  updateOrderStatus = asyncHandler(async (req, res) => {
    const updated = await orderService.updateOrderStatus({
      orderId: req.params.id,
      status: req.body.status,
      comment: req.body.comment,
      changedByUserId: req.user.id,
      role: 'ADMIN',
    });

    return apiResponse.success(res, {
      data: updated,
      message: `Order status updated to ${req.body.status}.`,
    });
  });

  /**
   * 13. Admin: Ship Order & Assign Tracking
   * POST /api/v1/admin/orders/:id/ship
   */
  shipOrder = asyncHandler(async (req, res) => {
    const shipment = await orderService.shipOrder({
      orderId: req.params.id,
      ...req.body,
      adminUserId: req.user.id,
    });

    return apiResponse.success(res, {
      data: shipment,
      message: 'Order dispatched and shipment tracking registered.',
    });
  });

  /**
   * 14. Admin: Process Return Action (Approve / Reject)
   * PATCH /api/v1/admin/orders/:id/return-action
   */
  adminReturnAction = asyncHandler(async (req, res) => {
    const updated = await orderService.adminReturnAction({
      orderId: req.params.id,
      ...req.body,
      adminUserId: req.user.id,
    });

    return apiResponse.success(res, {
      data: updated,
      message: `Return request ${req.body.action === 'APPROVE' ? 'approved' : 'rejected'}.`,
    });
  });

  /**
   * 15. Admin: Process Razorpay Refund
   * POST /api/v1/admin/orders/:id/refund
   */
  processRefund = asyncHandler(async (req, res) => {
    const refund = await orderService.processRefund({
      orderId: req.params.id,
      ...req.body,
      adminUserId: req.user.id,
    });

    return apiResponse.success(res, {
      data: refund,
      message: 'Refund processed successfully.',
    });
  });

  /**
   * 16. Admin: Add Internal Notes
   * POST /api/v1/admin/orders/:id/notes
   */
  addAdminNote = asyncHandler(async (req, res) => {
    const updated = await orderService.addAdminNote({
      orderId: req.params.id,
      notes: req.body.notes,
      adminUserId: req.user.id,
    });

    return apiResponse.success(res, {
      data: updated,
      message: 'Internal note appended to order history.',
    });
  });
}

export const orderController = new OrderController();
export default orderController;

