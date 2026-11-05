import asyncHandler from '../utils/asyncHandler.js';
import apiResponse from '../utils/apiResponse.js';
import adminAnalyticsService from '../services/adminAnalytics.service.js';
import adminCustomerService from '../services/adminCustomer.service.js';
import adminSettingService from '../services/adminSetting.service.js';
import adminCommerceService from '../services/adminCommerce.service.js';
import auditService from '../services/audit.service.js';

class AdminController {
  // ==========================================
  // 1. ANALYTICS
  // ==========================================

  getOverviewKPIs = asyncHandler(async (req, res) => {
    const data = await adminAnalyticsService.getOverviewKPIs(req.query);
    return apiResponse.success(res, {
      message: 'Overview KPI metrics retrieved successfully.',
      data,
    });
  });

  getSalesTrends = asyncHandler(async (req, res) => {
    const data = await adminAnalyticsService.getSalesTrends({ days: req.query.days });
    return apiResponse.success(res, {
      message: 'Sales and revenue trends retrieved successfully.',
      data,
    });
  });

  getPaymentMethodBreakdown = asyncHandler(async (req, res) => {
    const data = await adminAnalyticsService.getPaymentMethodBreakdown();
    return apiResponse.success(res, {
      message: 'Payment method breakdown retrieved successfully.',
      data,
    });
  });

  getBestSellingProducts = asyncHandler(async (req, res) => {
    const data = await adminAnalyticsService.getBestSellingProducts({ limit: req.query.limit });
    return apiResponse.success(res, {
      message: 'Best-selling products retrieved successfully.',
      data,
    });
  });

  getCategoryPerformance = asyncHandler(async (req, res) => {
    const data = await adminAnalyticsService.getCategoryPerformance();
    return apiResponse.success(res, {
      message: 'Category sales performance retrieved successfully.',
      data,
    });
  });

  getCollectionPerformance = asyncHandler(async (req, res) => {
    const data = await adminAnalyticsService.getCollectionPerformance();
    return apiResponse.success(res, {
      message: 'Collection sales performance retrieved successfully.',
      data,
    });
  });

  getInventoryValuation = asyncHandler(async (req, res) => {
    const data = await adminAnalyticsService.getInventoryValuation();
    return apiResponse.success(res, {
      message: 'Inventory valuation and health report retrieved successfully.',
      data,
    });
  });

  getConversionFunnel = asyncHandler(async (req, res) => {
    const data = await adminAnalyticsService.getConversionFunnel();
    return apiResponse.success(res, {
      message: 'E-commerce conversion funnel metrics retrieved successfully.',
      data,
    });
  });

  getPromotionPerformance = asyncHandler(async (req, res) => {
    const data = await adminAnalyticsService.getPromotionPerformance();
    return apiResponse.success(res, {
      message: 'Promotion and campaign performance retrieved successfully.',
      data,
    });
  });

  getCouponPerformance = asyncHandler(async (req, res) => {
    const data = await adminAnalyticsService.getCouponPerformance();
    return apiResponse.success(res, {
      message: 'Coupon performance and redemptions retrieved successfully.',
      data,
    });
  });

  // ==========================================
  // 2. CUSTOMERS
  // ==========================================

  listCustomers = asyncHandler(async (req, res) => {
    const result = await adminCustomerService.listCustomers(req.query);
    return apiResponse.paginated(res, {
      message: 'Customers retrieved successfully.',
      data: result.customers,
      page: result.pagination.page,
      limit: result.pagination.limit,
      total: result.pagination.total,
      totalPages: result.pagination.totalPages,
    });
  });

  getCustomerDetails = asyncHandler(async (req, res) => {
    const details = await adminCustomerService.getCustomerDetails(req.params.id);
    return apiResponse.success(res, {
      message: 'Customer profile details retrieved successfully.',
      data: details,
    });
  });

  updateCustomerStatus = asyncHandler(async (req, res) => {
    const result = await adminCustomerService.updateCustomerStatus(
      req.params.id,
      req.body,
      req.user.id,
      req
    );
    return apiResponse.success(res, {
      message: result.message,
      data: result.customer,
    });
  });

