// routes/groupRoutes.ts
import { Router } from 'express';
import { body, param } from 'express-validator';
import {
  createGroup,
  updateGroup,
  getGroupDetails,
  getGroupMembers,
  removeRestaurantFromGroup,
  sendJoinRequest,
  respondJoinRequest,
  getMyJoinRequests,
} from '../../controllers/restaurant/group.controller';
import { authenticateUser } from '../../middlewares/Auth';
import { validateRequest } from '../../middlewares/security';
import { verifyRestaurantOwnership } from '../../middlewares/Authorization';

const router = Router();
// get all join requests
router.get('/JoinRequests', authenticateUser, verifyRestaurantOwnership, getMyJoinRequests);
// Create group
router.post(
  '/',
  authenticateUser,
  body('name').isString().trim().isLength({ min: 2, max: 100 }),
  body('description').optional().isString().isLength({ max: 500 }),
  validateRequest,
  createGroup,
);

// Update group
router.put(
  '/:groupId',
  authenticateUser,
  verifyRestaurantOwnership,
  param('groupId').isUUID(),
  body('name').optional().isString().trim().isLength({ min: 2, max: 100 }),
  body('description').optional().isString().isLength({ max: 500 }),
  validateRequest,
  updateGroup,
);

// Get group details
router.get(
  '/:groupId',
  authenticateUser,
  verifyRestaurantOwnership,
  param('groupId').isUUID(),
  validateRequest,
  getGroupDetails,
);

// Get group members
router.get(
  '/members/:groupId',
  authenticateUser,
  verifyRestaurantOwnership,
  param('groupId').isUUID(),
  validateRequest,
  getGroupMembers,
);

// Remove restaurant from group (owner only)
router.delete(
  '/remove',
  authenticateUser,
  verifyRestaurantOwnership,
  body('groupId').isUUID(),
  body('restaurantId').isUUID(),
  validateRequest,
  removeRestaurantFromGroup,
);

// Send join request (invite)
router.post(
  '/invite',
  authenticateUser,
  verifyRestaurantOwnership,
  body('groupId').isUUID(),
  body('toRestaurantId').isUUID(),
  validateRequest,
  sendJoinRequest,
);

// Respond to join request
router.put(
  '/respond/:requestId',
  authenticateUser,
  verifyRestaurantOwnership,
  param('requestId').isInt({ gt: 0 }),
  body('status').isIn(['ACCEPTED', 'REJECTED']),
  validateRequest,
  respondJoinRequest,
);

export default router;
