import { Router } from 'express';

import { body } from 'express-validator';
import { validateRequest, xssSanitizerMiddleware } from '../../middlewares/security';
import { updateFirebaseToken } from '../../controllers/common/firebace.controller';
import { authenticateUser } from '../../middlewares/Auth';
const router = Router();

router.post(
  '/updateFirebaseToken',
  authenticateUser,
  validateRequest,
  xssSanitizerMiddleware,
  body('firebaseToken').isString().notEmpty().withMessage('Firebase token is required'),
  updateFirebaseToken,
);
export default router;
