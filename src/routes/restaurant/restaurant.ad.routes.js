"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const ad_controller_1 = require("../../controllers/restaurant/ad.controller");
const Auth_1 = require("../../middlewares/Auth");
const security_1 = require("../../middlewares/security");
const Authorization_1 = require("../../middlewares/Authorization");
const router = (0, express_1.Router)();
/**
 * @route POST /ads
 * @desc Create a new ad (restaurant only)
 */
router.post('/', Auth_1.authenticateUser, Authorization_1.verifyRestaurantOwnership, (0, express_validator_1.body)('title').isString().trim().isLength({ min: 2, max: 100 }), (0, express_validator_1.body)('description').optional().isString().isLength({ max: 500 }), (0, express_validator_1.body)('image').isString().trim(), (0, express_validator_1.body)('category').optional().isString().trim(), security_1.validateRequest, ad_controller_1.createAd);
/**
 * @route PUT /ads/:id
 * @desc Update an existing ad (restaurant only)
 */
router.put('/:id', Auth_1.authenticateUser, Authorization_1.verifyRestaurantOwnership, (0, express_validator_1.param)('id').isString(), (0, express_validator_1.body)('title').optional().isString().trim(), (0, express_validator_1.body)('description').optional().isString().trim(), (0, express_validator_1.body)('image').optional().isString().trim(), (0, express_validator_1.body)('category').optional().isString().trim(), security_1.validateRequest, ad_controller_1.updateAd);
/**
 * @route DELETE /ads/:id
 * @desc Delete an ad (restaurant only)
 */
router.delete('/:id', Auth_1.authenticateUser, Authorization_1.verifyRestaurantOwnership, (0, express_validator_1.param)('id').isString(), security_1.validateRequest, ad_controller_1.deleteAd);
/**
 * @route GET /ads/my
 * @desc Get all restaurant's ads
 */
router.get('/my', Auth_1.authenticateUser, Authorization_1.verifyRestaurantOwnership, ad_controller_1.getAdsForRestaurant);
exports.default = router;
//# sourceMappingURL=restaurant.ad.routes.js.map