// middlewares/authorization.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { errorResponse } from '../utils/response';
import { ACCESS_TOKEN_SECRET } from '../config/jwt';

const prisma = new PrismaClient();

interface JwtPayload {
  userId: string;
  role: string;
}

export const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'No token provided', 401);
    }

    const token = authHeader.split(' ')[1];
    //console.log('Token:', token);

    if (!token) {
      return errorResponse(res, 'No token provided', 401);
    }

    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET) as unknown;
    //console.log('Decoded Token:', decoded);

    if (
      typeof decoded !== 'object' ||
      decoded === null ||
      !('userId' in decoded) ||
      !('role' in decoded)
    ) {
      return errorResponse(res, 'Invalid token payload', 401);
    }

    const payload = decoded as JwtPayload;

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });

    if (!user) {
      console.log('User not found');
      return errorResponse(res, 'User not found', 401);
    }

    req.user = user;

    next();
  } catch (err) {
    console.log('Error in authenticateUser:', err);
    return errorResponse(res, 'Authentication failed', 401);
  }
};
