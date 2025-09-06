"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPassword = exports.verifyEmail = exports.requestPasswordReset = exports.sendVerificationCode = exports.refresh = exports.login = exports.registerRestaurant = exports.register = void 0;
const hash_1 = require("../../utils/hash");
const token_1 = require("../../utils/token");
const client_1 = require("@prisma/client");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const jwt_1 = require("../../config/jwt");
const uuid_1 = require("uuid");
const response_1 = require("../../utils/response");
const email_1 = require("../../utils/email");
const prisma = new client_1.PrismaClient();
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
 *         description: Validation error (missing fields or invalid format)
 *       409:
 *         description: Email already taken
 *       500:
 *         description: Server error
 */
const register = async (req, res) => {
    try {
        const { email, password, fullName } = req.body;
        if (!email || !password) {
            return (0, response_1.errorResponse)(res, 'Email and password are required', 400);
        }
        const strictEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!strictEmailRegex.test(email)) {
            return (0, response_1.errorResponse)(res, 'Invalid email format', 400);
        }
        if (password.length < 8) {
            return (0, response_1.errorResponse)(res, 'Password must be at least 8 characters long', 400);
        }
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return (0, response_1.errorResponse)(res, 'Email is already taken', 409);
        }
        const hashedPassword = await (0, hash_1.hashPassword)(password);
        const qrCode = (0, uuid_1.v4)();
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                fullName: fullName || null,
                role: client_1.Role.USER,
                qrCode,
            },
        });
        const refreshToken = (0, token_1.generateRefreshToken)({ userId: user.id, role: user.role });
        await prisma.user.update({
            where: { id: user.id },
            data: { refreshToken },
        });
        await (0, email_1.sendVerificationEmail)(user).catch(() => { });
        const accessToken = (0, token_1.generateAccessToken)({ userId: user.id, role: user.role });
        return (0, response_1.successResponse)(res, 'Account created successfully', {
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
        }, 201);
    }
    catch (error) {
        console.error('Register error:', error);
        return (0, response_1.errorResponse)(res, 'An unexpected error occurred', 500);
    }
};
exports.register = register;
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
 *         description: Validation error or missing fields
 *       409:
 *         description: Email already taken
 *       500:
 *         description: Server error
 */
