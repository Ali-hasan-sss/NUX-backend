-- CreateEnum
CREATE TYPE "public"."OrderType" AS ENUM ('ON_TABLE', 'TAKE_AWAY');

-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "orderType" "public"."OrderType" NOT NULL DEFAULT 'ON_TABLE';
