import { Router } from 'express';
import { authenticateUser } from '../../middlewares/Auth';
import { getAdsForAll } from '../../controllers/common/ads.client.controller';
const router = Router();

router.get('/', authenticateUser, getAdsForAll);

export default router;
