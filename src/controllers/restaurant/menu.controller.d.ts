import { Request, Response } from 'express';
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
export declare const getMenu: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
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
export declare const createCategory: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
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
export declare const updateCategory: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
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
export declare const deleteCategory: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
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
export declare const getMenuItemsByCategory: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
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
export declare const createMenuItem: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
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
export declare const updateMenuItem: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
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
export declare const deleteMenuItem: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=menu.controller.d.ts.map