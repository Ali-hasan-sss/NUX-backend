// src/routes/auth.routes.ts
import { Router } from 'express';
import {
  register,
  login,
  refresh,
  verifyEmail,
  registerRestaurant,
  requestPasswordReset,
  resetPassword,
  sendVerificationCode,
} from '../../controllers/client/auth.controller';
import {
  generalRateLimiter,
  loginRateLimiter,
  validateRequest,
  xssSanitizerMiddleware,
} from '../../middlewares/security';
import { body } from 'express-validator';
import { adminLogin } from '../../controllers/admin/admin.auth.controller';

const router = Router();

// Register
router.post(
  '/register',
  xssSanitizerMiddleware,
  generalRateLimiter,
  body('email').trim().normalizeEmail().isEmail().withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
    .matches(/[0-9]/)
    .withMessage('New password must contain a number')
    .matches(/[A-Z]/)
    .withMessage('New password must contain an uppercase letter'),
  validateRequest,
  register,
);

// Register for restaurant
router.post(
  '/registerRestaurant',
  xssSanitizerMiddleware,
  [
    body('email').trim().normalizeEmail().isEmail().withMessage('Please provide a valid email'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters')
      .matches(/[0-9]/)
      .withMessage('New password must contain a number')
      .matches(/[A-Z]/)
      .withMessage('New password must contain an uppercase letter'),
    body('restaurantName').notEmpty().withMessage('Restaurant name is required'),
    body('address').notEmpty().withMessage('Address is required'),
    body('latitude')
      .isFloat({ min: -90, max: 90 })
      .withMessage('Latitude must be between -90 and 90'),
    body('longitude')
      .isFloat({ min: -180, max: 180 })
      .withMessage('Longitude must be between -180 and 180'),
    validateRequest, // middleware to check validation result and send errors
  ],
  generalRateLimiter,
  registerRestaurant,
);

// Login
router.post(
  '/login',
  xssSanitizerMiddleware,
  loginRateLimiter,
  body('email').trim().normalizeEmail().isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  validateRequest,
  login,
);

// Admin Login
router.post(
  '/admin/login',
  xssSanitizerMiddleware,
  body('email').trim().normalizeEmail().isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  validateRequest,
  adminLogin,
);

// Refresh token
router.post(
  '/refresh',
  xssSanitizerMiddleware,
  body('refreshToken').isString().notEmpty().withMessage('Refresh token is required'),
  refresh,
);

// send email verification code
router.post(
  '/send-verification-code',
  generalRateLimiter,
  body('email').trim().normalizeEmail().isEmail().withMessage('Please provide a valid email'),
  sendVerificationCode,
);

// Verify email
router.post(
  '/verify-email',
  generalRateLimiter,
  body('email').trim().normalizeEmail().isEmail().withMessage('Please provide a valid email'),
  body('code')
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('Verification code must be a 6-digit number'),
  verifyEmail,
);

//send email for reset password
router.post(
  '/request-password-reset',
  xssSanitizerMiddleware,
  generalRateLimiter,
  body('email').trim().normalizeEmail().isEmail().withMessage('Please provide a valid email'),
  requestPasswordReset,
);

//reset password
router.post(
  '/reset-password',
  xssSanitizerMiddleware,
  generalRateLimiter,
  body('email').trim().normalizeEmail().isEmail().withMessage('Please provide a valid email'),
  body('resetCode')
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('Reset code must be a 6-digit number'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
    .matches(/[0-9]/)
    .withMessage('New password must contain a number')
    .matches(/[A-Z]/)
    .withMessage('New password must contain an uppercase letter'),
  resetPassword,
);

export default router;
