import { Router } from 'express';
import { authenticateUser } from '../../middlewares/Auth';
import {
  getAllNotifications,
  getUnreadCount,
  markAllAsRead,
  markNotification,
} from '../../controllers/common/notifications.controller';

const router = Router();

router.get('/', authenticateUser, getAllNotifications);
router.put('/read/:id', authenticateUser, markNotification);
router.put('/read-all', authenticateUser, markAllAsRead);
router.get('/count', authenticateUser, getUnreadCount);

export default router;
