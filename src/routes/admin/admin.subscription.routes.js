"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const security_1 = require("../../middlewares/security");
const Auth_1 = require("../../middlewares/Auth");
const Authorization_1 = require("../../middlewares/Authorization");
const admin_subscriptions_controller_1 = require("../../controllers/admin/admin.subscriptions.controller");
const router = express_1.default.Router();
router.use(Auth_1.authenticateUser);
router.use(Authorization_1.isAdminMiddleware);
// Get all subscriptions
router.get('/', [
    (0, express_validator_1.query)('search').optional().isString().withMessage('Search must be a string'),
    (0, express_validator_1.query)('planId').optional().isNumeric().withMessage('Plan ID must be a number'),
    (0, express_validator_1.query)('status').optional().isString().withMessage('Status must be a string'),
    (0, express_validator_1.query)('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    (0, express_validator_1.query)('pageSize')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page size must be a positive integer'),
], security_1.validateRequest, admin_subscriptions_controller_1.getAllSubscriptions);
router.put('/cancel/:id', [
    (0, express_validator_1.param)('id').isInt({ min: 1 }).withMessage('Subscription ID must be a positive integer'),
    (0, express_validator_1.body)('reason').notEmpty().withMessage('Cancellation reason is required'),
], security_1.validateRequest, admin_subscriptions_controller_1.cancelSubscription);
router.post('/activate', (0, express_validator_1.body)('planId').isInt().withMessage('planId ID must be a positive integer'), (0, express_validator_1.body)('restaurantId').notEmpty().isUUID().withMessage('Cancellation reason is required'), security_1.validateRequest, admin_subscriptions_controller_1.activateSubscription);
exports.default = router;
//# sourceMappingURL=admin.subscription.routes.js.map