// src/routes/menu.routes.ts
import { Router } from 'express';
import { body, param } from 'express-validator';
import {
  getMenu,
  createCategory,
  updateCategory,
  deleteCategory,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  getMenuItemsByCategory,
} from '../../controllers/restaurant/menu.controller';
import { seedMenuData } from '../../controllers/restaurant/seed.controller';
import { validateRequest } from '../../middlewares/security';
import { authenticateUser } from '../../middlewares/Auth';

const router = Router();

// get menu for restaurant
router.get('/', authenticateUser, getMenu);

router.post(
  '/categories',
  authenticateUser,
  body('title').isString().notEmpty(),
  body('description').optional().isString(),
  body('image').optional().isString().isURL().withMessage(' inviled image url'),
  validateRequest,
  createCategory,
);

router.put(
  '/categories/:categoryId',
  authenticateUser,
  body('title').optional().isString(),
  body('description').optional().isString(),
  body('image').optional().isString().isURL().withMessage(' inviled image url'),
  validateRequest,
  updateCategory,
);

router.delete(
  '/categories/:categoryId',
  authenticateUser,
  param('categoryId').isInt(),
  validateRequest,
  deleteCategory,
);

router.get('/items/:categoryId', authenticateUser, getMenuItemsByCategory);

router.post(
  '/items/:categoryId',
  authenticateUser,
  param('categoryId').isInt(),
  body('title').isString().notEmpty(),
  body('description').optional().isString(),
  body('price').isFloat({ gt: 0 }),
  body('image').optional().isString().isURL().withMessage(' inviled image url'),
  body('preparationTime').optional().isInt({ min: 0 }),
  body('extras').optional().isArray(),
  body('discountType').optional().isIn(['PERCENTAGE', 'AMOUNT']),
  body('discountValue').optional().isFloat({ min: 0 }),
  body('allergies').optional().isArray(),
  body('calories').optional().isInt({ min: 0 }),
  body('kitchenSectionId').optional().isInt(),
  validateRequest,
  createMenuItem,
);

router.put(
  '/items/:itemId',
  authenticateUser,
  param('itemId').isInt(),
  body('title').optional().isString(),
  body('description').optional().isString(),
  body('price').optional().isFloat({ gt: 0 }),
  body('image').optional().isString().isURL().withMessage(' inviled image url'),
  body('preparationTime').optional().isInt({ min: 0 }),
  body('extras').optional().isArray(),
  body('discountType').optional().isIn(['PERCENTAGE', 'AMOUNT']),
  body('discountValue').optional().isFloat({ min: 0 }),
  body('allergies').optional().isArray(),
  body('calories').optional().isInt({ min: 0 }),
  body('kitchenSectionId').optional().isInt(),
  validateRequest,
  updateMenuItem,
);

router.delete(
  '/items/:itemId',
  authenticateUser,
  param('itemId').isInt(),
  validateRequest,
  deleteMenuItem,
);

// Seed sample menu data
router.post('/seed', authenticateUser, seedMenuData);

export default router;
