import { Router } from 'express';
import { authenticateUser } from '../../middlewares/Auth';
import { isAdminMiddleware } from '../../middlewares/Authorization';
import {
  getAdminLegalDocuments,
  updateAdminLegalDocuments,
} from '../../controllers/legal/legal.controller';

const router = Router();

router.use(authenticateUser);
router.use(isAdminMiddleware);

router.get('/', getAdminLegalDocuments);
router.put('/', updateAdminLegalDocuments);

export default router;
