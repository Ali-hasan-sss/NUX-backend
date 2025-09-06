"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const account_controller_1 = require("../../controllers/client/account.controller");
const security_1 = require("../../middlewares/security");
const Auth_1 = require("../../middlewares/Auth");
const router = (0, express_1.Router)();
// Get own profile
router.get('/me', Auth_1.authenticateUser, account_controller_1.getProfile);
// Update profile
router.put('/me', Auth_1.authenticateUser, (0, express_validator_1.body)('fullName')
    .optional()
    .isString()
    .withMessage('Full name must be a string')
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters'), (0, express_validator_1.body)('email').trim().normalizeEmail().isEmail().withMessage('Invalid email format'), security_1.validateRequest, account_controller_1.updateProfile);
// Change password
router.put('/me/change-password', Auth_1.authenticateUser, (0, express_validator_1.body)('currentPassword').notEmpty().withMessage('Current password is required'), (0, express_validator_1.body)('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
    .matches(/[0-9]/)
    .withMessage('New password must contain a number')
    .matches(/[A-Z]/)
    .withMessage('New password must contain an uppercase letter'), security_1.validateRequest, account_controller_1.changePassword);
// Delete account (requires password)
router.delete('/me', Auth_1.authenticateUser, (0, express_validator_1.body)('password').notEmpty().withMessage('Password is required to delete account'), security_1.validateRequest, account_controller_1.deleteAccount);
exports.default = router;
//# sourceMappingURL=account.routes.js.map