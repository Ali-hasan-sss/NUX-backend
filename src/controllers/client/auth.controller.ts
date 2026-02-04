// src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import { hashPassword, comparePassword } from '../../utils/hash';
import { generateAccessToken, generateRefreshToken } from '../../utils/token';
import { PrismaClient, Role } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { REFRESH_TOKEN_SECRET } from '../../config/jwt';
import { v4 as uuidv4 } from 'uuid';
import { errorResponse, successResponse } from '../../utils/response';
import { sendEmailVerificationCode, sendResetCodeEmail } from '../../utils/email';

const prisma = new PrismaClient();

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Authentication and user management endpoints
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user account
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: Password123
 *               fullName:
 *                 type: string
 *                 example: (optenial)
 *     responses:
 *       201:
 *         description: Account created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     fullName:
 *                       type: string
 *                     role:
 *                       type: string
 *                 tokens:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       400:
 *         description: Validation error or registration failed
 *       500:
 *         description: Server error
 */
export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, fullName } = req.body;

    if (!email || !password) {
      return errorResponse(res, 'Email and password are required', 400);
    }

    const strictEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!strictEmailRegex.test(email)) {
      return errorResponse(res, 'Invalid email format', 400);
    }

    if (password.length < 8) {
      return errorResponse(res, 'Password must be at least 8 characters long', 400);
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return errorResponse(res, 'Registration failed. Please check your information', 400);
    }

    const hashedPassword = await hashPassword(password);
    const qrCode = uuidv4();

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpiry = new Date(Date.now() + 10 * 60 * 1000);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        fullName: fullName || null,
        role: Role.USER,
        qrCode,
        emailVerificationCode: verificationCode,
        emailVerificationExpiry: verificationExpiry,
      },
    });

    const refreshToken = generateRefreshToken({ userId: user.id, role: user.role });
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    setImmediate(() => {
      sendEmailVerificationCode(user.email, verificationCode).catch((err) => {
        console.error('Send verification email error:', err);
      });
    });

    const accessToken = generateAccessToken({ userId: user.id, role: user.role });

    return successResponse(
      res,
      'Account created successfully',
      {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      },
      201,
    );
  } catch (error) {
    console.error('Register error:', error);
    return errorResponse(res, 'An unexpected error occurred', 500);
  }
};

/**
 * @swagger
 * /auth/registerRestaurant:
 *   post:
 *     summary: Register a new restaurant owner account with restaurant details
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - restaurantName
 *               - address
 *               - latitude
 *               - longitude
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: restaurant@example.com
 *               password:
 *                 type: string
 *                 example: Password123
 *               fullName:
 *                 type: string
 *                 example: Jane Smith
 *               restaurantName:
 *                 type: string
 *                 example: My Restaurant
 *               address:
 *                 type: string
 *                 example: 123 Main St
 *               latitude:
 *                 type: number
 *                 example: 35.6895
 *               longitude:
 *                 type: number
 *                 example: 139.6917
 *     responses:
 *       201:
 *         description: Restaurant account created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     fullName:
 *                       type: string
 *                     role:
 *                       type: string
 *                 restaurant:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     address:
 *                       type: string
 *                     latitude:
 *                       type: number
 *                     longitude:
 *                       type: number
 *                     subscriptionActive:
 *                       type: boolean
 *                 tokens:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       400:
 *         description: Validation error, missing fields, or registration failed
 *       500:
 *         description: Server error
 */

