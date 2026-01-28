/*
  Warnings:

  - The primary key for the `Ad` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Ad` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `Gift` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Gift` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `GroupJoinRequest` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `GroupJoinRequest` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `Notification` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Notification` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "public"."Ad" DROP CONSTRAINT "Ad_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "Ad_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."Gift" DROP CONSTRAINT "Gift_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "Gift_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."GroupJoinRequest" DROP CONSTRAINT "GroupJoinRequest_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "GroupJoinRequest_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."Notification" DROP CONSTRAINT "Notification_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "Notification_pkey" PRIMARY KEY ("id");
