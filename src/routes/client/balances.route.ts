import { Router } from 'express';
import { body } from 'express-validator';
import { authenticateUser } from '../../middlewares/Auth';
import {
  getUserRestaurantsWithBalance,
  giftBalance,
  listPublicPackages,
  payAtRestaurant,
  scanQrCode,
} from '../../controllers/client/balances.controller';
import { validateRequest } from '../../middlewares/security';

const router = Router();

// GET user balances with restaurants
router.get('/with-restaurants', authenticateUser, getUserRestaurantsWithBalance);

// POST scan QR
router.post(
  '/scan-qr',
  authenticateUser,
  body('qrCode').isString().notEmpty().withMessage('QR code is required'),
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be a valid number between -90 and 90'),
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be a valid number between -180 and 180'),
  validateRequest,
  scanQrCode,
);

// post pay with stars or balance
router.post(
  '/pay',
  authenticateUser,
  body('targetId').isUUID().withMessage('targetId must be a valid UUID'),
  body('currencyType')
    .isIn(['balance', 'stars_meal', 'stars_drink'])
    .withMessage('currencyType must be either BALANCE or STARS'),
  body('amount').isFloat({ gt: 0 }).withMessage('amount must be greater than 0'),
  validateRequest,
  payAtRestaurant,
);

// post gift with stars or balance to frind
router.post(
  '/gift',
  authenticateUser,
  body('targetId').isString().notEmpty().withMessage('targetId is required'),
  body('qrCode').isString().notEmpty().withMessage('QR code is required'),
  body('currencyType')
    .isIn(['balance', 'stars_meal', 'stars_drink'])
    .withMessage('currencyType must be either BALANCE or STARS'),
  body('amount').isFloat({ gt: 0 }).withMessage('amount must be greater than 0'),
  validateRequest,
  giftBalance,
);

router.get('/packages/:restaurantId', authenticateUser, validateRequest, listPublicPackages);

export default router;
