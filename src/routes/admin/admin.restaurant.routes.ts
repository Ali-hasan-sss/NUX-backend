import express from 'express';
import { body, param, query } from 'express-validator';
import { validateRequest } from '../../middlewares/security';
import {
  getRestaurantById,
  createRestaurant,
  createRestaurantWithOwner,
  updateRestaurant,
  deleteRestaurant,
  getAllRestaurants,
} from '../../controllers/admin/admin.restaurant.controller';
import { authenticateUser } from '../../middlewares/Auth';
import { isAdminOrSubAdmin, requirePermission } from '../../middlewares/adminPermissions';

const router = express.Router();

router.use(authenticateUser);
router.use(isAdminOrSubAdmin);
router.use(requirePermission('MANAGE_RESTAURANTS'));

// Get all restaurants
router.get(
  '/',
  [
    query('search').optional().isString().withMessage('search must be a string'),
    query('planId').optional(),
    query('subscriptionActive')
      .optional()
      .isBoolean()
      .withMessage('subscriptionActive must be true or false'),
    query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
    query('pageSize')
      .optional()
      .isInt({ min: 1 })
      .withMessage('pageSize must be a positive integer'),
  ],
  validateRequest,
  getAllRestaurants,
);

// Create restaurant with new owner (user + restaurant + optional plan) — must be before /:id
router.post(
  '/with-owner',
  body('email').trim().normalizeEmail().isEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[0-9]/)
    .withMessage('Password must contain a number')
    .matches(/[A-Z]/)
    .withMessage('Password must contain an uppercase letter'),
  body('fullName').optional().isString().isLength({ max: 100 }).withMessage('Full name too long'),
  body('name')
    .isString()
    .notEmpty()
    .withMessage('Restaurant name is required')
    .isLength({ max: 200 })
    .withMessage('Restaurant name too long'),
  body('address').isString().notEmpty().withMessage('Address is required'),
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  body('planId').optional().isInt({ min: 1 }).withMessage('planId must be a positive integer'),
  validateRequest,
  createRestaurantWithOwner,
);

// Get restaurant by ID
router.get(
  '/:id',
  param('id').isUUID().withMessage('Invalid restaurant ID'),
  validateRequest,
  getRestaurantById,
);

// Create a new restaurant (existing user)
router.post(
  '/',
  body('userId').isUUID().withMessage('Invalid owner user ID'),
  body('name')
    .isString()
    .withMessage('Name must be a string')
    .notEmpty()
    .withMessage('Name is required'),
  body('address')
    .isString()
    .withMessage('Address must be a string')
    .notEmpty()
    .withMessage('Address is required'),
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be a valid number between -90 and 90'),
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be a valid number between -180 and 180'),
  body('planId').optional().isInt().withMessage('Invalid planId'),
  body('subscriptionActive')
    .optional()
    .isBoolean()
    .withMessage('subscriptionActive must be a boolean'),
  body('isGroupMember').optional().isBoolean().withMessage('isGroupMember must be a boolean'),
  validateRequest,
  createRestaurant,
);

// Update restaurant
router.put(
  '/:id',
  param('id').isUUID().withMessage('Invalid restaurant ID'),
  body('userId').optional().isUUID().withMessage('Invalid owner user ID'),
  body('name').optional().isString().withMessage('Name must be a string'),
  body('address').optional().isString().withMessage('Address must be a string'),
  body('latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be a valid number between -90 and 90'),
  body('longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be a valid number between -180 and 180'),
  body('planId').optional().isInt().withMessage('Invalid planId'),
  body('subscriptionActive')
    .optional()
    .isBoolean()
    .withMessage('subscriptionActive must be a boolean'),
  body('isGroupMember').optional().isBoolean().withMessage('isGroupMember must be a boolean'),
  validateRequest,
  updateRestaurant,
);

// Delete restaurant
router.delete(
  '/:id',
  param('id').isUUID().withMessage('Invalid restaurant ID'),
  validateRequest,
  deleteRestaurant,
);

export default router;
