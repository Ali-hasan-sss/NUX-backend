"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../src/app"));
const client_1 = require("@prisma/client");
jest.mock('../src/utils/email', () => ({
    sendVerificationEmail: jest.fn().mockResolvedValue(true),
    sendEmailVerificationCode: jest.fn().mockResolvedValue(true),
    sendResetCodeEmail: jest.fn().mockResolvedValue(true),
}));
describe('Security Tests for Auth Routes', () => {
    const userData = {
        email: `test121${Date.now()}@mail.com`,
        password: '12345678',
    };
    const restaurantData = {
        email: `testrestaurant${Date.now()}@mail.com`,
        password: '12345678',
        fullName: 'Restaurant Owner',
        restaurantName: 'Test Restaurant',
        address: '123 Food Street',
        latitude: 40.7128,
        longitude: -74.006,
        plan: 'base',
    };
    it('Should prevent registration with invalid email', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/auth/register')
            .send({ email: 'bademail', password: 'pass123' });
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });
    it('Should register a new user with valid data', async () => {
        const res = await (0, supertest_1.default)(app_1.default).post('/api/auth/register').send(userData);
        expect([200, 201]).toContain(res.status);
        expect(res.body.success).toBe(true);
    });
    it('Should send verification code if email exists', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/auth/send-verification-code')
            .send({ email: userData.email });
        console.log('Verification Code Response:', res.body); // Debug
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toMatch(/if the email exists, a verification code has been sent/i);
    }, 10000);
    it('Should fail to verify email with wrong code', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/auth/verify-email')
            .send({ email: userData.email, code: '000000' });
        console.log('Wrong Code Response:', res.body); // Debug
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });
    it('Should request password reset code if email exists', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/auth/request-password-reset')
            .send({ email: userData.email });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
    it('Should fail to reset password with wrong code', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/auth/reset-password')
            .send({ email: userData.email, resetCode: '000000', newPassword: 'newPass123' });
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });
    it('Should refresh access token with valid refresh token', async () => {
        const loginRes = await (0, supertest_1.default)(app_1.default).post('/api/auth/login').send(userData);
        const refreshToken = loginRes.body.data?.tokens?.refreshToken;
        const res = await (0, supertest_1.default)(app_1.default).post('/api/auth/refresh').send({ refreshToken });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
    it('Should reject refresh token if invalid', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/auth/refresh')
            .send({ refreshToken: 'invalid-token' });
        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
    });
    const Prisma = new client_1.PrismaClient();
    afterAll(async () => {
        await Prisma.$disconnect();
    });
});
//# sourceMappingURL=auth.security.test.js.map