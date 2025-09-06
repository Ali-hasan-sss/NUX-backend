"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const admin_users_controller_1 = require("../../controllers/admin/admin.users.controller");
const express_validator_1 = require("express-validator");
const security_1 = require("../../middlewares/security");
const Authorization_1 = require("../../middlewares/Authorization");
const Auth_1 = require("../../middlewares/Auth");
const router = (0, express_1.Router)();
router.use(Auth_1.authenticateUser);
router.use(Authorization_1.isAdminMiddleware);
router.get('/', [
    (0, express_validator_1.query)('role')
        .optional()
        .isIn(['USER', 'RESTAURANT_OWNER', 'ADMIN'])
        .withMessage('Invalid role filter'),
    (0, express_validator_1.query)('isActive').optional().isBoolean().withMessage('isActive must be true or false'),
    (0, express_validator_1.query)('email').optional().isString().withMessage('Email filter must be a string'),
    (0, express_validator_1.query)('pageNumber')
        .optional()
        .isInt({ min: 1 })
        .withMessage('pageNumber must be a positive integer'),
    (0, express_validator_1.query)('pageSize')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('pageSize must be between 1 and 100'),
], security_1.validateRequest, admin_users_controller_1.getAllUsers);
// get user by id
router.get('/:id', (0, express_validator_1.param)('id').isUUID().withMessage('Invalid user ID'), security_1.validateRequest, admin_users_controller_1.getUserById);
// create new user
router.post('/', (0, express_validator_1.body)('email').trim().normalizeEmail().isEmail().withMessage('Invalid email format'), (0, express_validator_1.body)('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[0-9]/)
    .withMessage('Password must contain a number')
    .matches(/[A-Z]/)
    .withMessage('Password must contain an uppercase letter'), (0, express_validator_1.body)('fullName')
    .optional()
    .isString()
    .withMessage('Full name must be a string')
    .isLength({ max: 100 })
    .withMessage('Full name is too long'), (0, express_validator_1.body)('role').optional().isIn(['USER', 'RESTAURANT_OWNER', 'ADMIN']).withMessage('Invalid role'), (0, express_validator_1.body)('isActive').optional().isBoolean().withMessage('isActive must be a boolean'), security_1.validateRequest, admin_users_controller_1.createUser);
// update user
router.put('/:id', (0, express_validator_1.param)('id').isUUID().withMessage('Invalid user ID'), (0, express_validator_1.body)('email').optional().trim().normalizeEmail().isEmail().withMessage('Invalid email format'), (0, express_validator_1.body)('password')
    .optional()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'), (0, express_validator_1.body)('fullName')
    .optional()
    .isString()
    .withMessage('Full name must be a string')
    .isLength({ max: 100 })
    .withMessage('Full name is too long'), (0, express_validator_1.body)('role').optional().isIn(['USER', 'RESTAURANT_OWNER', 'ADMIN']).withMessage('Invalid role'), (0, express_validator_1.body)('isActive').optional().isBoolean().withMessage('isActive must be a boolean'), security_1.validateRequest, admin_users_controller_1.updateUser);
// delete user
router.delete('/:id', (0, express_validator_1.param)('id').isUUID().withMessage('Invalid user ID'), security_1.validateRequest, admin_users_controller_1.deleteUser);
exports.default = router;
//# sourceMappingURL=admin.users.routes.js.map