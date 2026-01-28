/*
  Warnings:

  - You are about to drop the column `planId` on the `Restaurant` table. All the data in the column will be lost.
  - You are about to drop the column `subscriptionActive` on the `Restaurant` table. All the data in the column will be lost.
  - You are about to drop the column `subscriptionExpiry` on the `Restaurant` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[currentSubscriptionId]` on the table `Restaurant` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'CANCELLED', 'EXPIRED');

-- DropForeignKey
ALTER TABLE "public"."Restaurant" DROP CONSTRAINT "Restaurant_planId_fkey";

-- AlterTable
ALTER TABLE "public"."Restaurant" DROP COLUMN "planId",
DROP COLUMN "subscriptionActive",
DROP COLUMN "subscriptionExpiry",
ADD COLUMN     "currentSubscriptionId" INTEGER;

-- CreateTable
CREATE TABLE "public"."Subscription" (
    "id" SERIAL NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "planId" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "public"."SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "paymentId" TEXT,
    "paymentMethod" TEXT,
    "transactionRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_currentSubscriptionId_key" ON "public"."Restaurant"("currentSubscriptionId");

-- AddForeignKey
ALTER TABLE "public"."Restaurant" ADD CONSTRAINT "Restaurant_currentSubscriptionId_fkey" FOREIGN KEY ("currentSubscriptionId") REFERENCES "public"."Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Subscription" ADD CONSTRAINT "Subscription_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "public"."Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
