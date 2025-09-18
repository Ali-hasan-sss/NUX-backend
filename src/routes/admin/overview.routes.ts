import { Router } from 'express';
import { getAdminOverview } from '../../controllers/admin/admin.overview.controller';
import { isAdminMiddleware } from '../../middlewares/Authorization';
import { authenticateUser } from '../../middlewares/Auth';

const router = Router();

// Apply admin middleware to all routes
router.use(authenticateUser);
router.use(isAdminMiddleware);

// Get admin dashboard overview
router.get('/', getAdminOverview);

export default router;
