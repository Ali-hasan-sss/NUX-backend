import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';

export const prisma = new PrismaClient();

// Logical function to update subscriptions
export async function checkAndUpdateSubscriptions() {
  console.log(' Checking subscriptions...');
  const now = new Date();

  // 1) Update expired subscriptions
  const expiredSubs = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      endDate: { lt: now },
    },
  });

  for (const sub of expiredSubs) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'EXPIRED' },
    });
  }

  // 2) For each restaurant, determine the farthest active subscription to be "current"
  const restaurants = await prisma.restaurant.findMany();

  for (const restaurant of restaurants) {
    // All currently active subscriptions for the restaurant
    const activeSubs = await prisma.subscription.findMany({
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
      await prisma.restaurant.update({
        where: { id: restaurant.id },
        data: {
          isActive: true,
          isSubscriptionActive: true,
        },
      });
    } else {
      await prisma.restaurant.update({
        where: { id: restaurant.id },
        data: {
          isActive: false,
          isSubscriptionActive: false,
        },
      });
    }
  }

  console.log(
    ` Checked ${expiredSubs.length} expired subscriptions and updated current subscriptions for ${restaurants.length} restaurants`,
  );
}

// Cron job (optional)
export function startSubscriptionChecker() {
  cron.schedule('0 * * * *', checkAndUpdateSubscriptions);
}
