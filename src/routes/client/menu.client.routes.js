"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const menuClient_controller_1 = require("../../controllers/client/menuClient.controller");
const Auth_1 = require("../../middlewares/Auth");
const security_1 = require("../../middlewares/security");
const router = (0, express_1.Router)();
// GET categories by QR code
router.get('/:qrCode', Auth_1.authenticateUser, (0, express_validator_1.param)('qrCode').isUUID().withMessage('Invalid QR code'), security_1.validateRequest, menuClient_controller_1.getCategoriesByQRCode);
// GET items by category
router.get('/items/:categoryId', Auth_1.authenticateUser, (0, express_validator_1.param)('categoryId').isInt(), security_1.validateRequest, menuClient_controller_1.getItemsByCategoryForCustomer);
exports.default = router;
//# sourceMappingURL=menu.client.routes.js.map