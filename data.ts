import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const localPrisma = new PrismaClient({
  datasources: { db: { url: process.env.LOCAL_DB_URL! } },
});

const remotePrisma = new PrismaClient({
  datasources: { db: { url: process.env.RAILWAY_DB_URL! } },
});

async function migrateData() {
  try {
    console.log('Migrating Users...');
    const users = await localPrisma.user.findMany();
    for (const user of users) {
      const { id, createdAt, updatedAt, ...rest } = user;

      await remotePrisma.user.create({
        data: {
          ...rest,
          id,
          createdAt,
          updatedAt: updatedAt ?? createdAt,
        },
      });
    }

    console.log('Migrating Restaurants...');
    const restaurants = await localPrisma.restaurant.findMany();
    for (const restaurant of restaurants) {
      const { id, createdAt, PayPal_Email, ...rest } = restaurant;

      await remotePrisma.restaurant.create({
        data: {
          ...rest,
          id,
          createdAt,
          PayPal_Email: restaurant.PayPal_Email ?? undefined,
        },
      });
    }

    console.log('Migrating Plans...');
    const plans = await localPrisma.plan.findMany();
    for (const plan of plans) {
      const { id, createdAt, updatedAt, ...rest } = plan;

      await remotePrisma.plan.create({
        data: {
          ...rest,
          id,
          createdAt,
          updatedAt: updatedAt ?? createdAt,
        },
      });
    }

    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await localPrisma.$disconnect();
    await remotePrisma.$disconnect();
  }
}

migrateData();
