import { Router } from 'express';
import {
  listSubAdmins,
  createSubAdmin,
  updateSubAdmin,
  deleteSubAdmin,
  getMyPermissions,
} from '../../controllers/admin/admin.subadmins.controller';
import { body, param } from 'express-validator';
import { validateRequest } from '../../middlewares/security';
import { authenticateUser } from '../../middlewares/Auth';
import { isAdminOrSubAdmin, requireMainAdmin } from '../../middlewares/adminPermissions';

const PERMISSIONS = ['MANAGE_USERS', 'MANAGE_PLANS', 'MANAGE_RESTAURANTS', 'MANAGE_SUBSCRIPTIONS'];

const router = Router();

// Current user's permissions (admin or sub-admin) — for sidebar
router.get(
  '/my-permissions',
  authenticateUser,
  isAdminOrSubAdmin,
  getMyPermissions,
);

// All routes below: main admin only
router.use(authenticateUser);
router.use(requireMainAdmin);

router.get('/', listSubAdmins);

router.post(
  '/',
  [
    body('email').trim().normalizeEmail().isEmail().withMessage('Invalid email format'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/[0-9]/)
      .withMessage('Password must contain a number')
      .matches(/[A-Z]/)
      .withMessage('Password must contain an uppercase letter'),
    body('fullName')
      .optional()
      .isString()
      .isLength({ max: 100 })
      .withMessage('Full name is too long'),
    body('permissions')
      .isArray()
      .withMessage('permissions must be an array')
      .custom((val) => val.every((p: string) => PERMISSIONS.includes(p)))
      .withMessage('Invalid permission value'),
  ],
  validateRequest,
  createSubAdmin,
);

router.put(
  '/:id',
  [
    param('id').isUUID().withMessage('Invalid sub-admin ID'),
    body('permissions')
      .isArray()
      .withMessage('permissions must be an array')
      .custom((val) => val.every((p: string) => PERMISSIONS.includes(p)))
      .withMessage('Invalid permission value'),
  ],
  validateRequest,
  updateSubAdmin,
);

router.delete(
  '/:id',
  param('id').isUUID().withMessage('Invalid sub-admin ID'),
  validateRequest,
  deleteSubAdmin,
);

export default router;
