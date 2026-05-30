import { Router } from 'express';
import { getPublicLegalDocument } from '../../controllers/legal/legal.controller';

const router = Router();

router.get('/:type', getPublicLegalDocument);

export default router;
