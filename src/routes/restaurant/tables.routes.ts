import { Router, Request, Response, NextFunction } from 'express';
import { param, body } from 'express-validator';
import {
  getTables,
  createTables,
  updateTable,
  deleteTable,
} from '../../controllers/restaurant/tables.controller';
import { authenticateUser } from '../../middlewares/Auth';
import { validateRequest } from '../../middlewares/security';
import { verifyRestaurantOwnership } from '../../middlewares/Authorization';
import {
  canManageQRCodes,
  canManageOrders,
  canManageOrdersOrQRCodes,
} from '../../middlewares/permissions';

const router = Router();

router.use(authenticateUser);
router.use(verifyRestaurantOwnership);

router.get('/', canManageOrdersOrQRCodes, getTables);

router.post(
  '/',
  canManageQRCodes,
  [
    body('count').isInt({ min: 1, max: 1000 }).withMessage('Count must be between 1 and 1000'),
    body('name').optional().isString().withMessage('Name must be a string'),
  ],
  validateRequest,
  createTables,
);

router.put(
  '/:tableId',
  (req: Request, res: Response, next: NextFunction) => {
    if (req.body?.isSessionOpen !== undefined) {
      return canManageOrders(req, res, next);
    }
    return canManageQRCodes(req, res, next);
  },
  [
    param('tableId').isInt().withMessage('Table ID must be an integer'),
    body('name').optional().isString().withMessage('Name must be a string'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
    body('isSessionOpen').optional().isBoolean().withMessage('isSessionOpen must be a boolean'),
  ],
  validateRequest,
  updateTable,
);

router.delete(
  '/:tableId',
  canManageQRCodes,
  [param('tableId').isInt().withMessage('Table ID must be an integer')],
  validateRequest,
  deleteTable,
);

export default router;
