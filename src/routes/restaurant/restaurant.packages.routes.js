"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const Auth_1 = require("../../middlewares/Auth");
const security_1 = require("../../middlewares/security");
const topupPackages_controller_1 = require("../../controllers/restaurant/topupPackages.controller");
const router = (0, express_1.Router)();
// get all packages (restaurant owner or admin)
router.get('/packages', Auth_1.authenticateUser, security_1.validateRequest, topupPackages_controller_1.listPackages);
// create package (owner / admin)
router.post('/packages', Auth_1.authenticateUser, (0, express_validator_1.body)('name').isString().trim().isLength({ min: 2, max: 60 }), (0, express_validator_1.body)('amount').isFloat({ gt: 0 }).withMessage('amount must be > 0'), (0, express_validator_1.body)('bonus').optional().isFloat({ min: 0 }), (0, express_validator_1.body)('currency').optional().isString().isLength({ min: 3, max: 10 }), (0, express_validator_1.body)('description').optional().isString().isLength({ max: 300 }), (0, express_validator_1.body)('isActive').optional().isBoolean(), (0, express_validator_1.body)('isPublic').optional().isBoolean(), security_1.validateRequest, topupPackages_controller_1.createPackage);
// get package by id
router.get('/packages/:id', Auth_1.authenticateUser, (0, express_validator_1.param)('id').isInt({ gt: 0 }), security_1.validateRequest, topupPackages_controller_1.getPackageById);
// update package
router.put('/packages/:id', Auth_1.authenticateUser, (0, express_validator_1.param)('id').isInt({ gt: 0 }), (0, express_validator_1.body)('name').optional().isString().trim().isLength({ min: 2, max: 60 }), (0, express_validator_1.body)('amount').optional().isFloat({ gt: 0 }), (0, express_validator_1.body)('bonus').optional().isFloat({ min: 0 }), (0, express_validator_1.body)('currency').optional().isString().isLength({ min: 3, max: 10 }), (0, express_validator_1.body)('description').optional().isString().isLength({ max: 300 }), (0, express_validator_1.body)('isActive').optional().isBoolean(), (0, express_validator_1.body)('isPublic').optional().isBoolean(), security_1.validateRequest, topupPackages_controller_1.updatePackage);
// delete package
router.delete('/packages/:id', Auth_1.authenticateUser, (0, express_validator_1.param)('id').isInt({ gt: 0 }), security_1.validateRequest, topupPackages_controller_1.deletePackage);
// topup balance
router.post('/balance/topup', Auth_1.authenticateUser, [(0, express_validator_1.body)('userQr').isString().notEmpty(), (0, express_validator_1.body)('packageId').isInt({ gt: 0 })], security_1.validateRequest, topupPackages_controller_1.topUpUserBalanceByRestaurant);
exports.default = router;
//# sourceMappingURL=restaurant.packages.routes.js.map