"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const Auth_1 = require("../../middlewares/Auth");
const balances_controller_1 = require("../../controllers/client/balances.controller");
const security_1 = require("../../middlewares/security");
const router = (0, express_1.Router)();
// GET user balances with restaurants
router.get('/with-restaurants', Auth_1.authenticateUser, balances_controller_1.getUserRestaurantsWithBalance);
// POST scan QR
router.post('/scan-qr', Auth_1.authenticateUser, (0, express_validator_1.body)('qrCode').isString().notEmpty().withMessage('QR code is required'), (0, express_validator_1.body)('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be a valid number between -90 and 90'), (0, express_validator_1.body)('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be a valid number between -180 and 180'), security_1.validateRequest, balances_controller_1.scanQrCode);
// post pay with stars or balance
router.post('/pay', Auth_1.authenticateUser, (0, express_validator_1.body)('targetId').isUUID().withMessage('targetId must be a valid UUID'), (0, express_validator_1.body)('currencyType')
    .isIn(['balance', 'stars_meal', 'stars_drink'])
    .withMessage('currencyType must be either BALANCE or STARS'), (0, express_validator_1.body)('amount').isFloat({ gt: 0 }).withMessage('amount must be greater than 0'), security_1.validateRequest, balances_controller_1.payAtRestaurant);
// post gift with stars or balance to frind
router.post('/gift', Auth_1.authenticateUser, (0, express_validator_1.body)('targetId').isString().notEmpty().withMessage('targetId is required'), (0, express_validator_1.body)('qrCode').isString().notEmpty().withMessage('QR code is required'), (0, express_validator_1.body)('currencyType')
    .isIn(['balance', 'stars_meal', 'stars_drink'])
    .withMessage('currencyType must be either BALANCE or STARS'), (0, express_validator_1.body)('amount').isFloat({ gt: 0 }).withMessage('amount must be greater than 0'), security_1.validateRequest, balances_controller_1.giftBalance);
router.get('/packages/:restaurantId', Auth_1.authenticateUser, security_1.validateRequest, balances_controller_1.listPublicPackages);
exports.default = router;
//# sourceMappingURL=balances.route.js.map