export const registerRestaurant = async (req: Request, res: Response) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  try {
    const { email, password, fullName, restaurantName, address, latitude, longitude } = req.body;
    if (
      !email ||
      !password ||
      !restaurantName ||
      !address ||
      latitude == null ||
      longitude == null
    ) {
      return errorResponse(res, 'All fields are required', 400);
    }
    if (!emailRegex.test(email)) {
      return errorResponse(res, 'Invalid email format', 400);
    }

    const strictEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!strictEmailRegex.test(email)) {
      return errorResponse(res, 'Invalid email format', 400);
    }

    if (password.length < 8) {
      return errorResponse(res, 'Password must be at least 8 characters long', 400);
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return errorResponse(res, 'Registration failed. Please check your information', 400);
    }

    // hashing password
    const hashedPassword = await hashPassword(password);

    const qrCode = uuidv4();
    const qrCodeDrink = uuidv4();
    const qrCodeMeal = uuidv4();

    // get the free plan
    const freePlan = await prisma.plan.findFirst({
      where: { title: 'Free Trial', isActive: true },
    });

    if (!freePlan) {
      return errorResponse(res, 'Free trial plan is not available', 500);
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpiry = new Date(Date.now() + 10 * 60 * 1000);

    // create user and restaurant and enable the free plan
    const result = await prisma.$transaction(async (prisma) => {
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          fullName: fullName || null,
          role: Role.RESTAURANT_OWNER,
          qrCode,
          isRestaurant: true,
          emailVerificationCode: verificationCode,
          emailVerificationExpiry: verificationExpiry,
        },
      });

      const restaurant = await prisma.restaurant.create({
        data: {
          userId: user.id,
          name: restaurantName,
          address,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          qrCode_drink: qrCodeDrink,
          qrCode_meal: qrCodeMeal,
        },
      });

      // create subscription in the free plan (one-time only)
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + freePlan.duration);

      const subscription = await prisma.subscription.create({
        data: {
          restaurantId: restaurant.id,
          planId: freePlan.id,
          startDate: new Date(),
          endDate,
          status: 'ACTIVE',
          paymentStatus: 'paid',
          paymentMethod: 'free_trial',
        },
        include: { plan: true },
      });

      // update restaurant after subscription creation
      const updatedRestaurant = await prisma.restaurant.update({
        where: { id: restaurant.id },
        data: {
          isSubscriptionActive: true,
          isActive: true,
        },
      });

      const refreshToken = generateRefreshToken({ userId: user.id, role: user.role });
      const accessToken = generateAccessToken({ userId: user.id, role: user.role });

      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken },
      });

      return {
        user,
        restaurant: updatedRestaurant,
        subscription,
        tokens: { accessToken, refreshToken },
      };
    });

    setImmediate(() => {
      sendEmailVerificationCode(result.user.email, verificationCode).catch((err) => {
        console.error('Send verification email error (restaurant):', err);
      });
    });

    // data of subscription
    const subscriptionData = result.subscription
      ? {
          planName: result.subscription.plan.title,
          price: result.subscription.plan.price,
          endDate: result.subscription.endDate,
          status: result.subscription.status,
        }
      : null;

    return successResponse(
      res,
      'Restaurant account created successfully with Free Trial plan',
      {
        user: {
          id: result.user.id,
          email: result.user.email,
          fullName: result.user.fullName,
          role: result.user.role,
        },
        restaurant: {
          id: result.restaurant.id,
          name: result.restaurant.name,
          address: result.restaurant.address,
          latitude: result.restaurant.latitude,
          longitude: result.restaurant.longitude,
          qrCode_drink: result.restaurant.qrCode_drink,
          qrCode_meal: result.restaurant.qrCode_meal,
          subscription: subscriptionData,
          isActive: result.restaurant.isActive,
        },
        tokens: result.tokens,
      },
      201,
    );
  } catch (error) {
    console.error('Register restaurant error:', error);
    return errorResponse(res, 'An unexpected error occurred', 500);
  }
};

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login regular user
 *     description: Login for normal users only. Admins cannot use this route.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: Password123
 *     responses:
 *       200:
 *         description: Login successful, returns user info and tokens
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     fullName:
 *                       type: string
 *                     role:
 *                       type: string
 *                 tokens:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       400:
 *         description: Missing email or password
 *       401:
 *         description: Invalid email or password
 *       500:
 *         description: Server error
 */
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    console.log('🔐 Login attempt:', {
      email,
      passwordLength: password?.length,
      origin: req.get('origin'),
    });

    if (!email || !password) return errorResponse(res, 'Email and password are required', 400);

    // 1) جيب المستخدم فقط (بدون include لعلاقات محذوفة)
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.log('❌ User not found:', email);
      return errorResponse(res, 'Invalid email or password', 401);
    }

    if (['ADMIN'].includes(user.role)) {
      console.log('❌ Admin trying to login via user route:', email);
      return errorResponse(res, 'Invalid email or password', 401);
    }

    // 2) تحقق كلمة المرور
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      console.log('❌ Invalid password for:', email);
      return errorResponse(res, 'Invalid email or password', 401);
    }

    // 2.5) تحقق من تفعيل البريد الإلكتروني
    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email first. Check your inbox for the verification code.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    console.log('✅ Login successful for:', email);

    // 3) اصنع التوكينات وخزّن refreshToken
    const accessToken = generateAccessToken({ userId: user.id, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user.id, role: user.role });

    await prisma.user.update({ where: { id: user.id }, data: { refreshToken } });

    // 4) إن كان المستخدم صاحب مطعم، جيب المطعم واشتراكاته الفعالة
    let restaurantData: any = null;

    if (user.isRestaurant) {
      const restaurant = await prisma.restaurant.findUnique({
        where: { userId: user.id }, // لأن العلاقة 1-1 عبر userId (unique)
      });

      if (restaurant) {
        // جميع الاشتراكات الفعالة (تنتهي بالمستقبل وحالتها ACTIVE)
        const activeSubs = await prisma.subscription.findMany({
          where: {
            restaurantId: restaurant.id,
            status: 'ACTIVE',
            endDate: { gte: new Date() },
          },
          include: { plan: true },
          orderBy: { endDate: 'desc' }, // نخلي أول واحد هو الأبعد انتهاءً
        });

        // اشتراك "حالي" متوافق مع الواجهة القديمة (اختياري: الأبعد انتهاءً)
        const currentSub = activeSubs[0] || null;

        const subscriptionData = currentSub
          ? {
              planName: currentSub.plan.title,
              price: currentSub.plan.price,
              endDate: currentSub.endDate,
              status: currentSub.status,
            }
          : null;

        restaurantData = {
          id: restaurant.id,
          name: restaurant.name,
          address: restaurant.address,
          latitude: restaurant.latitude,
          longitude: restaurant.longitude,
          isActive: restaurant.isActive,
          isSubscriptionActive: restaurant.isSubscriptionActive,
          // هذا للحفاظ على التوافق مع الواجهة القديمة
          subscription: subscriptionData,
          // ولو حبيت تعرض الكل للواجهة الجديدة:
          activeSubscriptions: activeSubs.map((s) => ({
            id: s.id,
            planId: s.planId,
            planName: s.plan.title,
            price: s.plan.price,
            startDate: s.startDate,
            endDate: s.endDate,
            status: s.status,
          })),
        };
      }
    }

    // 5) الرد
    return successResponse(res, 'Login successful', {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isActive: user.isActive,
      },
      restaurant: restaurantData,
      tokens: { accessToken, refreshToken },
    });
  } catch (err) {
    console.log(err);
    return errorResponse(res, 'An unexpected error occurred', 500);
  }
};

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh access and refresh tokens using a valid refresh token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: Tokens refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *       401:
 *         description: Refresh token missing
 *       403:
 *         description: Invalid or expired refresh token
 */

