import couponService from '../services/coupon.service.js';
import apiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

class CouponController {
  /**
   * Validate coupon against cart items.
   */
  validateCoupon = asyncHandler(async (req, res) => {
    const { code, items, stateCode } = req.body;
    const customerId = req.user?.id || null;

    const result = await couponService.validateCoupon({
      code,
      items,
      customerId,
      stateCode,
    });

    return apiResponse.success(res, {
      message: `Coupon "${result.coupon.code}" successfully applied`,
      data: result,
    });
  });

  /**
   * Return coupons applicable to current cart.
   */
  getApplicableCoupons = asyncHandler(async (req, res) => {
    const { items } = req.body;
    const customerId = req.user?.id || null;

    const coupons = await couponService.getApplicableCoupons({
      items,
      customerId,
    });

    return apiResponse.success(res, {
      message: 'Applicable coupons retrieved successfully',
      data: coupons,
    });
  });

  /**
   * List public active coupons.
   */
  listActiveCoupons = asyncHandler(async (req, res) => {
    const coupons = await couponService.listActiveCoupons();

    return apiResponse.success(res, {
      message: 'Active promotional coupons retrieved successfully',
      data: coupons,
    });
  });

  /**
   * Admin: List all coupons.
   */
  listCoupons = asyncHandler(async (req, res) => {
    const { page, limit, search, isActive, discountType } = req.query;

    const result = await couponService.listCoupons({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      isActive,
      discountType,
    });

    return apiResponse.success(res, {
      message: 'Coupons retrieved successfully',
      data: result.coupons,
      pagination: result.pagination,
    });
  });

  /**
   * Admin: Get coupon by ID.
   */
  getCouponById = asyncHandler(async (req, res) => {
    const coupon = await couponService.getCouponById(req.params.id);

    return apiResponse.success(res, {
      message: 'Coupon details retrieved successfully',
      data: coupon,
    });
  });

  /**
   * Admin: Create coupon.
   */
  createCoupon = asyncHandler(async (req, res) => {
    const coupon = await couponService.createCoupon(req.body);

    return apiResponse.success(res, {
      statusCode: 201,
      message: `Coupon "${coupon.code}" created successfully`,
      data: coupon,
    });
  });

  /**
   * Admin: Update coupon.
   */
  updateCoupon = asyncHandler(async (req, res) => {
    const coupon = await couponService.updateCoupon(req.params.id, req.body);

    return apiResponse.success(res, {
      message: `Coupon "${coupon.code}" updated successfully`,
      data: coupon,
    });
  });

  /**
   * Admin: Delete coupon.
   */
  deleteCoupon = asyncHandler(async (req, res) => {
    const result = await couponService.deleteCoupon(req.params.id);

    return apiResponse.success(res, {
      message: result.message,
      data: { id: result.id },
    });
  });
}

export default new CouponController();

