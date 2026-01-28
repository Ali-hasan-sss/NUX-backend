import { Router } from 'express';
import { param, body } from 'express-validator';
import {
  getTables,
  createTables,
  updateTable,
  deleteTable,
} from '../../controllers/restaurant/tables.controller';
import { authenticateUser } from '../../middlewares/Auth';
import { validateRequest } from '../../middlewares/security';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

// GET all tables
router.get('/', getTables);

// POST create tables (bulk creation)
router.post(
  '/',
  [
    body('count')
      .isInt({ min: 1, max: 1000 })
      .withMessage('Count must be between 1 and 1000'),
    body('name').optional().isString().withMessage('Name must be a string'),
  ],
  validateRequest,
  createTables
);

// PUT update table
router.put(
  '/:tableId',
  [
    param('tableId').isInt().withMessage('Table ID must be an integer'),
    body('name').optional().isString().withMessage('Name must be a string'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  ],
  validateRequest,
  updateTable
);

// DELETE table
router.delete(
  '/:tableId',
  [param('tableId').isInt().withMessage('Table ID must be an integer')],
  validateRequest,
  deleteTable
);

export default router;
