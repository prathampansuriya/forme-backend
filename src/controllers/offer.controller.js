import offerService from '../services/offer.service.js';
import apiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

class OfferController {
  /**
   * Get currently active promotional offers.
   */
  getActiveOffers = asyncHandler(async (req, res) => {
    const offers = await offerService.listActiveOffers();

    return apiResponse.success(res, {
      message: 'Active promotional offers retrieved successfully',
      data: offers,
    });
  });

  /**
   * Get offer details by slug.
   */
  getOfferBySlug = asyncHandler(async (req, res) => {
    const offer = await offerService.getOfferBySlug(req.params.slug);

    return apiResponse.success(res, {
      message: 'Offer details retrieved successfully',
      data: offer,
    });
  });

  /**
   * Get offer details by ID.
   */
  getOfferById = asyncHandler(async (req, res) => {
    const offer = await offerService.getOfferById(req.params.id);

    return apiResponse.success(res, {
      message: 'Offer details retrieved successfully',
      data: offer,
    });
  });

  /**
   * Admin: List all offers.
   */
  listOffers = asyncHandler(async (req, res) => {
    const { page, limit, search, isActive } = req.query;

    const result = await offerService.listOffers({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      isActive,
    });

    return apiResponse.success(res, {
      message: 'Offers retrieved successfully',
      data: result.offers,
      pagination: result.pagination,
    });
  });

  /**
   * Admin: Create offer.
   */
  createOffer = asyncHandler(async (req, res) => {
    const offer = await offerService.createOffer(req.body);

    return apiResponse.success(res, {
      statusCode: 201,
      message: `Offer "${offer.name}" created successfully`,
      data: offer,
    });
  });

  /**
   * Admin: Update offer.
   */
  updateOffer = asyncHandler(async (req, res) => {
    const offer = await offerService.updateOffer(req.params.id, req.body);

    return apiResponse.success(res, {
      message: `Offer "${offer.name}" updated successfully`,
      data: offer,
    });
  });

  /**
   * Admin: Delete offer.
   */
  deleteOffer = asyncHandler(async (req, res) => {
    const result = await offerService.deleteOffer(req.params.id);

    return apiResponse.success(res, {
      message: result.message,
      data: { id: result.id },
    });
  });
}

export default new OfferController();