  getCustomerOrderHistory = asyncHandler(async (req, res) => {
    const result = await adminCustomerService.getCustomerOrderHistory(req.params.id, req.query);
    return apiResponse.paginated(res, {
      message: 'Customer order history retrieved successfully.',
      data: result.orders,
      page: result.pagination.page,
      limit: result.pagination.limit,
      total: result.pagination.total,
      totalPages: result.pagination.totalPages,
    });
  });

  // ==========================================
  // 3. SETTINGS
  // ==========================================

  listStoreSettings = asyncHandler(async (req, res) => {
    const settings = await adminSettingService.listStoreSettings();
    return apiResponse.success(res, {
      message: 'Store settings retrieved successfully.',
      data: settings,
    });
  });

  getStoreSettingByKey = asyncHandler(async (req, res) => {
    const setting = await adminSettingService.getStoreSettingByKey(req.params.key);
    return apiResponse.success(res, {
      message: 'Store setting retrieved successfully.',
      data: setting,
    });
  });

  upsertStoreSetting = asyncHandler(async (req, res) => {
    const { key, value, description } = req.body;
    const setting = await adminSettingService.upsertStoreSetting(
      key,
      value,
      description,
      req.user.id,
      req
    );
    return apiResponse.success(res, {
      message: 'Store setting updated successfully.',
      data: setting,
    });
  });

  listTaxSettings = asyncHandler(async (req, res) => {
    const taxes = await adminSettingService.listTaxSettings();
    return apiResponse.success(res, {
      message: 'Tax settings retrieved successfully.',
      data: taxes,
    });
  });

  createTaxSetting = asyncHandler(async (req, res) => {
    const tax = await adminSettingService.createTaxSetting(req.body, req.user.id, req);
    return apiResponse.created(res, {
      message: 'Tax setting created successfully.',
      data: tax,
    });
  });

  updateTaxSetting = asyncHandler(async (req, res) => {
    const tax = await adminSettingService.updateTaxSetting(req.params.id, req.body, req.user.id, req);
    return apiResponse.success(res, {
      message: 'Tax setting updated successfully.',
      data: tax,
    });
  });

  deleteTaxSetting = asyncHandler(async (req, res) => {
    const result = await adminSettingService.deleteTaxSetting(req.params.id, req.user.id, req);
    return apiResponse.success(res, {
      message: result.message,
      data: result,
    });
  });

  listShippingSettings = asyncHandler(async (req, res) => {
    const shippings = await adminSettingService.listShippingSettings();
    return apiResponse.success(res, {
      message: 'Shipping settings retrieved successfully.',
      data: shippings,
    });
  });

  createShippingSetting = asyncHandler(async (req, res) => {
    const shipping = await adminSettingService.createShippingSetting(req.body, req.user.id, req);
    return apiResponse.created(res, {
      message: 'Shipping method created successfully.',
      data: shipping,
    });
  });

  updateShippingSetting = asyncHandler(async (req, res) => {
    const shipping = await adminSettingService.updateShippingSetting(req.params.id, req.body, req.user.id, req);
    return apiResponse.success(res, {
      message: 'Shipping method updated successfully.',
      data: shipping,
    });
  });

  deleteShippingSetting = asyncHandler(async (req, res) => {
    const result = await adminSettingService.deleteShippingSetting(req.params.id, req.user.id, req);
    return apiResponse.success(res, {
      message: result.message,
      data: result,
    });
  });

  listCurrencySettings = asyncHandler(async (req, res) => {
    const currencies = await adminSettingService.listCurrencySettings();
    return apiResponse.success(res, {
      message: 'Currency configurations retrieved successfully.',
      data: currencies,
    });
  });

  createCurrencySetting = asyncHandler(async (req, res) => {
    const currency = await adminSettingService.createCurrencySetting(req.body, req.user.id, req);
    return apiResponse.created(res, {
      message: 'Currency created successfully.',
      data: currency,
    });
  });

  updateCurrencySetting = asyncHandler(async (req, res) => {
    const currency = await adminSettingService.updateCurrencySetting(req.params.id, req.body, req.user.id, req);
    return apiResponse.success(res, {
      message: 'Currency updated successfully.',
      data: currency,
    });
  });

  deleteCurrencySetting = asyncHandler(async (req, res) => {
    const result = await adminSettingService.deleteCurrencySetting(req.params.id, req.user.id, req);
    return apiResponse.success(res, {
      message: result.message,
      data: result,
    });
  });

