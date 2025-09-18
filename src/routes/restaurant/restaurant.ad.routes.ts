import { Router } from 'express';
import { body, param } from 'express-validator';
import {
  createAd,
  updateAd,
  deleteAd,
  getAdsForRestaurant,
} from '../../controllers/restaurant/ad.controller';
import { authenticateUser } from '../../middlewares/Auth';
import { validateRequest } from '../../middlewares/security';
import { verifyRestaurantOwnership } from '../../middlewares/Authorization';
import { canManageAds } from '../../middlewares/permissions';

const router = Router();

/**
 * @route POST /ads
 * @desc Create a new ad (restaurant only)
 */
router.post(
  '/',
  authenticateUser,
  verifyRestaurantOwnership,
  canManageAds,
  body('title').isString().trim().isLength({ min: 2, max: 100 }),
  body('description').optional().isString().isLength({ max: 500 }),
  body('image').isString().trim(),
  body('category').optional().isString().trim(),
  validateRequest,
  createAd,
);

/**
 * @route PUT /ads/:id
 * @desc Update an existing ad (restaurant only)
 */
router.put(
  '/:id',
  authenticateUser,
  verifyRestaurantOwnership,
  canManageAds,
  param('id').isString(),
  body('title').optional().isString().trim(),
  body('description').optional().isString().trim(),
  body('image').optional().isString().trim(),
  body('category').optional().isString().trim(),
  validateRequest,
  updateAd,
);

/**
 * @route DELETE /ads/:id
 * @desc Delete an ad (restaurant only)
 */
router.delete(
  '/:id',
  authenticateUser,
  verifyRestaurantOwnership,
  canManageAds,
  param('id').isString(),
  validateRequest,
  deleteAd,
);

/**
 * @route GET /ads/my
 * @desc Get all restaurant's ads
 */
router.get('/my', authenticateUser, verifyRestaurantOwnership, getAdsForRestaurant);

export default router;
