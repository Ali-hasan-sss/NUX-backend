// src/services/socket.service.ts
import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { ACCESS_TOKEN_SECRET } from '../config/jwt';

const prisma = new PrismaClient();

let io: Server | null = null;

interface JwtPayload {
  userId: string;
  role: string;
}

export const initSocket = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
    path: '/socket.io',
  });

  io.use(async (socket: Socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string) ||
        (socket.handshake.query?.token as string);

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET) as JwtPayload;
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { restaurants: true },
      });

      if (!user) {
        return next(new Error('User not found'));
      }

      (socket as any).user = user;
      (socket as any).userId = user.id;
      (socket as any).restaurantId = user.restaurants?.id ?? null;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = (socket as any).userId;
    const restaurantId = (socket as any).restaurantId;

    socket.join(`user:${userId}`);
    if (restaurantId) {
      socket.join(`restaurant:${restaurantId}`);
    }

    socket.on('disconnect', () => {});
  });

  console.log('Socket.IO server initialized');
  return io;
};

export const getIO = (): Server => {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initSocket first.');
  }
  return io;
};

export const emitToRestaurant = (restaurantId: string, event: string, data: any) => {
  if (io) {
    io.to(`restaurant:${restaurantId}`).emit(event, data);
  }
};

export const emitToUser = (userId: string, event: string, data: any) => {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
};
