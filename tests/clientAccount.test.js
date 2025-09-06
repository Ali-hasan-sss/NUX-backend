"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// tests/clientAccount.test.ts
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../src/app"));
const client_1 = require("@prisma/client");
const hash_1 = require("../src/utils/hash");
const prisma = new client_1.PrismaClient();
jest.mock('../src/utils/email', () => ({
    sendVerificationEmail: jest.fn().mockResolvedValue(true),
    sendEmailVerificationCode: jest.fn().mockResolvedValue(true),
    sendResetCodeEmail: jest.fn().mockResolvedValue(true),
}));
describe('Client Account API', () => {
    let clientToken;
    let clientId;
    const clientPassword = 'Test@1234';
    const clientEmail = `tempuser${Date.now()}@example.com`;
    beforeAll(async () => {
        let user = await prisma.user.findUnique({ where: { email: clientEmail } });
        if (!user) {
            user = await prisma.user.create({
                data: {
                    email: clientEmail,
                    password: await (0, hash_1.hashPassword)(clientPassword),
                    fullName: 'Test User',
                    role: 'USER',
                    qrCode: `qr-${Date.now()}`,
                },
            });
        }
        clientId = user.id;
        const loginRes = await (0, supertest_1.default)(app_1.default)
            .post('/api/auth/login')
            .send({ email: clientEmail, password: clientPassword });
        clientToken = loginRes.body.data.tokens.accessToken;
    });
    afterAll(async () => {
        await prisma.user.deleteMany({ where: { email: clientEmail } });
    });
    test('GET /client/account/me - should get client profile', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .get('/api/client/account/me')
            .set('Authorization', `Bearer ${clientToken}`);
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.email).toBe(clientEmail);
    });
    test('PUT /client/account/me - should update fullName', async () => {
        const newName = `Updated Test User ${Date.now()}`;
        const res = await (0, supertest_1.default)(app_1.default)
            .put('/api/client/account/me')
            .set('Authorization', `Bearer ${clientToken}`)
            .send({ fullName: newName });
        if (res.statusCode !== 200) {
            console.log('Update fullName failed:', res.body);
        }
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.fullName).toBe(newName);
    });
    test('PUT /client/account/me - should update email and send verification', async () => {
        const newEmail = `updated${Date.now()}@example.com`;
        const res = await (0, supertest_1.default)(app_1.default)
            .put('/api/client/account/me')
            .set('Authorization', `Bearer ${clientToken}`)
            .send({ email: newEmail });
        if (res.statusCode !== 200) {
            console.log('Update email failed:', res.body);
        }
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.email).toBe(newEmail);
        expect(res.body.message).toContain('Please verify your new email');
        await prisma.user.update({
            where: { id: clientId },
            data: { email: clientEmail },
        });
    });
    test('PUT /client/account/me/change-password - should change password', async () => {
        const newPassword = 'NewPass@123';
        const res = await (0, supertest_1.default)(app_1.default)
            .put('/api/client/account/me/change-password')
            .set('Authorization', `Bearer ${clientToken}`)
            .send({ currentPassword: clientPassword, newPassword });
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        await prisma.user.update({
            where: { id: clientId },
            data: { password: await (0, hash_1.hashPassword)(clientPassword) },
        });
    });
    test('DELETE /client/account/me - should delete account with correct password', async () => {
        const clientEmail = `tempuser${Date.now()}@example.com`;
        const tempUser = await prisma.user.create({
            data: {
                email: clientEmail,
                password: await (0, hash_1.hashPassword)(clientPassword),
                fullName: 'Temp User',
                role: 'USER',
                qrCode: `qr-${Date.now()}`,
            },
        });
        const loginRes = await (0, supertest_1.default)(app_1.default)
            .post('/api/auth/login')
            .send({ email: clientEmail, password: clientPassword });
        const tempToken = loginRes.body.data.tokens.accessToken;
        const res = await (0, supertest_1.default)(app_1.default)
            .delete('/api/client/account/me')
            .set('Authorization', `Bearer ${tempToken}`)
            .send({ password: clientPassword });
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
    });
});
//# sourceMappingURL=clientAccount.test.js.map