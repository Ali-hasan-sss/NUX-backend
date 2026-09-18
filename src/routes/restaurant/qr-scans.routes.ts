import { Router } from 'express';
import { getQRScans, getQRScanStats } from '../../controllers/restaurant/qr-scans.controller';
import {
  approveLoyaltyScanRequest,
  getPendingLoyaltyScanApprovals,
  rejectLoyaltyScanRequest,
} from '../../controllers/restaurant/loyalty-scan-approval.controller';
import { authenticateUser } from '../../middlewares/Auth';
import { verifyRestaurantOwnership } from '../../middlewares/Authorization';

const router = Router();

// Apply authentication and restaurant owner middleware to all routes
router.use(authenticateUser);
router.use(verifyRestaurantOwnership);

router.get('/pending-approvals', getPendingLoyaltyScanApprovals);
router.post('/approvals/:id/approve', approveLoyaltyScanRequest);
router.post('/approvals/:id/reject', rejectLoyaltyScanRequest);

// Get QR scans with filtering and pagination
router.get('/', getQRScans);

// Get QR scan statistics
router.get('/stats', getQRScanStats);

export default router;