  getBrandSettings = asyncHandler(async (req, res) => {
    const brand = await adminSettingService.getBrandSettings();
    return apiResponse.success(res, {
      message: 'Brand configuration retrieved successfully.',
      data: brand,
    });
  });

  updateBrandSettings = asyncHandler(async (req, res) => {
    const brand = await adminSettingService.updateBrandSettings(req.body, req.user.id, req);
    return apiResponse.success(res, {
      message: 'Brand configuration updated successfully.',
      data: brand,
    });
  });

  getHomepageLayout = asyncHandler(async (req, res) => {
    const layout = await adminSettingService.getHomepageLayout();
    return apiResponse.success(res, {
      message: 'Homepage layout configuration retrieved.',
      data: layout,
    });
  });

  updateHomepageLayout = asyncHandler(async (req, res) => {
    const layout = await adminSettingService.updateHomepageLayout(req.body.sections, req.user.id, req);
    return apiResponse.success(res, {
      message: 'Homepage layout configuration saved successfully.',
      data: layout,
    });
  });

  probePaymentGateway = asyncHandler(async (req, res) => {
    const report = await adminSettingService.probePaymentGateway();
    return apiResponse.success(res, {
      message: 'Payment gateway health check completed.',
      data: report,
    });
  });

  probeEmailTransport = asyncHandler(async (req, res) => {
    const report = await adminSettingService.probeEmailTransport();
    return apiResponse.success(res, {
      message: 'Email transport health check completed.',
      data: report,
    });
  });

  // ==========================================
  // 4. COMMERCE (PAYMENTS, REFUNDS, REVIEWS)
  // ==========================================

  listPayments = asyncHandler(async (req, res) => {
    const result = await adminCommerceService.listPayments(req.query);
    return apiResponse.paginated(res, {
      message: 'Payment transactions retrieved successfully.',
      data: result.payments,
      page: result.pagination.page,
      limit: result.pagination.limit,
      total: result.pagination.total,
      totalPages: result.pagination.totalPages,
    });
  });

  getPaymentDetails = asyncHandler(async (req, res) => {
    const payment = await adminCommerceService.getPaymentDetails(req.params.id);
    return apiResponse.success(res, {
      message: 'Payment details retrieved successfully.',
      data: payment,
    });
  });

  listRefunds = asyncHandler(async (req, res) => {
    const result = await adminCommerceService.listRefunds(req.query);
    return apiResponse.paginated(res, {
      message: 'Refund transactions retrieved successfully.',
      data: result.refunds,
      page: result.pagination.page,
      limit: result.pagination.limit,
      total: result.pagination.total,
      totalPages: result.pagination.totalPages,
    });
  });

  moderateReview = asyncHandler(async (req, res) => {
    const review = await adminCommerceService.moderateReview(
      req.params.id,
      req.body.isApproved,
      req.user.id,
      req
    );
    return apiResponse.success(res, {
      message: `Review has been ${req.body.isApproved ? 'approved' : 'hidden'} successfully.`,
      data: review,
    });
  });

  deleteReview = asyncHandler(async (req, res) => {
    const result = await adminCommerceService.deleteReview(req.params.id, req.user.id, req);
    return apiResponse.success(res, {
      message: result.message,
      data: result,
    });
  });

  // ==========================================
  // 5. AUDIT LOGS
  // ==========================================

  listAuditLogs = asyncHandler(async (req, res) => {
    const result = await auditService.listAuditLogs(req.query);
    return apiResponse.paginated(res, {
      message: 'Admin audit logs retrieved successfully.',
      data: result.logs,
      page: result.pagination.page,
      limit: result.pagination.limit,
      total: result.pagination.total,
      totalPages: result.pagination.totalPages,
    });
  });

  getAuditLogById = asyncHandler(async (req, res) => {
    const log = await auditService.getAuditLogById(req.params.id);
    if (!log) {
      return apiResponse.error(res, {
        statusCode: 404,
        message: 'Audit log record not found.',
      });
    }
    return apiResponse.success(res, {
      message: 'Audit log details retrieved successfully.',
      data: log,
    });
  });
}

export const adminController = new AdminController();
export default adminController;

