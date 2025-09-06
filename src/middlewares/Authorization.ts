// src/middlewares/auth.ts
import { Request, Response, NextFunction } from 'express';
import { errorResponse } from '../utils/response';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const isAdminMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user;

  if (!user) {
    return errorResponse(res, 'Unauthorized', 401);
  }

  if (user.role !== 'ADMIN') {
    return errorResponse(res, 'Forbidden', 403);
  }

  next();
};

export const verifyRestaurantOwnership = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { userId },
    });

    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    (req as any).restaurant = restaurant;

    next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
