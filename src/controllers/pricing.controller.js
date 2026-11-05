import pricingService from '../services/pricing.service.js';
import apiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

class PricingController {
  /**
   * Authoritative Cart & Checkout Pricing Calculation.
   */
  calculatePricing = asyncHandler(async (req, res) => {
    const { items, couponCode, stateCode, shippingAddress } = req.body;
    const customerId = req.user?.id || null;

    const breakdown = await pricingService.calculateCartPricing({
      items,
      couponCode,
      customerId,
      stateCode,
      shippingAddress,
    });

    return apiResponse.success(res, {
      message: 'Authoritative pricing calculated successfully',
      data: breakdown,
    });
  });
}

export default new PricingController();

