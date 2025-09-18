import { Router } from 'express';
import {
  getAllInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  markInvoiceAsPaid,
  getInvoiceStatistics,
} from '../../controllers/admin/admin.invoices.controller';
import { isAdminMiddleware } from '../../middlewares/Authorization';
import { authenticateUser } from '../../middlewares/Auth';

const router = Router();
router.use(authenticateUser);
router.use(isAdminMiddleware);

router.get('/', getAllInvoices);

router.get('/statistics', getInvoiceStatistics);

router.get('/:id', getInvoiceById);

router.post('/', createInvoice);

router.put('/:id', updateInvoice);

router.delete('/:id', deleteInvoice);

router.patch('/:id/mark-paid', markInvoiceAsPaid);

export default router;
