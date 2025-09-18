import { Router } from 'express';
import {
  getAllRestaurants,
  getRestaurantById,
  getNearbyRestaurants,
} from '../../controllers/common/restaurants.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Restaurants
 *   description: Public restaurants information
 */

// GET /api/restaurants - Get all restaurants with pagination and search
router.get('/', getAllRestaurants);

// GET /api/restaurants/nearby - Get restaurants near a location
router.get('/nearby', getNearbyRestaurants);

// GET /api/restaurants/:id - Get specific restaurant by ID
router.get('/:id', getRestaurantById);

export default router;
