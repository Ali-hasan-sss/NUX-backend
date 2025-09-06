import { Router } from 'express';
import { param } from 'express-validator';
import {
  getCategoriesByQRCode,
  getItemsByCategoryForCustomer,
} from '../../controllers/client/menuClient.controller';
import { authenticateUser } from '../../middlewares/Auth';
import { validateRequest } from '../../middlewares/security';

const router = Router();

// GET categories by QR code
router.get(
  '/:qrCode',
  authenticateUser,
  param('qrCode').isUUID().withMessage('Invalid QR code'),
  validateRequest,
  getCategoriesByQRCode,
);

// GET items by category
router.get(
  '/items/:categoryId',
  authenticateUser,
  param('categoryId').isInt(),
  validateRequest,
  getItemsByCategoryForCustomer,
);

export default router;
