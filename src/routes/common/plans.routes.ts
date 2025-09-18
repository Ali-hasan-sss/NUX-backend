import { Router } from 'express';
import { getAllPlans, getPlanById } from '../../controllers/common/plans.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Plans
 *   description: Public plans management
 */

// GET /api/plans - Get all available plans
router.get('/', getAllPlans);

// GET /api/plans/:id - Get specific plan by ID
router.get('/:id', getPlanById);

export default router;
