import { Router } from 'express';
import { param } from 'express-validator';
import {
  getCategoriesByQRCode,
  getItemsByCategoryForCustomer,
} from '../../controllers/client/menuClient.controller';
import { validateRequest } from '../../middlewares/security';

const router = Router();

// GET categories by QR code (public - no authentication required)
router.get(
  '/:qrCode',
  param('qrCode').isUUID().withMessage('Invalid QR code'),
  validateRequest,
  getCategoriesByQRCode,
);

// GET items by category (public - no authentication required)
router.get(
  '/items/:categoryId',
  param('categoryId').isInt(),
  validateRequest,
  getItemsByCategoryForCustomer,
);

export default router;
