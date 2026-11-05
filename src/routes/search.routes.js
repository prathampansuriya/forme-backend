import { Router } from 'express';
import searchController from '../controllers/search.controller.js';
import validate from '../middleware/validate.middleware.js';
import { searchQuerySchema, autocompleteQuerySchema } from '../validators/search.validator.js';

const router = Router();

router.get('/autocomplete', validate(autocompleteQuerySchema), searchController.autocomplete);
router.get('/products', validate(searchQuerySchema), searchController.searchProducts);
router.get('/categories', searchController.searchCategories);
router.get('/collections', searchController.searchCollections);
router.get('/suggestions', searchController.getSuggestions);
router.get('/popular', searchController.getPopularSearches);

export default router;

