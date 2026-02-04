import express from 'express';
import { body } from 'express-validator';
import { validateRequest } from '../../middlewares/security';
import { sendAdminNotification } from '../../controllers/admin/admin.notifications.controller';
import { authenticateUser } from '../../middlewares/Auth';
import { isAdminOrSubAdmin } from '../../middlewares/adminPermissions';

const router = express.Router();

router.use(authenticateUser);
router.use(isAdminOrSubAdmin);

router.post(
  '/send',
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('body').notEmpty().withMessage('Body is required'),
    body('audience')
      .isIn(['all', 'restaurant_owners', 'subadmins'])
      .withMessage('Audience must be all, restaurant_owners, or subadmins'),
  ],
  validateRequest,
  sendAdminNotification,
);

export default router;
