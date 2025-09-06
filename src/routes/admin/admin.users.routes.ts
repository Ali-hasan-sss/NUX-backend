import { Router } from 'express';
import {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  getUserById,
} from '../../controllers/admin/admin.users.controller';

import { body, param, query } from 'express-validator';
import { validateRequest } from '../../middlewares/security';
import { isAdminMiddleware } from '../../middlewares/Authorization';
import { authenticateUser } from '../../middlewares/Auth';

const router = Router();
router.use(authenticateUser);
router.use(isAdminMiddleware);

router.get(
  '/',
  [
    query('role')
      .optional()
      .isIn(['USER', 'RESTAURANT_OWNER', 'ADMIN'])
      .withMessage('Invalid role filter'),
    query('isActive').optional().isBoolean().withMessage('isActive must be true or false'),
    query('email').optional().isString().withMessage('Email filter must be a string'),
    query('pageNumber')
      .optional()
      .isInt({ min: 1 })
      .withMessage('pageNumber must be a positive integer'),
    query('pageSize')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('pageSize must be between 1 and 100'),
  ],
  validateRequest,
  getAllUsers,
);

// get user by id
router.get(
  '/:id',
  param('id').isUUID().withMessage('Invalid user ID'),
  validateRequest,
  getUserById,
);

// create new user
router.post(
  '/',
  body('email').trim().normalizeEmail().isEmail().withMessage('Invalid email format'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[0-9]/)
    .withMessage('Password must contain a number')
    .matches(/[A-Z]/)
    .withMessage('Password must contain an uppercase letter'),
  body('fullName')
    .optional()
    .isString()
    .withMessage('Full name must be a string')
    .isLength({ max: 100 })
    .withMessage('Full name is too long'),
  body('role').optional().isIn(['USER', 'RESTAURANT_OWNER', 'ADMIN']).withMessage('Invalid role'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  validateRequest,
  createUser,
);

// update user
router.put(
  '/:id',
  param('id').isUUID().withMessage('Invalid user ID'),
  body('email').optional().trim().normalizeEmail().isEmail().withMessage('Invalid email format'),
  body('password')
    .optional()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  body('fullName')
    .optional()
    .isString()
    .withMessage('Full name must be a string')
    .isLength({ max: 100 })
    .withMessage('Full name is too long'),
  body('role').optional().isIn(['USER', 'RESTAURANT_OWNER', 'ADMIN']).withMessage('Invalid role'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  validateRequest,
  updateUser,
);

// delete user
router.delete(
  '/:id',
  param('id').isUUID().withMessage('Invalid user ID'),
  validateRequest,
  deleteUser,
);

export default router;
