/*
  Warnings:

  - You are about to drop the column `currentSubscriptionId` on the `Restaurant` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Restaurant" DROP CONSTRAINT "Restaurant_currentSubscriptionId_fkey";

-- DropIndex
DROP INDEX "public"."Restaurant_currentSubscriptionId_key";

-- AlterTable
ALTER TABLE "public"."Restaurant" DROP COLUMN "currentSubscriptionId";
