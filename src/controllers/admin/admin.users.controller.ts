import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { errorResponse, successResponse } from '../../utils/response';

const prisma = new PrismaClient();

/**
 * @swagger
 * tags:
 *   - name: Users
 *     description: Admin users management endpoints
 */

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get all users with pagination
 *     description: Retrieve a list of all users (Admin only), with optional filters by role, active status, and email search. Supports pagination.
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [USER, RESTAURANT_OWNER, ADMIN]
 *         description: Filter by role
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status (true/false)
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *         description: Search by email (partial match)
 *       - in: query
 *         name: pageNumber
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number (starting from 1)
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Users retrieved successfully with pagination
 *       500:
 *         description: Internal server error
 */
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const { role, isActive, email, pageNumber = '1', pageSize = '10' } = req.query;

    const filters: any = {};

    if (role) {
      filters.role = role as string; // "USER" | "RESTAURANT_OWNER" | "ADMIN" | "SUBADMIN"
    }

    // Sub-admin with MANAGE_USERS must not see ADMIN users (only USER, RESTAURANT_OWNER, SUBADMIN)
    if (currentUser?.role === 'SUBADMIN') {
      if (role === 'ADMIN') {
        return errorResponse(res, 'You cannot list admin users', 403);
      }
      filters.role = role ? (role as string) : { not: 'ADMIN' };
    }

    if (isActive !== undefined) {
      filters.isActive = isActive === 'true';
    }

    if (email) {
      filters.email = {
        contains: String(email),
        mode: 'insensitive',
      };
    }

    const page = Math.max(parseInt(pageNumber as string, 10), 1);
    const size = Math.max(parseInt(pageSize as string, 10), 1);

    const totalItems = await prisma.user.count({ where: filters });
    const totalPages = Math.ceil(totalItems / size);

    const users = await prisma.user.findMany({
      where: filters,
      skip: (page - 1) * size,
      take: size,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    successResponse(
      res,
      'Users retrieved successfully',
      {
        pagination: {
          totalItems,
          totalPages,
          currentPage: page,
          pageSize: size,
        },
        users,
      },
      200,
    );
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Internal server error', 500);
  }
};

/**
 * @swagger
 * /api/admin/users/{id}:
 *   get:
 *     summary: Get a user by ID with related restaurants and balances
 *     description: >
 *       Retrieve detailed information about a specific user, including:
 *       - Basic user details (excluding sensitive fields)
 *       - Restaurants owned by the user
 *       - Balances associated with each restaurant
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: UUID of the user
 *     responses:
 *       200:
 *         description: User retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     fullName:
 *                       type: string
 *                       nullable: true
 *                     role:
 *                       type: string
 *                       enum: [USER, ADMIN]
 *                     isRestaurant:
 *                       type: boolean
 *                     isActive:
 *                       type: boolean
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     restaurants:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           balances:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 amount:
 *                                   type: number
 *                                 restaurant:
 *                                   type: object
 *                                   properties:
 *                                     id:
 *                                       type: string
 *                                     name:
 *                                       type: string
 *                     balances:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           amount:
 *                             type: number
 *                           restaurant:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               name:
 *                                 type: string
 *       404:
 *         description: User not found
 *       400:
 *         description: User ID is required
 *       500:
 *         description: Internal server error
 */

export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return errorResponse(res, 'User ID is required', 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: String(id) },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isRestaurant: true,
        isActive: true,
        createdAt: true,
        restaurants: {
          include: {
            balances: {
              include: {
                restaurant: true,
              },
            },
          },
        },
        balances: {
          include: {
            restaurant: true,
          },
        },
      },
    });

    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    // Sub-admin with MANAGE_USERS must not access ADMIN users
    const currentUser = (req as any).user;
    if (currentUser?.role === 'SUBADMIN' && user.role === 'ADMIN') {
      return errorResponse(res, 'You cannot access admin user details', 403);
    }

    successResponse(res, 'User retrieved successfully', user, 200);
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Internal server error', 500);
  }
};

/**
 * @swagger
 * /api/admin/users:
 *   post:
 *     summary: Create a new user
 *     description: Admin can create a new user account
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               fullName:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *               role:
 *                 type: string
 *                 enum: [ADMIN, SUB_ADMIN, USER, TECHNICIAN]
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Email already exists
 *       500:
 *         description: Internal server error
 */

export const createUser = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const { email, password, fullName, role, isActive } = req.body;

    // Sub-admin cannot create users with role ADMIN
    if (currentUser?.role === 'SUBADMIN' && role === 'ADMIN') {
      return errorResponse(res, 'You cannot create admin users', 403);
    }

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return errorResponse(res, 'Email already exists', 400);
    }

    // Hash password (using bcrypt)
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        fullName,
        role,
        isActive: isActive || true,
        qrCode: uuidv4(),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
    return successResponse(res, 'User created successfully', newUser, 201);
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Internal server error', 500);
  }
};

/**
 * @swagger
 * /api/admin/users/{id}:
 *   put:
 *     summary: Update an existing user
 *     description: Admin can update user info
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               fullName:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [ADMIN, SUB_ADMIN, USER, TECHNICIAN]
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
export const updateUser = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const { id } = req.params;
    const { email, password, fullName, role, isActive } = req.body;

    if (!id) {
      return errorResponse(res, 'User ID is required', 400);
    }

    const user = await prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    // Sub-admin cannot view, update or promote anyone to ADMIN
    if (currentUser?.role === 'SUBADMIN') {
      if (user.role === 'ADMIN') {
        return errorResponse(res, 'You cannot modify admin users', 403);
      }
      if (role === 'ADMIN') {
        return errorResponse(res, 'You cannot assign the admin role', 403);
      }
    }

    const dataToUpdate: any = {};
    if (email) dataToUpdate.email = email;
    if (password) {
      const bcrypt = require('bcrypt');
      dataToUpdate.password = await bcrypt.hash(password, 10);
    }
    if (fullName !== undefined) dataToUpdate.fullName = fullName;
    if (role) dataToUpdate.role = role;
    if (isActive !== undefined) dataToUpdate.isActive = isActive;

    const updatedUser = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return successResponse(res, 'User updated successfully', updatedUser, 200);
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Internal server error', 500);
  }
};

/**
 * @swagger
 * /api/admin/users/{id}:
 *   delete:
 *     summary: Delete a user
 *     description: Admin can delete a user account
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return errorResponse(res, 'User ID is required', 400);
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }
    const currentUser = (req as any).user;
    if (!currentUser) {
      return errorResponse(res, 'Unauthorized', 401);
    }
    // Block removing yourself
    if (currentUser.id === id) {
      return errorResponse(res, 'Cannot delete yourself', 403);
    }
    // Sub-admin cannot delete any ADMIN (including the one who added them)
    if (currentUser.role === 'SUBADMIN') {
      if (user.role === 'ADMIN') {
        return errorResponse(res, 'You cannot delete admin users', 403);
      }
      const subAdmin = await prisma.subAdmin.findUnique({
        where: { userId: currentUser.id },
      });
      if (subAdmin && subAdmin.addedByUserId === id) {
        return errorResponse(res, 'You cannot delete the admin who added you', 403);
      }
    }
    await prisma.user.delete({ where: { id } });

    successResponse(res, 'User deleted successfully', null, 200);
  } catch (error) {
    console.error(error);
    errorResponse(res, 'Internal server error', 500);
  }
};
