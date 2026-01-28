/*
  Warnings:

  - The `plan` column on the `Restaurant` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "public"."Plan" AS ENUM ('base', 'pro');

-- AlterTable
ALTER TABLE "public"."Restaurant" ADD COLUMN     "subscriptionActive" BOOLEAN NOT NULL DEFAULT false,
DROP COLUMN "plan",
ADD COLUMN     "plan" "public"."Plan" NOT NULL DEFAULT 'base';
