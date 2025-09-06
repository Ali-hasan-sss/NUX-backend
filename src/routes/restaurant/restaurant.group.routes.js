"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// routes/groupRoutes.ts
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const group_controller_1 = require("../../controllers/restaurant/group.controller");
const Auth_1 = require("../../middlewares/Auth");
const security_1 = require("../../middlewares/security");
const Authorization_1 = require("../../middlewares/Authorization");
const router = (0, express_1.Router)();
// get all join requests
router.get('/JoinRequests', Auth_1.authenticateUser, Authorization_1.verifyRestaurantOwnership, group_controller_1.getMyJoinRequests);
// Create group
router.post('/', Auth_1.authenticateUser, (0, express_validator_1.body)('name').isString().trim().isLength({ min: 2, max: 100 }), (0, express_validator_1.body)('description').optional().isString().isLength({ max: 500 }), security_1.validateRequest, group_controller_1.createGroup);
// Update group
router.put('/:groupId', Auth_1.authenticateUser, Authorization_1.verifyRestaurantOwnership, (0, express_validator_1.param)('groupId').isUUID(), (0, express_validator_1.body)('name').optional().isString().trim().isLength({ min: 2, max: 100 }), (0, express_validator_1.body)('description').optional().isString().isLength({ max: 500 }), security_1.validateRequest, group_controller_1.updateGroup);
// Get group details
router.get('/:groupId', Auth_1.authenticateUser, Authorization_1.verifyRestaurantOwnership, (0, express_validator_1.param)('groupId').isUUID(), security_1.validateRequest, group_controller_1.getGroupDetails);
// Get group members
router.get('/members/:groupId', Auth_1.authenticateUser, Authorization_1.verifyRestaurantOwnership, (0, express_validator_1.param)('groupId').isUUID(), security_1.validateRequest, group_controller_1.getGroupMembers);
// Remove restaurant from group (owner only)
router.delete('/remove', Auth_1.authenticateUser, Authorization_1.verifyRestaurantOwnership, (0, express_validator_1.body)('groupId').isUUID(), (0, express_validator_1.body)('restaurantId').isUUID(), security_1.validateRequest, group_controller_1.removeRestaurantFromGroup);
// Send join request (invite)
router.post('/invite', Auth_1.authenticateUser, Authorization_1.verifyRestaurantOwnership, (0, express_validator_1.body)('groupId').isUUID(), (0, express_validator_1.body)('toRestaurantId').isUUID(), security_1.validateRequest, group_controller_1.sendJoinRequest);
// Respond to join request
router.put('/respond/:requestId', Auth_1.authenticateUser, Authorization_1.verifyRestaurantOwnership, (0, express_validator_1.param)('requestId').isInt({ gt: 0 }), (0, express_validator_1.body)('status').isIn(['ACCEPTED', 'REJECTED']), security_1.validateRequest, group_controller_1.respondJoinRequest);
exports.default = router;
//# sourceMappingURL=restaurant.group.routes.js.map