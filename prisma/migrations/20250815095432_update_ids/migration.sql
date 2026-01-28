/*
  Warnings:

  - The primary key for the `ScanLog` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `ScanLog` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `StarsTransaction` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `StarsTransaction` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `TopUp` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `TopUp` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `planId` column on the `TopUp` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `TopUpPackage` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `TopUpPackage` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- DropForeignKey
ALTER TABLE "public"."TopUp" DROP CONSTRAINT "TopUp_planId_fkey";

-- AlterTable
ALTER TABLE "public"."ScanLog" DROP CONSTRAINT "ScanLog_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "ScanLog_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."StarsTransaction" DROP CONSTRAINT "StarsTransaction_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "StarsTransaction_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."TopUp" DROP CONSTRAINT "TopUp_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "planId",
ADD COLUMN     "planId" INTEGER,
ADD CONSTRAINT "TopUp_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."TopUpPackage" DROP CONSTRAINT "TopUpPackage_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "TopUpPackage_pkey" PRIMARY KEY ("id");

-- AddForeignKey
ALTER TABLE "public"."TopUp" ADD CONSTRAINT "TopUp_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."TopUpPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
