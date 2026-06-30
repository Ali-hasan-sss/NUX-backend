import express from 'express';
import { body, param, query } from 'express-validator';
import { validateRequest } from '../../middlewares/security';
import { authenticateUser } from '../../middlewares/Auth';
import { isAdminOrSubAdmin, requirePermission } from '../../middlewares/adminPermissions';
import {
  activateSubscription,
  cancelSubscription,
  getAllSubscriptions,
  listRefundablePayments,
  refundSubscriptionPayment,
} from '../../controllers/admin/admin.subscriptions.controller';

const router = express.Router();

router.use(authenticateUser);
router.use(isAdminOrSubAdmin);
router.use(requirePermission('MANAGE_SUBSCRIPTIONS'));

// Get all subscriptions
router.get(
  '/',
  [
    query('search').optional().isString().withMessage('Search must be a string'),
    query('planId').optional().isNumeric().withMessage('Plan ID must be a number'),
    query('status').optional().isString().withMessage('Status must be a string'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('pageSize')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page size must be a positive integer'),
  ],
  validateRequest,
  getAllSubscriptions,
);

router.put(
  '/cancel/:id',
  [
    param('id').isInt({ min: 1 }).withMessage('Subscription ID must be a positive integer'),
    body('reason').notEmpty().withMessage('Cancellation reason is required'),
  ],
  validateRequest,
  cancelSubscription,
);

router.post(
  '/activate',
  body('planId').isInt().withMessage('planId ID must be a positive integer'),
  body('restaurantId').notEmpty().isUUID().withMessage('Cancellation reason is required'),
  validateRequest,
  activateSubscription,
);

router.get(
  '/refundable/:id',
  [param('id').isInt({ min: 1 }).withMessage('Subscription ID must be a positive integer')],
  validateRequest,
  listRefundablePayments,
);

router.post(
  '/refund/:id',
  [
    param('id').isInt({ min: 1 }).withMessage('Subscription ID must be a positive integer'),
    body('reason').optional().isString(),
    body('apologyMessage').optional().isString().isLength({ max: 2000 }),
    body('stripeInvoiceId').optional().isString(),
    body('amount').optional().isFloat({ gt: 0 }),
  ],
  validateRequest,
  refundSubscriptionPayment,
);

export default router;
