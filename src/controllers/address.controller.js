import addressService from '../services/address.service.js';
import apiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

export const listAddresses = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const addresses = await addressService.listAddresses(userId);

  return apiResponse.success(res, {
    message: 'Saved addresses retrieved successfully.',
    data: addresses,
  });
});

export const getAddressById = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const address = await addressService.getAddressById(id, userId);

  return apiResponse.success(res, {
    message: 'Address retrieved successfully.',
    data: address,
  });
});

export const createAddress = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const address = await addressService.createAddress(userId, req.body);

  return apiResponse.success(res, {
    message: 'New delivery address saved.',
    data: address,
    statusCode: 201,
  });
});

export const updateAddress = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const address = await addressService.updateAddress(id, userId, req.body);

  return apiResponse.success(res, {
    message: 'Address updated successfully.',
    data: address,
  });
});

export const setDefaultAddress = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { type } = req.body;

  const address = await addressService.setDefaultAddress(id, userId, type);

  return apiResponse.success(res, {
    message: 'Default address preference updated.',
    data: address,
  });
});

export const deleteAddress = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const result = await addressService.deleteAddress(id, userId);

  return apiResponse.success(res, {
    message: result.message,
    data: result,
  });
});

export default {
  listAddresses,
  getAddressById,
  createAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
};

