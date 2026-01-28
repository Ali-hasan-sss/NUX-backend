/*
  Warnings:

  - A unique constraint covering the columns `[qrCode]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Made the column `qrCode` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "emailVerificationCode" TEXT,
ADD COLUMN     "emailVerificationExpiry" TIMESTAMP(3),
ADD COLUMN     "passwordResetCode" TEXT,
ADD COLUMN     "passwordResetExpiry" TIMESTAMP(3),
ALTER COLUMN "qrCode" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_qrCode_key" ON "public"."User"("qrCode");
