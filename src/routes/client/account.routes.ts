import { Router } from 'express';
import { body } from 'express-validator';
import {
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
} from '../../controllers/client/account.controller';
import { validateRequest } from '../../middlewares/security';
import { authenticateUser } from '../../middlewares/Auth';

const router = Router();

// Get own profile
router.get('/me', authenticateUser, getProfile);

// Update profile
router.put(
  '/me',
  authenticateUser,
  body('fullName')
    .optional()
    .isString()
    .withMessage('Full name must be a string')
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters'),
  body('email').trim().normalizeEmail().isEmail().withMessage('Invalid email format'),
  validateRequest,
  updateProfile,
);

// Change password
router.put(
  '/me/change-password',
  authenticateUser,
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
    .matches(/[0-9]/)
    .withMessage('New password must contain a number')
    .matches(/[A-Z]/)
    .withMessage('New password must contain an uppercase letter'),
  validateRequest,
  changePassword,
);

// Delete account (requires password)
router.delete(
  '/me',
  authenticateUser,
  body('password').notEmpty().withMessage('Password is required to delete account'),
  validateRequest,
  deleteAccount,
);

export default router;
