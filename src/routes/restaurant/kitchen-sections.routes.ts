// src/routes/restaurant/kitchen-sections.routes.ts
import { Router } from 'express';
import { body, param } from 'express-validator';
import {
  getKitchenSections,
  createKitchenSection,
  updateKitchenSection,
  deleteKitchenSection,
} from '../../controllers/restaurant/kitchen-sections.controller';
import { validateRequest } from '../../middlewares/security';
import { authenticateUser } from '../../middlewares/Auth';

const router = Router();

// Get all kitchen sections for the restaurant
router.get('/', authenticateUser, getKitchenSections);

// Create a new kitchen section
router.post(
  '/',
  authenticateUser,
  body('name').isString().trim().notEmpty().withMessage('Name is required'),
  body('description').optional().isString(),
  validateRequest,
  createKitchenSection,
);

// Update a kitchen section
router.put(
  '/:sectionId',
  authenticateUser,
  param('sectionId').isInt({ gt: 0 }).withMessage('Invalid section ID'),
  body('name').optional().isString().trim().notEmpty(),
  body('description').optional().isString(),
  validateRequest,
  updateKitchenSection,
);

// Delete a kitchen section
router.delete(
  '/:sectionId',
  authenticateUser,
  param('sectionId').isInt({ gt: 0 }).withMessage('Invalid section ID'),
  validateRequest,
  deleteKitchenSection,
);

export default router;
