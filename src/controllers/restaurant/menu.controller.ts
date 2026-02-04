// src/controllers/menu.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * @swagger
 * /restaurants/menu:
 *   get:
 *     summary: Get categoraies of the menu of the restaurant owned by the token user
 *     tags: [Menu]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved the menu
 *       401:
 *         description: Unauthorized user
 *       404:
 *         description: Restaurant not found
 *       500:
 *         description: Server error
 */
export const getMenu = async (req: Request, res: Response) => {
  try {
    // Assume the authentication middleware stores user info in req.user
    const userId = req.user?.id; // User ID from the token

    if (!userId) {
      // If the user ID is not present in the token
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Find the restaurant owned by the user using their ID
    const restaurant = await prisma.restaurant.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!restaurant) {
      // If no restaurant is associated with the user
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    // Fetch all menu categories with their items
    const categories = await prisma.menuCategory.findMany({
      where: { restaurantId: restaurant.id },
    });

    // Return the data to the user
    res.json({ success: true, data: categories });
  } catch (err) {
    console.error(err);
    // If an unexpected server error occurs
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @swagger
 * /restaurants/menu/categories:
 *   post:
 *     summary: Create a new menu category for the restaurant owned by the token user
 *     tags: [Menu]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: Appetizers
 *               description:
 *                 type: string
 *                 example: Starters and small dishes
 *     responses:
 *       201:
 *         description: Category created successfully
 *       401:
 *         description: Unauthorized user
 *       404:
 *         description: Restaurant not found
 *       500:
 *         description: Server error
 */
export const createCategory = async (req: Request, res: Response) => {
  try {
    // Assume the authentication middleware stores user info in req.user
    const userId = req.user?.id; // User ID from the token

    if (!userId) {
      // If the user ID is not present in the token
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Find the restaurant owned by the user
    const restaurant = await prisma.restaurant.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!restaurant) {
      // If no restaurant is associated with the user
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    const { title, description, image } = req.body;

    // Create a new menu category for the restaurant
    const category = await prisma.menuCategory.create({
      data: {
        restaurantId: restaurant.id, // restaurant ID from token owner
        title,
        description,
        image,
      },
    });

    // Return the newly created category
    res.status(201).json({ success: true, data: category });
  } catch (err) {
    console.error(err);
    // If an unexpected server error occurs
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @swagger
 * /restaurants/menu/categories/{categoryId}:
 *   put:
 *     summary: Update a menu category (only by restaurant owner)
 *     tags: [Menu]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID of the category to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: Appetizers
 *               description:
 *                 type: string
 *                 example: Starters and small dishes
 *     responses:
 *       200:
 *         description: Category updated successfully
 *       401:
 *         description: Unauthorized user
 *       403:
 *         description: User is not the owner of the restaurant
 *       404:
 *         description: Category not found
 *       500:
 *         description: Server error
 */
export const updateCategory = async (req: Request, res: Response) => {
  try {
    // Get user ID from token
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { categoryId } = req.params;
    const { title, description, image } = req.body;

    if (!categoryId) {
      return res.status(400).json({ success: false, message: 'Category ID is required' });
    }

    // Find the category and check ownership
    const category = await prisma.menuCategory.findUnique({
      where: { id: parseInt(categoryId) },
      include: { restaurant: true },
    });

    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    // Ensure the logged-in user owns the restaurant
    if (category.restaurant.userId !== userId) {
      return res
        .status(403)
        .json({ success: false, message: 'You are not the owner of this restaurant' });
    }

    // Update the category
    const updatedCategory = await prisma.menuCategory.update({
      where: { id: parseInt(categoryId) },
      data: { title, description, image },
    });

    res.json({ success: true, data: updatedCategory });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @swagger
 * /restaurants/menu/categories/{categoryId}:
 *   delete:
 *     summary: Delete a menu category (only by restaurant owner)
 *     tags: [Menu]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID of the category to delete
 *     responses:
 *       200:
 *         description: Category deleted successfully
 *       401:
 *         description: Unauthorized user
 *       403:
 *         description: User is not the owner of the restaurant
 *       404:
 *         description: Category not found
 *       500:
 *         description: Server error
 */
export const deleteCategory = async (req: Request, res: Response) => {
  try {
    // Get user ID from token
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { categoryId } = req.params;
    if (!categoryId) {
      return res.status(400).json({ success: false, message: 'Category ID is required' });
    }

    // Find the category and check ownership
    const category = await prisma.menuCategory.findUnique({
      where: { id: parseInt(categoryId) },
      include: { restaurant: true },
    });

    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    // Ensure the logged-in user owns the restaurant
    if (category.restaurant.userId !== userId) {
      return res
        .status(403)
        .json({ success: false, message: 'You are not the owner of this restaurant' });
    }

    // Delete the category
    await prisma.menuCategory.delete({
      where: { id: parseInt(categoryId) },
    });

    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @swagger
 * /restaurants/menu/items/{categoryId}:
 *   get:
 *     summary: Get all menu items for a specific category (only by restaurant owner)
 *     tags: [menu item]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID of the category to fetch items from
 *     responses:
 *       200:
 *         description: Successfully retrieved menu items
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not the owner of the restaurant
 *       404:
 *         description: Category not found
 *       500:
 *         description: Server error
 */
export const getMenuItemsByCategory = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { categoryId } = req.params;
    if (!categoryId)
      return res.status(400).json({ success: false, message: 'Category ID is required' });

    // Find the category and check ownership
    const category = await prisma.menuCategory.findUnique({
      where: { id: parseInt(categoryId) },
      include: { restaurant: true, items: true }, // Include items in the category
    });

    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
    if (category.restaurant.userId !== userId) {
      return res
        .status(403)
        .json({ success: false, message: 'You are not the owner of this restaurant' });
    }

    // Return all items in the category
    res.json({ success: true, data: category.items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @swagger
 * /restaurants/menu/items/{categoryId}:
 *   post:
 *     summary: Create a new menu item (only by restaurant owner)
 *     tags: [menu item]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID of the category to add the item to
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               image:
 *                 type: string
 *               preparationTime:
 *                 type: integer
 *                 description: Preparation time in minutes
 *               extras:
 *                 type: array
 *                 description: Array of extra objects with name, price, and calories properties
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     price:
 *                       type: number
 *                     calories:
 *                       type: integer
 *               discountType:
 *                 type: string
 *                 enum: [PERCENTAGE, AMOUNT]
 *               discountValue:
 *                 type: number
 *               allergies:
 *                 type: array
 *                 description: Array of allergy strings (e.g., ["Gluten", "Dairy"])
 *                 items:
 *                   type: string
 *               calories:
 *                 type: integer
 *               kitchenSectionId:
 *                 type: integer
 *                 description: ID of the kitchen section this item belongs to
 *     responses:
 *       200:
 *         description: Menu item created successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not the owner of the restaurant
 *       404:
 *         description: Category not found
 *       500:
 *         description: Server error
 */
export const createMenuItem = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { categoryId } = req.params;
    if (!categoryId)
      return res.status(400).json({ success: false, message: 'Category ID is required' });

    const {
      title,
      description,
      price,
      image,
      preparationTime,
      extras,
      discountType,
      discountValue,
      allergies,
      calories,
      kitchenSectionId,
    } = req.body;

    // Verify category exists and belongs to user's restaurant
    const category = await prisma.menuCategory.findUnique({
      where: { id: parseInt(categoryId) },
      include: { restaurant: true },
    });

    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
    if (category.restaurant.userId !== userId) {
      return res
        .status(403)
        .json({ success: false, message: 'You are not the owner of this restaurant' });
    }

    // Verify kitchen section if provided
    if (kitchenSectionId) {
      const kitchenSection = await (prisma as any).kitchenSection.findUnique({
        where: { id: parseInt(kitchenSectionId) },
        include: { restaurant: true },
      });

      if (!kitchenSection) {
        return res.status(404).json({ success: false, message: 'Kitchen section not found' });
      }
      if (kitchenSection.restaurant.userId !== userId) {
        return res
          .status(403)
          .json({ success: false, message: 'You are not the owner of this kitchen section' });
      }
    }

    // Build data object with new fields
    const itemData: any = {
      categoryId: parseInt(categoryId),
      title,
      description,
      price,
      image,
    };

    // Add optional fields only if they are provided
    if (preparationTime !== undefined) {
      itemData.preparationTime = preparationTime ? parseInt(preparationTime) : null;
    }
    if (extras !== undefined) {
      itemData.extras = extras ? extras : null;
    }
    if (discountType !== undefined) {
      itemData.discountType = discountType || null;
    }
    if (discountValue !== undefined) {
      itemData.discountValue = discountValue ? parseFloat(discountValue) : null;
    }
    if (allergies !== undefined) {
      itemData.allergies = allergies || [];
    }
    if (calories !== undefined) {
      itemData.calories = calories ? parseInt(calories) : null;
    }
    if (kitchenSectionId !== undefined) {
      itemData.kitchenSectionId = kitchenSectionId ? parseInt(kitchenSectionId) : null;
    }

    const item = await prisma.menuItem.create({
      data: itemData,
    });

    res.json({ success: true, data: item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @swagger
 * /restaurants/menu/items/{itemId}:
 *   put:
 *     summary: Update a menu item (only by restaurant owner)
 *     tags: [menu item]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID of the menu item to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               image:
 *                 type: string
 *               preparationTime:
 *                 type: integer
 *                 description: Preparation time in minutes
 *               extras:
 *                 type: array
 *                 description: Array of extra objects with name, price, and calories properties
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     price:
 *                       type: number
 *                     calories:
 *                       type: integer
 *               discountType:
 *                 type: string
 *                 enum: [PERCENTAGE, AMOUNT]
 *               discountValue:
 *                 type: number
 *               allergies:
 *                 type: array
 *                 description: Array of allergy strings (e.g., ["Gluten", "Dairy"])
 *                 items:
 *                   type: string
 *               calories:
 *                 type: integer
 *               kitchenSectionId:
 *                 type: integer
 *                 description: ID of the kitchen section this item belongs to
 *     responses:
 *       200:
 *         description: Menu item updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not the owner of the restaurant
 *       404:
 *         description: Item not found
 *       500:
 *         description: Server error
 */
export const updateMenuItem = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { itemId } = req.params;
    if (!itemId) return res.status(400).json({ success: false, message: 'Item ID is required' });

    const {
      title,
      description,
      price,
      image,
      preparationTime,
      extras,
      discountType,
      discountValue,
      allergies,
      calories,
      kitchenSectionId,
    } = req.body;

    // Verify item exists and belongs to user's restaurant
    const item = await prisma.menuItem.findUnique({
      where: { id: parseInt(itemId) },
      include: { category: { include: { restaurant: true } } },
    });

    if (!item) return res.status(404).json({ success: false, message: 'Menu item not found' });
    if (item.category.restaurant.userId !== userId) {
      return res
        .status(403)
        .json({ success: false, message: 'You are not the owner of this restaurant' });
    }

    // Verify kitchen section if provided
    if (kitchenSectionId) {
      const kitchenSection = await (prisma as any).kitchenSection.findUnique({
        where: { id: parseInt(kitchenSectionId) },
        include: { restaurant: true },
      });

      if (!kitchenSection) {
        return res.status(404).json({ success: false, message: 'Kitchen section not found' });
      }
      if (kitchenSection.restaurant.userId !== userId) {
        return res
          .status(403)
          .json({ success: false, message: 'You are not the owner of this kitchen section' });
      }
    }

    // Build update data object
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = price;
    if (image !== undefined) updateData.image = image;
    if (preparationTime !== undefined)
      updateData.preparationTime = preparationTime ? parseInt(preparationTime) : null;
    if (extras !== undefined) updateData.extras = extras;
    if (discountType !== undefined) updateData.discountType = discountType || null;
    if (discountValue !== undefined)
      updateData.discountValue = discountValue ? parseFloat(discountValue) : null;
    if (allergies !== undefined) updateData.allergies = allergies || [];
    if (calories !== undefined) updateData.calories = calories ? parseInt(calories) : null;
    if (kitchenSectionId !== undefined)
      updateData.kitchenSectionId = kitchenSectionId ? parseInt(kitchenSectionId) : null;

    const updatedItem = await prisma.menuItem.update({
      where: { id: parseInt(itemId) },
      data: updateData,
    });

    res.json({ success: true, data: updatedItem });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @swagger
 * /restaurants/menu/items/{itemId}:
 *   delete:
 *     summary: Delete a menu item (only by restaurant owner)
 *     tags: [menu item]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID of the menu item to delete
 *     responses:
 *       200:
 *         description: Menu item deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not the owner of the restaurant
 *       404:
 *         description: Item not found
 *       500:
 *         description: Server error
 */
export const deleteMenuItem = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { itemId } = req.params;
    if (!itemId) return res.status(400).json({ success: false, message: 'Item ID is required' });

    // Verify item exists and belongs to user's restaurant
    const item = await prisma.menuItem.findUnique({
      where: { id: parseInt(itemId) },
      include: { category: { include: { restaurant: true } } },
    });

    if (!item) return res.status(404).json({ success: false, message: 'Menu item not found' });
    if (item.category.restaurant.userId !== userId) {
      return res
        .status(403)
        .json({ success: false, message: 'You are not the owner of this restaurant' });
    }

    await prisma.menuItem.delete({
      where: { id: parseInt(itemId) },
    });

    res.json({ success: true, message: 'Menu item deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @swagger
 * /restaurants/menu/discount/all:
 *   post:
 *     summary: Apply discount to all menu items of the restaurant
 *     description: Sets discountType and discountValue for every menu item. Use discountValue 0 to remove discount from all items.
 *     tags: [Menu]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [discountType, discountValue]
 *             properties:
 *               discountType:
 *                 type: string
 *                 enum: [PERCENTAGE, AMOUNT]
 *                 description: PERCENTAGE = percent off (e.g. 10 for 10%), AMOUNT = fixed amount off in currency
 *               discountValue:
 *                 type: number
 *                 minimum: 0
 *                 description: Discount value. Use 0 to remove discount from all items.
 *     responses:
 *       200:
 *         description: Discount applied successfully
 *       400:
 *         description: Invalid discountType or discountValue (e.g. percentage > 100)
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Restaurant not found
 *       500:
 *         description: Server error
 */
export const applyDiscountToAllMenuItems = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const restaurant = await prisma.restaurant.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!restaurant)
      return res.status(404).json({ success: false, message: 'Restaurant not found' });

    const { discountType, discountValue } = req.body;
    if (!discountType || !['PERCENTAGE', 'AMOUNT'].includes(discountType)) {
      return res
        .status(400)
        .json({ success: false, message: 'discountType must be PERCENTAGE or AMOUNT' });
    }
    const value = parseFloat(discountValue);
    if (isNaN(value) || value < 0) {
      return res
        .status(400)
        .json({ success: false, message: 'discountValue must be a non-negative number' });
    }
    if (discountType === 'PERCENTAGE' && value > 100) {
      return res
        .status(400)
        .json({ success: false, message: 'Percentage discount cannot exceed 100' });
    }

    // Use 0 to remove discount (set both to null)
    const data =
      value === 0
        ? { discountType: null, discountValue: null }
        : { discountType: discountType as 'PERCENTAGE' | 'AMOUNT', discountValue: value };

    const result = await prisma.menuItem.updateMany({
      where: { category: { restaurantId: restaurant.id } },
      data,
    });

    res.json({
      success: true,
      message:
        value === 0
          ? `Discount removed from ${result.count} item(s)`
          : `Discount applied to ${result.count} item(s)`,
      data: { count: result.count },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @swagger
 * /restaurants/menu/discount/category/{categoryId}:
 *   post:
 *     summary: Apply discount to all menu items in a specific category
 *     description: Sets discountType and discountValue for every item in the given category. Use discountValue 0 to remove discount from category items.
 *     tags: [Menu]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Menu category ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [discountType, discountValue]
 *             properties:
 *               discountType:
 *                 type: string
 *                 enum: [PERCENTAGE, AMOUNT]
 *                 description: PERCENTAGE = percent off, AMOUNT = fixed amount off
 *               discountValue:
 *                 type: number
 *                 minimum: 0
 *                 description: Discount value. Use 0 to remove discount from category items.
 *     responses:
 *       200:
 *         description: Discount applied successfully
 *       400:
 *         description: Invalid request or categoryId
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not the owner of the restaurant
 *       404:
 *         description: Category not found
 *       500:
 *         description: Server error
 */
export const applyDiscountToCategory = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { categoryId } = req.params;
    if (!categoryId)
      return res.status(400).json({ success: false, message: 'Category ID is required' });

    const category = await prisma.menuCategory.findUnique({
      where: { id: parseInt(categoryId) },
      include: { restaurant: true },
    });
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
    if (category.restaurant.userId !== userId) {
      return res
        .status(403)
        .json({ success: false, message: 'You are not the owner of this restaurant' });
    }

    const { discountType, discountValue } = req.body;
    if (!discountType || !['PERCENTAGE', 'AMOUNT'].includes(discountType)) {
      return res
        .status(400)
        .json({ success: false, message: 'discountType must be PERCENTAGE or AMOUNT' });
    }
    const value = parseFloat(discountValue);
    if (isNaN(value) || value < 0) {
      return res
        .status(400)
        .json({ success: false, message: 'discountValue must be a non-negative number' });
    }
    if (discountType === 'PERCENTAGE' && value > 100) {
      return res
        .status(400)
        .json({ success: false, message: 'Percentage discount cannot exceed 100' });
    }

    // Use 0 to remove discount (set both to null)
    const data =
      value === 0
        ? { discountType: null, discountValue: null }
        : { discountType: discountType as 'PERCENTAGE' | 'AMOUNT', discountValue: value };

    const result = await prisma.menuItem.updateMany({
      where: { categoryId: parseInt(categoryId) },
      data,
    });

    res.json({
      success: true,
      message:
        value === 0
          ? `Discount removed from ${result.count} item(s) in category`
          : `Discount applied to ${result.count} item(s) in category`,
      data: { count: result.count },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
