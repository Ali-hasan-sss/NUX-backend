import { Router } from 'express';
import { getRestaurantOverview } from '../../controllers/restaurant/restaurant.overview.controller';
import { authenticateUser } from '../../middlewares/Auth';
import { verifyRestaurantOwnership } from '../../middlewares/Authorization';

const router = Router();

// Apply authentication and restaurant owner middleware to all routes
router.use(authenticateUser);
router.use(verifyRestaurantOwnership);

// Get restaurant dashboard overview
router.get('/', getRestaurantOverview);

export default router;
