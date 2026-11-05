import flashSaleService from '../services/flashSale.service.js';
import apiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

class FlashSaleController {
  /**
   * Get currently active flash sales with countdown timers.
   */
  getActiveFlashSales = asyncHandler(async (req, res) => {
    const flashSales = await flashSaleService.getActiveFlashSales();

    return apiResponse.success(res, {
      message: 'Active flash sales retrieved successfully',
      data: flashSales,
    });
  });

  /**
   * Get flash sale details by slug or ID.
   */
  getFlashSaleBySlug = asyncHandler(async (req, res) => {
    const identifier = req.params.slug || req.params.idOrSlug || req.params.id;
    const flashSale = await flashSaleService.getFlashSaleByIdOrSlug(identifier);

    return apiResponse.success(res, {
      message: 'Flash sale details retrieved successfully',
      data: flashSale,
    });
  });

  getFlashSaleByIdOrSlug = this.getFlashSaleBySlug;

  /**
   * Admin: List all flash sales.
   */
  listFlashSales = asyncHandler(async (req, res) => {
    const { page, limit, status, search } = req.query;

    const result = await flashSaleService.listFlashSales({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      status,
      search,
    });

    return apiResponse.success(res, {
      message: 'Flash sales retrieved successfully',
      data: result.flashSales,
      pagination: result.pagination,
    });
  });

  /**
   * Admin: Create flash sale drop.
   */
  createFlashSale = asyncHandler(async (req, res) => {
    const flashSale = await flashSaleService.createFlashSale(req.body);

    return apiResponse.success(res, {
      statusCode: 201,
      message: `Flash sale "${flashSale.name}" created successfully`,
      data: flashSale,
    });
  });

  /**
   * Admin: Update flash sale.
   */
  updateFlashSale = asyncHandler(async (req, res) => {
    const flashSale = await flashSaleService.updateFlashSale(req.params.id, req.body);

    return apiResponse.success(res, {
      message: `Flash sale "${flashSale.name}" updated successfully`,
      data: flashSale,
    });
  });

  /**
   * Admin: Add products to flash sale.
   */
  addProducts = asyncHandler(async (req, res) => {
    const flashSale = await flashSaleService.addProductsToFlashSale(req.params.id, req.body.products);

    return apiResponse.success(res, {
      message: 'Products successfully added to flash sale',
      data: flashSale,
    });
  });

  /**
   * Admin: Remove product from flash sale.
   */
  removeProduct = asyncHandler(async (req, res) => {
    const { id, productId } = req.params;
    const { variantId } = req.query;

    const result = await flashSaleService.removeProductFromFlashSale(id, productId, variantId);

    return apiResponse.success(res, {
      message: result.message,
    });
  });

  /**
   * Admin: Delete flash sale.
   */
  deleteFlashSale = asyncHandler(async (req, res) => {
    const result = await flashSaleService.deleteFlashSale(req.params.id);

    return apiResponse.success(res, {
      message: result.message,
      data: { id: result.id },
    });
  });
}

export default new FlashSaleController();

