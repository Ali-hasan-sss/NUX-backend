-- CreateEnum
CREATE TYPE "public"."SubAdminPermissionType" AS ENUM ('MANAGE_USERS', 'MANAGE_PLANS', 'MANAGE_RESTAURANTS', 'MANAGE_SUBSCRIPTIONS');

-- AlterEnum
ALTER TYPE "public"."Role" ADD VALUE 'SUBADMIN';

-- CreateTable
CREATE TABLE "public"."SubAdmin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SubAdminPermission" (
    "id" SERIAL NOT NULL,
    "subAdminId" TEXT NOT NULL,
    "permission" "public"."SubAdminPermissionType" NOT NULL,

    CONSTRAINT "SubAdminPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubAdmin_userId_key" ON "public"."SubAdmin"("userId");

-- CreateIndex
CREATE INDEX "SubAdmin_addedByUserId_idx" ON "public"."SubAdmin"("addedByUserId");

-- CreateIndex
CREATE INDEX "SubAdminPermission_subAdminId_idx" ON "public"."SubAdminPermission"("subAdminId");

-- CreateIndex
CREATE UNIQUE INDEX "SubAdminPermission_subAdminId_permission_key" ON "public"."SubAdminPermission"("subAdminId", "permission");

-- AddForeignKey
ALTER TABLE "public"."SubAdmin" ADD CONSTRAINT "SubAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SubAdmin" ADD CONSTRAINT "SubAdmin_addedByUserId_fkey" FOREIGN KEY ("addedByUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SubAdminPermission" ADD CONSTRAINT "SubAdminPermission_subAdminId_fkey" FOREIGN KEY ("subAdminId") REFERENCES "public"."SubAdmin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
