import { Router } from 'express';
import { authenticateUser } from '../../middlewares/Auth';
import {
  getAdsForAll,
  getRestaurantPackages,
} from '../../controllers/common/ads.client.controller';

const router = Router();

// Get all ads with filters and pagination
router.get('/', authenticateUser, getAdsForAll);

// Get packages for a specific restaurant
router.get('/restaurant/:restaurantId/packages', authenticateUser, getRestaurantPackages);

export default router;
