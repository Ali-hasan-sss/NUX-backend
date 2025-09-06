"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const uuid_1 = require("uuid");
const token_1 = require("../src/utils/token");
const prisma = new client_1.PrismaClient();
async function main() {
    const email = 'admin@gmail.com';
    const password = 'Admin@123';
    const hashedPassword = await bcrypt_1.default.hash(password, 10);
    const qrCode = (0, uuid_1.v4)();
    let admin = await prisma.user.findUnique({ where: { email } });
    if (!admin) {
        admin = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                role: 'ADMIN',
                fullName: 'Super Admin',
                isActive: true,
                qrCode: qrCode,
            },
        });
        console.log('✅ Admin created:', admin.email);
    }
    else {
        console.log('⚠️ Admin already exists:', admin.email);
    }
    // توليد التوكينات وتحديث الريفريش توكن
    const accessToken = (0, token_1.generateAccessToken)({ userId: admin.id, role: 'ADMIN' });
    const refreshToken = (0, token_1.generateRefreshToken)({ userId: admin.id, role: 'ADMIN' });
    await prisma.user.update({
        where: { id: admin.id },
        data: { refreshToken },
    });
    //  console.log('🔑 Access Token:', accessToken);
    //  console.log('♻️ Refresh Token:', refreshToken);
    //create free plan
    const freePlanTitle = 'Free Trial';
    const freePlan = await prisma.plan.findFirst({
        where: { title: freePlanTitle },
    });
    if (!freePlan) {
        const createdPlan = await prisma.plan.create({
            data: {
                title: freePlanTitle,
                description: '7-day free trial plan',
                price: 0,
                duration: 7,
                isActive: true,
            },
        });
        console.log('✅ Free plan created:', createdPlan.title);
    }
    else {
        console.log('⚠️ Free plan already exists:', freePlan.title);
    }
}
main()
    .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map