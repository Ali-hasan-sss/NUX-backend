import { Router } from 'express';
import {
  getAllPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
} from '../../controllers/admin/admin.plans.controller';

import { body, param } from 'express-validator';
import { validateRequest } from '../../middlewares/security';
import { isAdminMiddleware } from '../../middlewares/Authorization';
import { authenticateUser } from '../../middlewares/Auth';

const router = Router();
router.use(authenticateUser);
router.use(isAdminMiddleware);

//  Get all plans
router.get('/', getAllPlans);

//  Get plan by id
router.get(
  '/:id',
  param('id').isInt({ gt: 0 }).withMessage('Invalid plan ID'),
  validateRequest,
  getPlanById,
);

//  Create new plan
router.post(
  '/',
  body('title')
    .isString()
    .withMessage('Plan title is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Plan title is mast be 2-50 char'),
  body('description')
    .optional()
    .isString()
    .withMessage('description must be a string')
    .isLength({ min: 2, max: 10000 })
    .withMessage('description must be between 2 and 100 characters'),
  body('price').isFloat({ gt: 0 }).withMessage('Price must be greater than 0'),
  body('currency')
    .isString()
    .withMessage('Plan currency is required')
    .isLength({ min: 1, max: 50 })
    .withMessage('Plan currency is mast be 1-50 char'),
  body('duration').isInt({ gt: 0 }).withMessage('Duration must be a positive integer (days)'),
  validateRequest,
  createPlan,
);

//  Update plan
router.put(
  '/:id',
  param('id').isInt({ gt: 0 }).withMessage('Invalid plan ID'),
  body('name')
    .optional()
    .isString()
    .withMessage('Plan name must be a string')
    .isLength({ min: 2, max: 50 })
    .withMessage('Plan title is mast be 2-50 char'),
  body('description')
    .optional()
    .isString()
    .withMessage('description must be a string')
    .isLength({ min: 2, max: 10000 })
    .withMessage('description must be between 2 and 100 characters'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be 0 or greater'),
  body('isActive').optional().isBoolean().withMessage('isActive must be boolean value'),
  body('currency')
    .optional({ nullable: true }) // allow empty for free plan
    .isLength({ min: 1, max: 50 })
    .withMessage('Plan currency must be 1-50 char'),
  body('duration')
    .optional()
    .isInt({ gt: 0 })
    .withMessage('Duration must be a positive integer (days)'),
  validateRequest,
  updatePlan,
);

// Delete plan
router.delete(
  '/:id',
  param('id').isInt({ gt: 0 }).withMessage('Invalid plan ID'),
  validateRequest,
  deletePlan,
);

export default router;
