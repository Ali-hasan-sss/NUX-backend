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
import { canManageGroups } from '../../middlewares/permissions';

const router = Router();

router.use(authenticateUser);
router.use(verifyRestaurantOwnership);
router.use(canManageGroups);

// get all join requests
router.get('/JoinRequests', getMyJoinRequests);
// Create group
router.post(
  '/',
  body('name').isString().trim().isLength({ min: 2, max: 100 }),
  body('description').optional().isString().isLength({ max: 500 }),
  validateRequest,
  createGroup,
);

// Update group
router.put(
  '/:groupId',
  param('groupId').isUUID(),
  body('name').optional().isString().trim().isLength({ min: 2, max: 100 }),
  body('description').optional().isString().isLength({ max: 500 }),
  validateRequest,
  updateGroup,
);

// Get group details
router.get(
  '/:groupId',
  param('groupId').isUUID(),
  validateRequest,
  getGroupDetails,
);

// Get group members
router.get(
  '/members/:groupId',
  param('groupId').isUUID(),
  validateRequest,
  getGroupMembers,
);

// Remove restaurant from group (owner only)
router.delete(
  '/remove',
  body('groupId').isUUID(),
  body('restaurantId').isUUID(),
  validateRequest,
  removeRestaurantFromGroup,
);

// Send join request (invite)
router.post(
  '/invite',
  body('groupId').isUUID(),
  body('toRestaurantId').isUUID(),
  validateRequest,
  sendJoinRequest,
);

// Respond to join request
router.put(
  '/respond/:requestId',
  param('requestId').isInt({ gt: 0 }),
  body('status').isIn(['ACCEPTED', 'REJECTED']),
  validateRequest,
  respondJoinRequest,
);

export default router;
