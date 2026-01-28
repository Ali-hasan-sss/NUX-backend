// src/controllers/restaurant/kitchen-sections.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * @swagger
 * /restaurants/kitchen-sections:
 *   get:
 *     summary: Get all kitchen sections for the restaurant owned by the token user
 *     tags: [Kitchen Sections]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved kitchen sections
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       restaurantId:
 *                         type: string
 *                         example: "rest-123"
 *                       name:
 *                         type: string
 *                         example: "Hot Kitchen"
 *                       description:
 *                         type: string
 *                         example: "Main cooking area"
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Unauthorized user
 *       404:
 *         description: Restaurant not found
 *       500:
 *         description: Server error
 */
export const getKitchenSections = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Find the restaurant owned by the user
    const restaurant = await prisma.restaurant.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    // Fetch all kitchen sections for this restaurant
    const kitchenSections = await prisma.kitchenSection.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: kitchenSections });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @swagger
 * /restaurants/kitchen-sections:
 *   post:
 *     summary: Create a new kitchen section for the restaurant owned by the token user
 *     tags: [Kitchen Sections]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Hot Kitchen"
 *                 description: Name of the kitchen section (must be unique per restaurant)
 *               description:
 *                 type: string
 *                 example: "Main cooking area for hot dishes"
 *                 description: Optional description of the kitchen section
 *     responses:
 *       201:
 *         description: Kitchen section created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *       400:
 *         description: Bad request - validation error
 *       401:
 *         description: Unauthorized user
 *       404:
 *         description: Restaurant not found
 *       409:
 *         description: Kitchen section with this name already exists
 *       500:
 *         description: Server error
 */
export const createKitchenSection = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }

    // Find the restaurant owned by the user
    const restaurant = await prisma.restaurant.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    // Check if kitchen section with this name already exists for this restaurant
    const existingSection = await prisma.kitchenSection.findUnique({
      where: {
        restaurantId_name: {
          restaurantId: restaurant.id,
          name: name.trim(),
        },
      },
    });

    if (existingSection) {
      return res.status(409).json({
        success: false,
        message: 'Kitchen section with this name already exists',
      });
    }

    // Create the kitchen section
    const kitchenSection = await prisma.kitchenSection.create({
      data: {
        restaurantId: restaurant.id,
        name: name.trim(),
        description: description?.trim() || null,
      },
    });

    res.status(201).json({ success: true, data: kitchenSection });
  } catch (err: any) {
    console.error(err);
    if (err.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'Kitchen section with this name already exists',
      });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @swagger
 * /restaurants/kitchen-sections/{sectionId}:
 *   put:
 *     summary: Update a kitchen section (only by restaurant owner)
 *     tags: [Kitchen Sections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sectionId
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID of the kitchen section to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Hot Kitchen"
 *                 description: New name for the kitchen section
 *               description:
 *                 type: string
 *                 example: "Updated description"
 *                 description: New description for the kitchen section
 *     responses:
 *       200:
 *         description: Kitchen section updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized user
 *       403:
 *         description: User is not the owner of the restaurant
 *       404:
 *         description: Kitchen section not found
 *       409:
 *         description: Kitchen section with this name already exists
 *       500:
 *         description: Server error
 */
export const updateKitchenSection = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { sectionId } = req.params;
    const { name, description } = req.body;

    if (!sectionId) {
      return res.status(400).json({ success: false, message: 'Section ID is required' });
    }

    // Find the kitchen section and check ownership
    const kitchenSection = await prisma.kitchenSection.findUnique({
      where: { id: parseInt(sectionId) },
      include: { restaurant: true },
    });

    if (!kitchenSection) {
      return res.status(404).json({ success: false, message: 'Kitchen section not found' });
    }

    // Ensure the logged-in user owns the restaurant
    if (kitchenSection.restaurant.userId !== userId) {
      return res
        .status(403)
        .json({ success: false, message: 'You are not the owner of this restaurant' });
    }

    // If name is being updated, check for duplicates
    if (name && name.trim() && name.trim() !== kitchenSection.name) {
      const existingSection = await prisma.kitchenSection.findUnique({
        where: {
          restaurantId_name: {
            restaurantId: kitchenSection.restaurantId,
            name: name.trim(),
          },
        },
      });

      if (existingSection) {
        return res.status(409).json({
          success: false,
          message: 'Kitchen section with this name already exists',
        });
      }
    }

    // Build update data
    const updateData: any = {};
    if (name !== undefined) {
      updateData.name = name.trim();
    }
    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }

    // Update the kitchen section
    const updatedSection = await prisma.kitchenSection.update({
      where: { id: parseInt(sectionId) },
      data: updateData,
    });

    res.json({ success: true, data: updatedSection });
  } catch (err: any) {
    console.error(err);
    if (err.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'Kitchen section with this name already exists',
      });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @swagger
 * /restaurants/kitchen-sections/{sectionId}:
 *   delete:
 *     summary: Delete a kitchen section (only by restaurant owner)
 *     tags: [Kitchen Sections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sectionId
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID of the kitchen section to delete
 *     responses:
 *       200:
 *         description: Kitchen section deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Kitchen section deleted successfully"
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized user
 *       403:
 *         description: User is not the owner of the restaurant
 *       404:
 *         description: Kitchen section not found
 *       500:
 *         description: Server error
 */
export const deleteKitchenSection = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { sectionId } = req.params;

    if (!sectionId) {
      return res.status(400).json({ success: false, message: 'Section ID is required' });
    }

    // Find the kitchen section and check ownership
    const kitchenSection = await prisma.kitchenSection.findUnique({
      where: { id: parseInt(sectionId) },
      include: { restaurant: true },
    });

    if (!kitchenSection) {
      return res.status(404).json({ success: false, message: 'Kitchen section not found' });
    }

    // Ensure the logged-in user owns the restaurant
    if (kitchenSection.restaurant.userId !== userId) {
      return res
        .status(403)
        .json({ success: false, message: 'You are not the owner of this restaurant' });
    }

    // Delete the kitchen section
    // Note: Items linked to this section will have kitchenSectionId set to null (onDelete: SetNull)
    await prisma.kitchenSection.delete({
      where: { id: parseInt(sectionId) },
    });

    res.json({ success: true, message: 'Kitchen section deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
