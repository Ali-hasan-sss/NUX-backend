"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.checkAndUpdateSubscriptions = checkAndUpdateSubscriptions;
exports.startSubscriptionChecker = startSubscriptionChecker;
const client_1 = require("@prisma/client");
const node_cron_1 = __importDefault(require("node-cron"));
exports.prisma = new client_1.PrismaClient();
// Logical function to update subscriptions
async function checkAndUpdateSubscriptions() {
    console.log(' Checking subscriptions...');
    const now = new Date();
    // 1) Update expired subscriptions
    const expiredSubs = await exports.prisma.subscription.findMany({
        where: {
            status: 'ACTIVE',
            endDate: { lt: now },
        },
    });
    for (const sub of expiredSubs) {
        await exports.prisma.subscription.update({
            where: { id: sub.id },
            data: { status: 'EXPIRED' },
        });
    }
    // 2) For each restaurant, determine the farthest active subscription to be "current"
    const restaurants = await exports.prisma.restaurant.findMany();
    for (const restaurant of restaurants) {
        // All currently active subscriptions for the restaurant
        const activeSubs = await exports.prisma.subscription.findMany({
            where: {
                restaurantId: restaurant.id,
                status: 'ACTIVE',
                startDate: { lte: now },
                endDate: { gte: now },
            },
            orderBy: { endDate: 'desc' }, // Farthest expiration first
        });
        if (activeSubs.length > 0) {
            // No need to update a field that no longer exists
            await exports.prisma.restaurant.update({
                where: { id: restaurant.id },
                data: {
                    isActive: true,
                    isSubscriptionActive: true,
                },
            });
        }
        else {
            await exports.prisma.restaurant.update({
                where: { id: restaurant.id },
                data: {
                    isActive: false,
                    isSubscriptionActive: false,
                },
            });
        }
    }
    console.log(` Checked ${expiredSubs.length} expired subscriptions and updated current subscriptions for ${restaurants.length} restaurants`);
}
// Cron job (optional)
function startSubscriptionChecker() {
    node_cron_1.default.schedule('0 * * * *', checkAndUpdateSubscriptions);
}
//# sourceMappingURL=subscriptionChecker.js.map