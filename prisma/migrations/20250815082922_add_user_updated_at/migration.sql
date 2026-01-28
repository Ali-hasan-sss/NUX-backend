/*
  Warnings:

  - A unique constraint covering the columns `[qrCode_drink]` on the table `Restaurant` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[qrCode_meal]` on the table `Restaurant` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,restaurantId]` on the table `UserRestaurantBalance` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."scanType" AS ENUM ('drink', 'meal');

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "public"."ScanLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "type" "public"."scanType" NOT NULL,
    "qrCode" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScanLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StarsTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "type" "public"."scanType" NOT NULL,
    "stars_drink" INTEGER NOT NULL DEFAULT 0,
    "stars_meal" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StarsTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_qrCode_drink_key" ON "public"."Restaurant"("qrCode_drink");

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_qrCode_meal_key" ON "public"."Restaurant"("qrCode_meal");

-- CreateIndex
CREATE UNIQUE INDEX "UserRestaurantBalance_userId_restaurantId_key" ON "public"."UserRestaurantBalance"("userId", "restaurantId");

-- AddForeignKey
ALTER TABLE "public"."ScanLog" ADD CONSTRAINT "ScanLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScanLog" ADD CONSTRAINT "ScanLog_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "public"."Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StarsTransaction" ADD CONSTRAINT "StarsTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StarsTransaction" ADD CONSTRAINT "StarsTransaction_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "public"."Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
