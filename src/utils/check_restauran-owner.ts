import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function assertOwnerOrAdmin(userId: string, restaurantId: string) {
  const restaurant = await prisma.restaurant.findFirst({
    where: { id: restaurantId },
    select: { userId: true },
  });
  if (!restaurant) return { ok: false, code: 404 as const, msg: 'Restaurant not found' };

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) return { ok: false, code: 401 as const, msg: 'Unauthorized' };

  if (user.role === 'ADMIN' || restaurant.userId === userId) return { ok: true as const };

  return { ok: false, code: 403 as const, msg: 'Forbidden' };
}
