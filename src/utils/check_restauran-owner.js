"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertOwnerOrAdmin = assertOwnerOrAdmin;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function assertOwnerOrAdmin(userId, restaurantId) {
    const restaurant = await prisma.restaurant.findFirst({
        where: { id: restaurantId },
        select: { userId: true },
    });
    if (!restaurant)
        return { ok: false, code: 404, msg: 'Restaurant not found' };
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user)
        return { ok: false, code: 401, msg: 'Unauthorized' };
    if (user.role === 'ADMIN' || restaurant.userId === userId)
        return { ok: true };
    return { ok: false, code: 403, msg: 'Forbidden' };
}
//# sourceMappingURL=check_restauran-owner.js.map