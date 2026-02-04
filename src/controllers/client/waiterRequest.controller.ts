// src/controllers/client/waiterRequest.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { emitToRestaurant } from '../../services/socket.service';

const prisma = new PrismaClient();

/**
 * POST /customer/waiter-request
 * Request waiter for a table (no auth - customer at table).
 * Requires table to have an active session.
 */
export const requestWaiter = async (req: Request, res: Response) => {
  try {
    const { restaurantId, tableNumber } = req.body;

    if (!restaurantId || tableNumber == null) {
      return res.status(400).json({
        success: false,
        message: 'Restaurant ID and table number are required',
      });
    }

    const num = parseInt(String(tableNumber), 10);
    if (isNaN(num)) {
      return res.status(400).json({
        success: false,
        message: 'Table number must be a valid number',
      });
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found',
      });
    }

    const table = await prisma.table.findFirst({
      where: {
        restaurantId,
        number: num,
      },
    });
    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found',
      });
    }

    if (!table.isSessionOpen) {
      return res.status(403).json({
        success: false,
        code: 'TABLE_SESSION_NOT_OPEN',
        message: 'Table session is not open. The cashier must start a session for this table.',
      });
    }

    const payload = {
      tableNumber: table.number,
      tableId: table.id,
      tableName: table.name,
      timestamp: new Date().toISOString(),
    };

    emitToRestaurant(restaurantId, 'waiter:request', payload);

    res.status(200).json({
      success: true,
      message: 'Waiter request sent',
      data: payload,
    });
  } catch (err) {
    console.error('Waiter request error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};