export const refresh = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  //  console.log('Body:', req.body);
  if (!refreshToken) {
    return errorResponse(res, 'Refresh token is required', 401);
  }

  try {
    const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET) as { userId: string };

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || user.refreshToken !== refreshToken) {
      return errorResponse(res, 'Invalid refresh token', 403);
    }

    const newAccessToken = generateAccessToken({ userId: user.id, role: user.role });
    const newRefreshToken = generateRefreshToken({ userId: user.id, role: user.role });

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken },
    });

    return successResponse(
      res,
      '',
      {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
      200,
    );
  } catch (error) {
    // console.error('Refresh token error:', error);
    return errorResponse(res, 'Invalid or expired refresh token', 403);
  }
};

/**
 * @swagger
 * /auth/send-verification-code:
 *   post:
 *     summary: Send email verification code to user's email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: Verification code sent (if email exists)
 *       400:
 *         description: Email is required
 */

export const sendVerificationCode = async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return errorResponse(res, 'Email is required', 400);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return successResponse(res, 'If the email exists, a verification code has been sent');
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = new Date(Date.now() + 10 * 60 * 1000);
  await prisma.user.update({
    where: { email },
    data: {
      emailVerificationCode: code,
      emailVerificationExpiry: expiry,
    },
  });

  try {
    await sendEmailVerificationCode(email, code);
  } catch (err) {
    console.error('Send verification code email error:', err);
    return errorResponse(res, 'Failed to send verification email. Please try again later.', 503);
  }

  return successResponse(res, 'If the email exists, a verification code has been sent');
};

