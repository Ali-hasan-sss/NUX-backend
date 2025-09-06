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

    const { title, description, price, image } = req.body;

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

    const item = await prisma.menuItem.create({
      data: {
        categoryId: parseInt(categoryId),
        title,
        description,
        price,
        image,
      },
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

    const { title, description, price, image } = req.body;

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

    const updatedItem = await prisma.menuItem.update({
      where: { id: parseInt(itemId) },
      data: { title, description, price, image },
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
