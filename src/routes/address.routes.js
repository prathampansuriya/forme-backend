import { Router } from 'express';
import addressController from '../controllers/address.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  createAddressSchema,
  updateAddressSchema,
  setDefaultAddressSchema,
  addressIdParamSchema,
} from '../validators/address.validator.js';

const router = Router();

// Address book strictly requires authenticated customer
router.use(authenticate);

router.get('/', addressController.listAddresses);
router.post('/', validate(createAddressSchema), addressController.createAddress);
router.get('/:id', validate(addressIdParamSchema), addressController.getAddressById);
router.patch('/:id', validate(updateAddressSchema), addressController.updateAddress);
router.patch('/:id/default', validate(setDefaultAddressSchema), addressController.setDefaultAddress);
router.delete('/:id', validate(addressIdParamSchema), addressController.deleteAddress);

export default router;

