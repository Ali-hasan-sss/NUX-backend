import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';
import { sendNotificationToUser } from '../services/notification.service';
import { sendSubscriptionReminderEmail } from '../utils/email';

export const prisma = new PrismaClient();

/** Subscriptions ending on the UTC day (today + daysOffset). Sends notification + email to owner, then marks reminder sent. */
async function sendRemindersForSubscriptionsEndingIn(daysOffset: number) {
  const now = new Date();
  const rangeStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysOffset, 0, 0, 0, 0),
  );
  const rangeEnd = new Date(rangeStart);
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1);

  const subs = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      endDate: { gte: rangeStart, lt: rangeEnd },
      ...(daysOffset === 30 ? { reminderSentAt30Days: null } : { reminderSentAt3Days: null }),
    },
    include: {
      restaurant: { include: { owner: true } },
      plan: true,
    },
  });

  const title =
    daysOffset === 30
      ? 'Subscription renewal reminder (30 days)'
      : 'Subscription renewal reminder (3 days)';
  const body =
    daysOffset === 30
      ? 'Your subscription will end in 30 days. Please renew to continue using all features.'
      : 'Your subscription will end in 3 days. Please renew to avoid service interruption.';

  for (const sub of subs) {
    const owner = sub.restaurant.owner;
    if (!owner?.email) continue;

    let notificationOk = false;
    try {
      await sendNotificationToUser({
        userId: owner.id,
        title,
        body,
        type: 'SUBSCRIPTION_REMINDER',
      });
      notificationOk = true;
    } catch (err) {
      console.error(`Subscription reminder notification failed (sub ${sub.id}):`, err);
    }

    try {
      await sendSubscriptionReminderEmail({
        to: owner.email,
        restaurantName: sub.restaurant.name,
        planName: sub.plan.title,
        endDate: sub.endDate,
        daysLeft: daysOffset,
      });
    } catch (err) {
      console.error(`Subscription reminder email failed (sub ${sub.id}):`, err);
    }

    // Mark reminder as sent only if notification succeeded (so we don't retry every hour if notification keeps failing)
    if (notificationOk) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data:
          daysOffset === 30
            ? { reminderSentAt30Days: new Date() }
            : { reminderSentAt3Days: new Date() },
      });
    }
  }

  return subs.length;
}

// Logical function to update subscriptions
export async function checkAndUpdateSubscriptions() {
  console.log(' Checking subscriptions...');
  const now = new Date();

  // 0) Send renewal reminders (30 days and 3 days before end) – notification + email in English
  try {
    const count30 = await sendRemindersForSubscriptionsEndingIn(30);
    const count3 = await sendRemindersForSubscriptionsEndingIn(3);
    if (count30 > 0 || count3 > 0) {
      console.log(` Sent subscription reminders: ${count30} (30-day), ${count3} (3-day)`);
    }
  } catch (err) {
    console.error('Subscription reminder job error:', err);
  }

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
