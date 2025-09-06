"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const security_1 = require("../../middlewares/security");
const Auth_1 = require("../../middlewares/Auth");
const restaurant_info_controller_1 = require("../../controllers/restaurant/restaurant.info.controller");
const Authorization_1 = require("../../middlewares/Authorization");
const router = express_1.default.Router();
router.put('/update', Auth_1.authenticateUser, Authorization_1.verifyRestaurantOwnership, (0, express_validator_1.body)('name').optional().isString().withMessage('Name must be a string'), (0, express_validator_1.body)('logo').optional().isURL().withMessage('Logo must be a valid URL'), (0, express_validator_1.body)('address').optional().isString().withMessage('Address must be a string'), (0, express_validator_1.body)('latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be a valid number between -90 and 90'), (0, express_validator_1.body)('longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be a valid number between -180 and 180'), security_1.validateRequest, restaurant_info_controller_1.updateRestaurantByOwner);
exports.default = router;
//# sourceMappingURL=restaurant.account.routes.js.map