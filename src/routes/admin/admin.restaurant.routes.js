"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const security_1 = require("../../middlewares/security");
const admin_restaurant_controller_1 = require("../../controllers/admin/admin.restaurant.controller");
const Auth_1 = require("../../middlewares/Auth");
const Authorization_1 = require("../../middlewares/Authorization");
const router = express_1.default.Router();
router.use(Auth_1.authenticateUser);
router.use(Authorization_1.isAdminMiddleware);
// Get all restaurants
router.get('/', [
    (0, express_validator_1.query)('search').optional().isString().withMessage('search must be a string'),
    (0, express_validator_1.query)('planId').optional(),
    (0, express_validator_1.query)('subscriptionActive')
        .optional()
        .isBoolean()
        .withMessage('subscriptionActive must be true or false'),
    (0, express_validator_1.query)('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
    (0, express_validator_1.query)('pageSize')
        .optional()
        .isInt({ min: 1 })
        .withMessage('pageSize must be a positive integer'),
], security_1.validateRequest, admin_restaurant_controller_1.getAllRestaurants);
// Get restaurant by ID
router.get('/:id', (0, express_validator_1.param)('id').isUUID().withMessage('Invalid restaurant ID'), security_1.validateRequest, admin_restaurant_controller_1.getRestaurantById);
// Create a new restaurant
router.post('/', (0, express_validator_1.body)('userId').isUUID().withMessage('Invalid owner user ID'), (0, express_validator_1.body)('name')
    .isString()
    .withMessage('Name must be a string')
    .notEmpty()
    .withMessage('Name is required'), (0, express_validator_1.body)('address')
    .isString()
    .withMessage('Address must be a string')
    .notEmpty()
    .withMessage('Address is required'), (0, express_validator_1.body)('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be a valid number between -90 and 90'), (0, express_validator_1.body)('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be a valid number between -180 and 180'), (0, express_validator_1.body)('planId').optional().isInt().withMessage('Invalid planId'), (0, express_validator_1.body)('subscriptionActive')
    .optional()
    .isBoolean()
    .withMessage('subscriptionActive must be a boolean'), (0, express_validator_1.body)('isGroupMember').optional().isBoolean().withMessage('isGroupMember must be a boolean'), security_1.validateRequest, admin_restaurant_controller_1.createRestaurant);
// Update restaurant
router.put('/:id', (0, express_validator_1.param)('id').isUUID().withMessage('Invalid restaurant ID'), (0, express_validator_1.body)('userId').optional().isUUID().withMessage('Invalid owner user ID'), (0, express_validator_1.body)('name').optional().isString().withMessage('Name must be a string'), (0, express_validator_1.body)('address').optional().isString().withMessage('Address must be a string'), (0, express_validator_1.body)('latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be a valid number between -90 and 90'), (0, express_validator_1.body)('longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be a valid number between -180 and 180'), (0, express_validator_1.body)('planId').optional().isInt().withMessage('Invalid planId'), (0, express_validator_1.body)('subscriptionActive')
    .optional()
    .isBoolean()
    .withMessage('subscriptionActive must be a boolean'), (0, express_validator_1.body)('isGroupMember').optional().isBoolean().withMessage('isGroupMember must be a boolean'), security_1.validateRequest, admin_restaurant_controller_1.updateRestaurant);
// Delete restaurant
router.delete('/:id', (0, express_validator_1.param)('id').isUUID().withMessage('Invalid restaurant ID'), security_1.validateRequest, admin_restaurant_controller_1.deleteRestaurant);
exports.default = router;
//# sourceMappingURL=admin.restaurant.routes.js.map