/**
 * @swagger
 * /auth/request-password-reset:
 *   post:
 *     summary: Request a password reset code sent via email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: Reset code sent if email exists
 *       400:
 *         description: Email is required
 */

export const requestPasswordReset = async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    return errorResponse(res, 'Email is required', 400);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return successResponse(res, 'If the email exists, a reset code will be sent');
  }

  const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

  const expiry = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.user.update({
    where: { email },
    data: {
      passwordResetCode: resetCode,
      passwordResetExpiry: expiry,
    },
  });

  try {
    await sendResetCodeEmail(user.email, resetCode);
  } catch (err) {
    console.error('Send reset code email error:', err);
    return errorResponse(res, 'Failed to send password reset email. Please try again later.', 503);
  }

  return successResponse(res, 'If the email exists, a reset code will be sent');
};

/**
 * @swagger
 * /auth/verify-email:
 *   post:
 *     summary: Verify user's email with a verification code
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - code
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               code:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid or expired verification code, or missing fields
 */

export const verifyEmail = async (req: Request, res: Response) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return errorResponse(res, 'Email and verification code are required', 400);
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (
    !user ||
    user.emailVerificationCode !== code ||
    !user.emailVerificationExpiry ||
    user.emailVerificationExpiry < new Date()
  ) {
    return errorResponse(res, 'Invalid or expired verification code', 400);
  }

  await prisma.user.update({
    where: { email },
    data: {
      emailVerified: new Date(),
      emailVerificationCode: null,
      emailVerificationExpiry: null,
    },
  });

  return successResponse(res, 'Email verified successfully');
};

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset user's password using reset code
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - resetCode
 *               - newPassword
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               resetCode:
 *                 type: string
 *                 example: "123456"
 *               newPassword:
 *                 type: string
 *                 example: NewPassword123
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid or expired reset code, missing fields, or password too short
 */
export const resetPassword = async (req: Request, res: Response) => {
  const { email, resetCode, newPassword } = req.body;

  if (!email || !resetCode || !newPassword) {
    return errorResponse(res, 'Email, reset code and new password are required', 400);
  }

  if (newPassword.length < 8) {
    return errorResponse(res, 'Password must be at least 8 characters long', 400);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (
    !user ||
    user.passwordResetCode !== resetCode ||
    !user.passwordResetExpiry ||
    user.passwordResetExpiry < new Date()
  ) {
    return errorResponse(res, 'Invalid or expired reset code', 400);
  }

  const hashedPassword = await hashPassword(newPassword);

  await prisma.user.update({
    where: { email },
    data: {
      password: hashedPassword,
      passwordResetCode: null,
      passwordResetExpiry: null,
    },
  });

  return successResponse(res, 'Password has been reset successfully');
};
