import express from 'express';
import { body, param } from 'express-validator';
import { validateRequest } from '../../middlewares/security';

import { authenticateUser } from '../../middlewares/Auth';
import {
  updateRestaurantByOwner,
  getRestaurantByOwner,
  regenerateRestaurantQRCodes,
} from '../../controllers/restaurant/restaurant.info.controller';
import { verifyRestaurantOwnership } from '../../middlewares/Authorization';

const router = express.Router();

// Get own restaurant
router.get(
  '/me',
  authenticateUser,
  verifyRestaurantOwnership,
  validateRequest,
  getRestaurantByOwner,
);

router.put(
  '/update',
  authenticateUser,
  verifyRestaurantOwnership,
  body('name').optional().isString().withMessage('Name must be a string'),
  body('logo').optional().isURL().withMessage('Logo must be a valid URL'),
  body('address').optional().isString().withMessage('Address must be a string'),
  body('latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be a valid number between -90 and 90'),
  body('longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be a valid number between -180 and 180'),

  validateRequest,
  updateRestaurantByOwner,
);

// Regenerate restaurant QR codes
router.put(
  '/qr/regenerate',
  authenticateUser,
  verifyRestaurantOwnership,
  validateRequest,
  regenerateRestaurantQRCodes,
);
export default router;
