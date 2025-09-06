"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/auth.routes.ts
const express_1 = require("express");
const auth_controller_1 = require("../../controllers/client/auth.controller");
const security_1 = require("../../middlewares/security");
const express_validator_1 = require("express-validator");
const admin_auth_controller_1 = require("../../controllers/admin/admin.auth.controller");
const router = (0, express_1.Router)();
// Register
router.post('/register', security_1.xssSanitizerMiddleware, security_1.generalRateLimiter, (0, express_validator_1.body)('email').trim().normalizeEmail().isEmail().withMessage('Please provide a valid email'), (0, express_validator_1.body)('password')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
    .matches(/[0-9]/)
    .withMessage('New password must contain a number')
    .matches(/[A-Z]/)
    .withMessage('New password must contain an uppercase letter'), security_1.validateRequest, auth_controller_1.register);
// Register for restaurant
router.post('/registerRestaurant', security_1.xssSanitizerMiddleware, [
    (0, express_validator_1.body)('email').trim().normalizeEmail().isEmail().withMessage('Please provide a valid email'),
    (0, express_validator_1.body)('password')
        .isLength({ min: 8 })
        .withMessage('New password must be at least 8 characters')
        .matches(/[0-9]/)
        .withMessage('New password must contain a number')
        .matches(/[A-Z]/)
        .withMessage('New password must contain an uppercase letter'),
    (0, express_validator_1.body)('restaurantName').notEmpty().withMessage('Restaurant name is required'),
    (0, express_validator_1.body)('address').notEmpty().withMessage('Address is required'),
    (0, express_validator_1.body)('latitude')
        .isFloat({ min: -90, max: 90 })
        .withMessage('Latitude must be between -90 and 90'),
    (0, express_validator_1.body)('longitude')
        .isFloat({ min: -180, max: 180 })
        .withMessage('Longitude must be between -180 and 180'),
    security_1.validateRequest, // middleware to check validation result and send errors
], security_1.generalRateLimiter, auth_controller_1.registerRestaurant);
// Login
router.post('/login', security_1.xssSanitizerMiddleware, security_1.loginRateLimiter, (0, express_validator_1.body)('email').trim().normalizeEmail().isEmail().withMessage('Please provide a valid email'), (0, express_validator_1.body)('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'), security_1.validateRequest, auth_controller_1.login);
// Admin Login
router.post('/admin/login', security_1.xssSanitizerMiddleware, (0, express_validator_1.body)('email').trim().normalizeEmail().isEmail().withMessage('Please provide a valid email'), (0, express_validator_1.body)('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'), security_1.validateRequest, admin_auth_controller_1.adminLogin);
// Refresh token
router.post('/refresh', security_1.xssSanitizerMiddleware, (0, express_validator_1.body)('refreshToken').isString().notEmpty().withMessage('Refresh token is required'), auth_controller_1.refresh);
// send email verification code
router.post('/send-verification-code', security_1.generalRateLimiter, (0, express_validator_1.body)('email').trim().normalizeEmail().isEmail().withMessage('Please provide a valid email'), auth_controller_1.sendVerificationCode);
// Verify email
router.post('/verify-email', security_1.generalRateLimiter, (0, express_validator_1.body)('email').trim().normalizeEmail().isEmail().withMessage('Please provide a valid email'), (0, express_validator_1.body)('code')
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('Verification code must be a 6-digit number'), auth_controller_1.verifyEmail);
//send email for reset password
router.post('/request-password-reset', security_1.xssSanitizerMiddleware, security_1.generalRateLimiter, (0, express_validator_1.body)('email').trim().normalizeEmail().isEmail().withMessage('Please provide a valid email'), auth_controller_1.requestPasswordReset);
//reset password
router.post('/reset-password', security_1.xssSanitizerMiddleware, security_1.generalRateLimiter, (0, express_validator_1.body)('email').trim().normalizeEmail().isEmail().withMessage('Please provide a valid email'), (0, express_validator_1.body)('resetCode')
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('Reset code must be a 6-digit number'), (0, express_validator_1.body)('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
    .matches(/[0-9]/)
    .withMessage('New password must contain a number')
    .matches(/[A-Z]/)
    .withMessage('New password must contain an uppercase letter'), auth_controller_1.resetPassword);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map