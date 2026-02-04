import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticateUser } from '../../middlewares/Auth';
import { validateRequest } from '../../middlewares/security';
import { verifyRestaurantOwnership } from '../../middlewares/Authorization';
import { canManagePackages } from '../../middlewares/permissions';
import {
  createPackage,
  listPackages,
  getPackageById,
  updatePackage,
  deletePackage,
  topUpUserBalanceByRestaurant,
} from '../../controllers/restaurant/topupPackages.controller';

const router = Router();

router.use(authenticateUser);
router.use(verifyRestaurantOwnership);
router.use(canManagePackages);

// get all packages (restaurant owner or admin)
router.get('/packages', validateRequest, listPackages);

// create package (owner / admin)
router.post(
  '/packages',
  body('name').isString().trim().isLength({ min: 2, max: 60 }),
  body('amount').isFloat({ gt: 0 }).withMessage('amount must be > 0'),
  body('bonus').optional().isFloat({ min: 0 }),
  body('currency').optional().isString().isLength({ min: 3, max: 10 }),
  body('description').optional().isString().isLength({ max: 300 }),
  body('isActive').optional().isBoolean(),
  body('isPublic').optional().isBoolean(),
  validateRequest,
  createPackage,
);

// get package by id
router.get(
  '/packages/:id',
  param('id').isInt({ gt: 0 }),
  validateRequest,
  getPackageById,
);

// update package
router.put(
  '/packages/:id',
  param('id').isInt({ gt: 0 }),
  body('name').optional().isString().trim().isLength({ min: 2, max: 60 }),
  body('amount').optional().isFloat({ gt: 0 }),
  body('bonus').optional().isFloat({ min: 0 }),
  body('currency').optional().isString().isLength({ min: 3, max: 10 }),
  body('description').optional().isString().isLength({ max: 300 }),
  body('isActive').optional().isBoolean(),
  body('isPublic').optional().isBoolean(),
  validateRequest,
  updatePackage,
);

// delete package
router.delete(
  '/packages/:id',
  param('id').isInt({ gt: 0 }),
  validateRequest,
  deletePackage,
);

// topup balance
router.post(
  '/balance/topup',
  [body('userQr').isString().notEmpty(), body('packageId').isInt({ gt: 0 })],
  validateRequest,
  topUpUserBalanceByRestaurant,
);

export default router;
