import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { generateAccessToken, generateRefreshToken } from '../src/utils/token';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@gmail.com';
  const password = 'Admin@123';
  const hashedPassword = await bcrypt.hash(password, 10);
  const qrCode = uuidv4();

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
  } else {
    console.log('⚠️ Admin already exists:', admin.email);
  }

  // توليد التوكينات وتحديث الريفريش توكن
  const accessToken = generateAccessToken({ userId: admin.id, role: 'ADMIN' });
  const refreshToken = generateRefreshToken({ userId: admin.id, role: 'ADMIN' });

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
  } else {
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
