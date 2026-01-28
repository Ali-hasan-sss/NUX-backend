/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `Restaurant` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `type` on the `Gift` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `paymentType` on the `Purchase` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "public"."paymentType" AS ENUM ('balance', 'stars_meal', 'stars_drink');

-- DropForeignKey
ALTER TABLE "public"."Purchase" DROP CONSTRAINT "Purchase_restaurantId_fkey";

-- AlterTable
ALTER TABLE "public"."Gift" DROP COLUMN "type",
ADD COLUMN     "type" "public"."paymentType" NOT NULL;

-- AlterTable
ALTER TABLE "public"."Purchase" ADD COLUMN     "groupId" TEXT,
ALTER COLUMN "restaurantId" DROP NOT NULL,
DROP COLUMN "paymentType",
ADD COLUMN     "paymentType" "public"."paymentType" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_userId_key" ON "public"."Restaurant"("userId");

-- AddForeignKey
ALTER TABLE "public"."Purchase" ADD CONSTRAINT "Purchase_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "public"."Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Purchase" ADD CONSTRAINT "Purchase_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."RestaurantGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
