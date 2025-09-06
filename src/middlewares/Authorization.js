"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyRestaurantOwnership = exports.isAdminMiddleware = void 0;
const response_1 = require("../utils/response");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const isAdminMiddleware = (req, res, next) => {
    const user = req.user;
    if (!user) {
        return (0, response_1.errorResponse)(res, 'Unauthorized', 401);
    }
    if (user.role !== 'ADMIN') {
        return (0, response_1.errorResponse)(res, 'Forbidden', 403);
    }
    next();
};
exports.isAdminMiddleware = isAdminMiddleware;
const verifyRestaurantOwnership = async (req, res, next) => {
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
        req.restaurant = restaurant;
        next();
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.verifyRestaurantOwnership = verifyRestaurantOwnership;
//# sourceMappingURL=Authorization.js.map