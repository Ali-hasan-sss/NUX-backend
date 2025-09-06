"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const admin_plans_controller_1 = require("../../controllers/admin/admin.plans.controller");
const express_validator_1 = require("express-validator");
const security_1 = require("../../middlewares/security");
const Authorization_1 = require("../../middlewares/Authorization");
const Auth_1 = require("../../middlewares/Auth");
const router = (0, express_1.Router)();
router.use(Auth_1.authenticateUser);
router.use(Authorization_1.isAdminMiddleware);
//  Get all plans
router.get('/', admin_plans_controller_1.getAllPlans);
//  Get plan by id
router.get('/:id', (0, express_validator_1.param)('id').isInt({ gt: 0 }).withMessage('Invalid plan ID'), security_1.validateRequest, admin_plans_controller_1.getPlanById);
//  Create new plan
router.post('/', (0, express_validator_1.body)('title')
    .isString()
    .withMessage('Plan title is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Plan title is mast be 2-50 char'), (0, express_validator_1.body)('description')
    .optional()
    .isString()
    .withMessage('description must be a string')
    .isLength({ min: 2, max: 10000 })
    .withMessage('description must be between 2 and 100 characters'), (0, express_validator_1.body)('price').isFloat({ gt: 0 }).withMessage('Price must be greater than 0'), (0, express_validator_1.body)('currency')
    .isString()
    .withMessage('Plan currency is required')
    .isLength({ min: 1, max: 50 })
    .withMessage('Plan currency is mast be 1-50 char'), (0, express_validator_1.body)('duration').isInt({ gt: 0 }).withMessage('Duration must be a positive integer (days)'), security_1.validateRequest, admin_plans_controller_1.createPlan);
//  Update plan
router.put('/:id', (0, express_validator_1.param)('id').isInt({ gt: 0 }).withMessage('Invalid plan ID'), (0, express_validator_1.body)('name')
    .optional()
    .isString()
    .withMessage('Plan name must be a string')
    .isLength({ min: 2, max: 50 })
    .withMessage('Plan title is mast be 2-50 char'), (0, express_validator_1.body)('description')
    .optional()
    .isString()
    .withMessage('description must be a string')
    .isLength({ min: 2, max: 10000 })
    .withMessage('description must be between 2 and 100 characters'), (0, express_validator_1.body)('price').isFloat({ min: 0 }).withMessage('Price must be 0 or greater'), (0, express_validator_1.body)('isActive').optional().isBoolean().withMessage('isActive must be boolean value'), (0, express_validator_1.body)('currency')
    .optional({ nullable: true }) // allow empty for free plan
    .isLength({ min: 1, max: 50 })
    .withMessage('Plan currency must be 1-50 char'), (0, express_validator_1.body)('duration')
    .optional()
    .isInt({ gt: 0 })
    .withMessage('Duration must be a positive integer (days)'), security_1.validateRequest, admin_plans_controller_1.updatePlan);
// Delete plan
router.delete('/:id', (0, express_validator_1.param)('id').isInt({ gt: 0 }).withMessage('Invalid plan ID'), security_1.validateRequest, admin_plans_controller_1.deletePlan);
exports.default = router;
//# sourceMappingURL=admin.plans.routes.js.map