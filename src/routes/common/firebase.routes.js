"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const security_1 = require("../../middlewares/security");
const firebace_controller_1 = require("../../controllers/common/firebace.controller");
const Auth_1 = require("../../middlewares/Auth");
const router = (0, express_1.Router)();
router.post('/updateFirebaseToken', Auth_1.authenticateUser, security_1.validateRequest, security_1.xssSanitizerMiddleware, (0, express_validator_1.body)('firebaseToken').isString().notEmpty().withMessage('Firebase token is required'), firebace_controller_1.updateFirebaseToken);
exports.default = router;
//# sourceMappingURL=firebase.routes.js.map