const registerRestaurant = async (req, res) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    try {
        const { email, password, fullName, restaurantName, address, latitude, longitude } = req.body;
        if (!email ||
            !password ||
            !restaurantName ||
            !address ||
            latitude == null ||
            longitude == null) {
            return (0, response_1.errorResponse)(res, 'All fields are required', 400);
        }
        if (!emailRegex.test(email)) {
            return (0, response_1.errorResponse)(res, 'Invalid email format', 400);
        }
        const strictEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!strictEmailRegex.test(email)) {
            return (0, response_1.errorResponse)(res, 'Invalid email format', 400);
        }
        if (password.length < 8) {
            return (0, response_1.errorResponse)(res, 'Password must be at least 8 characters long', 400);
        }
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return (0, response_1.errorResponse)(res, 'Email is already taken', 409);
        }
        // hashing password
        const hashedPassword = await (0, hash_1.hashPassword)(password);
        const qrCode = (0, uuid_1.v4)();
        const qrCodeDrink = (0, uuid_1.v4)();
        const qrCodeMeal = (0, uuid_1.v4)();
        // get the free plan
        const freePlan = await prisma.plan.findFirst({
            where: { title: 'Free Trial', isActive: true },
        });
        if (!freePlan) {
            return (0, response_1.errorResponse)(res, 'Free trial plan is not available', 500);
        }
        // create user and restaurant and enable the free plan
        const result = await prisma.$transaction(async (prisma) => {
            const user = await prisma.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    fullName: fullName || null,
                    role: client_1.Role.RESTAURANT_OWNER,
                    qrCode,
                    isRestaurant: true,
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
            // create subscription in the free plan
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
            const refreshToken = (0, token_1.generateRefreshToken)({ userId: user.id, role: user.role });
            const accessToken = (0, token_1.generateAccessToken)({ userId: user.id, role: user.role });
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
        // data of subscription
        const subscriptionData = result.subscription
            ? {
                planName: result.subscription.plan.title,
                price: result.subscription.plan.price,
                endDate: result.subscription.endDate,
                status: result.subscription.status,
            }
            : null;
        return (0, response_1.successResponse)(res, 'Restaurant account created successfully with Free Trial plan', {
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
        }, 201);
    }
    catch (error) {
        console.error('Register restaurant error:', error);
        return (0, response_1.errorResponse)(res, 'An unexpected error occurred', 500);
    }
};
exports.registerRestaurant = registerRestaurant;
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
 *         description: Incorrect password
 *       403:
 *         description: Admins are not allowed on this route
 *       404:
 *         description: Email address not found
 *       500:
 *         description: Server error
 */
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return (0, response_1.errorResponse)(res, 'Email and password are required', 400);
        // 1) جيب المستخدم فقط (بدون include لعلاقات محذوفة)
        const user = await prisma.user.findUnique({
            where: { email },
        });
        if (!user)
            return (0, response_1.errorResponse)(res, 'Email address not found', 404);
        if (['ADMIN'].includes(user.role)) {
            return (0, response_1.errorResponse)(res, 'Admins cannot login from this route', 403);
        }
        // 2) تحقق كلمة المرور
        const isPasswordValid = await (0, hash_1.comparePassword)(password, user.password);
        if (!isPasswordValid)
            return (0, response_1.errorResponse)(res, 'Incorrect password', 401);
        // 3) اصنع التوكينات وخزّن refreshToken
        const accessToken = (0, token_1.generateAccessToken)({ userId: user.id, role: user.role });
        const refreshToken = (0, token_1.generateRefreshToken)({ userId: user.id, role: user.role });
        await prisma.user.update({ where: { id: user.id }, data: { refreshToken } });
        // 4) إن كان المستخدم صاحب مطعم، جيب المطعم واشتراكاته الفعالة
        let restaurantData = null;
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
        return (0, response_1.successResponse)(res, 'Login successful', {
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
    }
    catch (err) {
        console.log(err);
        return (0, response_1.errorResponse)(res, 'An unexpected error occurred', 500);
    }
};
exports.login = login;
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
const refresh = async (req, res) => {
    const { refreshToken } = req.body;
    //  console.log('Body:', req.body);
    if (!refreshToken) {
        return (0, response_1.errorResponse)(res, 'Refresh token is required', 401);
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(refreshToken, jwt_1.REFRESH_TOKEN_SECRET);
        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user || user.refreshToken !== refreshToken) {
            return (0, response_1.errorResponse)(res, 'Invalid refresh token', 403);
        }
        const newAccessToken = (0, token_1.generateAccessToken)({ userId: user.id, role: user.role });
        const newRefreshToken = (0, token_1.generateRefreshToken)({ userId: user.id, role: user.role });
        await prisma.user.update({
            where: { id: user.id },
            data: { refreshToken: newRefreshToken },
        });
        return (0, response_1.successResponse)(res, '', {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
        }, 200);
    }
    catch (error) {
        // console.error('Refresh token error:', error);
        return (0, response_1.errorResponse)(res, 'Invalid or expired refresh token', 403);
    }
};
exports.refresh = refresh;
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
const sendVerificationCode = async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return (0, response_1.errorResponse)(res, 'Email is required', 400);
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        return (0, response_1.successResponse)(res, 'If the email exists, a verification code has been sent');
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
        await (0, email_1.sendEmailVerificationCode)(email, code);
    }
    catch (err) {
        console.error(err);
    }
    return (0, response_1.successResponse)(res, 'If the email exists, a verification code has been sent');
};
exports.sendVerificationCode = sendVerificationCode;
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
const requestPasswordReset = async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return (0, response_1.errorResponse)(res, 'Email is required', 400);
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        return (0, response_1.successResponse)(res, 'If the email exists, a reset code will be sent');
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
        await (0, email_1.sendResetCodeEmail)(user.email, resetCode);
    }
    catch { }
    return (0, response_1.successResponse)(res, 'If the email exists, a reset code will be sent');
};
exports.requestPasswordReset = requestPasswordReset;
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
const verifyEmail = async (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) {
        return (0, response_1.errorResponse)(res, 'Email and verification code are required', 400);
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user ||
        user.emailVerificationCode !== code ||
        !user.emailVerificationExpiry ||
        user.emailVerificationExpiry < new Date()) {
        return (0, response_1.errorResponse)(res, 'Invalid or expired verification code', 400);
    }
    await prisma.user.update({
        where: { email },
        data: {
            emailVerified: new Date(),
            emailVerificationCode: null,
            emailVerificationExpiry: null,
        },
    });
    return (0, response_1.successResponse)(res, 'Email verified successfully');
};
exports.verifyEmail = verifyEmail;
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
const resetPassword = async (req, res) => {
    const { email, resetCode, newPassword } = req.body;
    if (!email || !resetCode || !newPassword) {
        return (0, response_1.errorResponse)(res, 'Email, reset code and new password are required', 400);
    }
    if (newPassword.length < 8) {
        return (0, response_1.errorResponse)(res, 'Password must be at least 8 characters long', 400);
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user ||
        user.passwordResetCode !== resetCode ||
        !user.passwordResetExpiry ||
        user.passwordResetExpiry < new Date()) {
        return (0, response_1.errorResponse)(res, 'Invalid or expired reset code', 400);
    }
    const hashedPassword = await (0, hash_1.hashPassword)(newPassword);
    await prisma.user.update({
        where: { email },
        data: {
            password: hashedPassword,
            passwordResetCode: null,
            passwordResetExpiry: null,
        },
    });
    return (0, response_1.successResponse)(res, 'Password has been reset successfully');
};
exports.resetPassword = resetPassword;
//# sourceMappingURL=auth.controller.js.map