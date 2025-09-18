import { Router } from 'express';
import { authenticateUser } from '../../middlewares/Auth';
import { validateRequest } from '../../middlewares/security';
import {
  getRestaurantInvoices,
  getInvoiceById,
} from '../../controllers/restaurant/invoices.controller';

const router = Router();

// Get restaurant invoices
router.get('/', authenticateUser, getRestaurantInvoices);

// Get invoice by ID
router.get('/:id', authenticateUser, getInvoiceById);

export default router;
