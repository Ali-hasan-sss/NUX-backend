// src/controllers/restaurant/tables.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * @swagger
 * /restaurants/tables:
 *   get:
 *     summary: Get all tables for the authenticated restaurant
 *     tags: [Tables]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved tables
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
export const getTables = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    // Get restaurant
    const restaurant = await prisma.restaurant.findUnique({
      where: { userId },
    });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found',
      });
    }

    const tables = await prisma.table.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { number: 'asc' },
    });

    res.json({
      success: true,
      data: tables,
    });
  } catch (err) {
    console.error('Error fetching tables:', err);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

/**
 * @swagger
 * /restaurants/tables:
 *   post:
 *     summary: Create a single table or multiple tables
 *     tags: [Tables]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               count:
 *                 type: integer
 *                 description: Number of tables to create (for bulk creation)
 *                 example: 30
 *               name:
 *                 type: string
 *                 description: Name prefix for tables (optional)
 *                 example: "Table"
 *     responses:
 *       201:
 *         description: Tables created successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
export const createTables = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const { count, name } = req.body;

    if (!count || count < 1 || count > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Count must be between 1 and 1000',
      });
    }

    // Get restaurant
    const restaurant = await prisma.restaurant.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found',
      });
    }

    // Get the highest table number for this restaurant
    const lastTable = await prisma.table.findFirst({
      where: { restaurantId: restaurant.id },
      orderBy: { number: 'desc' },
    });

    const startNumber = lastTable ? lastTable.number + 1 : 1;
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const menuQrCode = restaurant.id; // Restaurant ID is used as menu QR code

    // Create tables
    const tables = [];
    for (let i = 0; i < count; i++) {
      const tableNumber = startNumber + i;
      const tableName = name ? `${name} ${tableNumber}` : `Table ${tableNumber}`;
      // QR code URL format: /menu/{restaurantId}?table={tableNumber}
      const qrCodeUrl = `${baseUrl}/menu/${menuQrCode}?table=${tableNumber}`;

      const table = await prisma.table.create({
        data: {
          restaurantId: restaurant.id,
          name: tableName,
          number: tableNumber,
          qrCode: qrCodeUrl,
          isActive: true,
        },
      });

      tables.push(table);
    }

    res.status(201).json({
      success: true,
      message: `${count} table(s) created successfully`,
      data: tables,
    });
  } catch (err: any) {
    console.error('Error creating tables:', err);
    if (err.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'Table number already exists',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

/**
 * @swagger
 * /restaurants/tables/{tableId}:
 *   put:
 *     summary: Update a table
 *     tags: [Tables]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tableId
 *         schema:
 *           type: integer
 *         required: true
 *         description: Table ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Table updated successfully
 *       404:
 *         description: Table not found
 *       500:
 *         description: Server error
 */
export const updateTable = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const { tableId } = req.params;
    const { name, isActive } = req.body;

    if (!tableId) {
      return res.status(400).json({
        success: false,
        message: 'Table ID is required',
      });
    }

    // Get restaurant
    const restaurant = await prisma.restaurant.findUnique({
      where: { userId },
    });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found',
      });
    }

    const tableIdNum = parseInt(tableId);
    if (isNaN(tableIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid table ID',
      });
    }

    // Verify table belongs to restaurant
    const existingTable = await prisma.table.findFirst({
      where: {
        id: tableIdNum,
        restaurantId: restaurant.id,
      },
    });

    if (!existingTable) {
      return res.status(404).json({
        success: false,
        message: 'Table not found',
      });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedTable = await prisma.table.update({
      where: { id: tableIdNum },
      data: updateData,
    });

    res.json({
      success: true,
      message: 'Table updated successfully',
      data: updatedTable,
    });
  } catch (err) {
    console.error('Error updating table:', err);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

/**
 * @swagger
 * /restaurants/tables/{tableId}:
 *   delete:
 *     summary: Delete a table
 *     tags: [Tables]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tableId
 *         schema:
 *           type: integer
 *         required: true
 *         description: Table ID
 *     responses:
 *       200:
 *         description: Table deleted successfully
 *       404:
 *         description: Table not found
 *       500:
 *         description: Server error
 */
export const deleteTable = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const { tableId } = req.params;

    if (!tableId) {
      return res.status(400).json({
        success: false,
        message: 'Table ID is required',
      });
    }

    // Get restaurant
    const restaurant = await prisma.restaurant.findUnique({
      where: { userId },
    });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found',
      });
    }

    const tableIdNum = parseInt(tableId);
    if (isNaN(tableIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid table ID',
      });
    }

    // Verify table belongs to restaurant
    const existingTable = await prisma.table.findFirst({
      where: {
        id: tableIdNum,
        restaurantId: restaurant.id,
      },
    });

    if (!existingTable) {
      return res.status(404).json({
        success: false,
        message: 'Table not found',
      });
    }

    await prisma.table.delete({
      where: { id: tableIdNum },
    });

    res.json({
      success: true,
      message: 'Table deleted successfully',
    });
  } catch (err) {
    console.error('Error deleting table:', err);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};
