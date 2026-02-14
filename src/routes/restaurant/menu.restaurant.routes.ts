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
  applyDiscountToAllMenuItems,
  applyDiscountToCategory,
} from '../../controllers/restaurant/menu.controller';
import { seedMenuData } from '../../controllers/restaurant/seed.controller';
import { validateRequest } from '../../middlewares/security';
import { authenticateUser } from '../../middlewares/Auth';
import { verifyRestaurantOwnership } from '../../middlewares/Authorization';
import { canManageMenu } from '../../middlewares/permissions';

/** Accept full URL (http/https) or server path (/uploads/...) */
const imageOrPathValidator = body('image')
  .optional()
  .isString()
  .custom((value: string) => {
    if (!value || value.trim() === '') return true;
    const v = value.trim();
    if (v.startsWith('http://') || v.startsWith('https://')) {
      try {
        new URL(v);
        return true;
      } catch {
        return false;
      }
    }
    if (v.startsWith('/uploads/')) return true;
    return false;
  })
  .withMessage('Invalid image URL or path (use full URL or /uploads/... path)');

const router = Router();

router.use(authenticateUser);
router.use(verifyRestaurantOwnership);
router.use(canManageMenu);

// get menu for restaurant
router.get('/', getMenu);

router.post(
  '/categories',
  body('title').isString().notEmpty(),
  body('description').optional().isString(),
  imageOrPathValidator,
  validateRequest,
  createCategory,
);

router.put(
  '/categories/:categoryId',
  body('title').optional().isString(),
  body('description').optional().isString(),
  imageOrPathValidator,
  validateRequest,
  updateCategory,
);

router.delete(
  '/categories/:categoryId',
  param('categoryId').isInt(),
  validateRequest,
  deleteCategory,
);

router.get('/items/:categoryId', getMenuItemsByCategory);

// Apply discount to all menu items
router.post(
  '/discount/all',
  body('discountType').isIn(['PERCENTAGE', 'AMOUNT']),
  body('discountValue').isFloat({ min: 0 }),
  validateRequest,
  applyDiscountToAllMenuItems,
);

// Apply discount to items in a category
router.post(
  '/discount/category/:categoryId',
  param('categoryId').isInt(),
  body('discountType').isIn(['PERCENTAGE', 'AMOUNT']),
  body('discountValue').isFloat({ min: 0 }),
  validateRequest,
  applyDiscountToCategory,
);

router.post(
  '/items/:categoryId',
  param('categoryId').isInt(),
  body('title').isString().notEmpty(),
  body('description').optional().isString(),
  body('price').isFloat({ gt: 0 }),
  imageOrPathValidator,
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
  param('itemId').isInt(),
  body('title').optional().isString(),
  body('description').optional().isString(),
  body('price').optional().isFloat({ gt: 0 }),
  imageOrPathValidator,
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
  param('itemId').isInt(),
  validateRequest,
  deleteMenuItem,
);

// Seed sample menu data
router.post('/seed', seedMenuData);

export default router;
