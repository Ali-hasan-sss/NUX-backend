import { Router } from 'express';
import { submitContact, contactValidation } from '../../controllers/common/contact.controller';
import { generalRateLimiter, validateRequest, xssSanitizerMiddleware } from '../../middlewares/security';

const router = Router();

router.post(
  '/',
  xssSanitizerMiddleware,
  generalRateLimiter,
  contactValidation,
  validateRequest,
  submitContact
);

export default router;
