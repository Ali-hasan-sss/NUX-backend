-- CreateEnum
CREATE TYPE "public"."PermissionType" AS ENUM ('MANAGE_MENU', 'MANAGE_QR_CODES', 'MANAGE_GROUPS', 'MANAGE_ADS', 'MANAGE_PACKAGES', 'CUSTOMER_LOYALTY', 'CUSTOMER_NOTIFICATIONS', 'CUSTOMER_GIFTS', 'VIEW_ANALYTICS', 'EXPORT_DATA', 'CUSTOM_BRANDING', 'API_ACCESS', 'MULTI_LOCATION', 'MAX_MENU_ITEMS', 'MAX_ADS', 'MAX_PACKAGES', 'MAX_GROUP_MEMBERS');

-- CreateTable
CREATE TABLE "public"."Permission" (
    "id" SERIAL NOT NULL,
    "type" "public"."PermissionType" NOT NULL,
    "value" INTEGER,
    "isUnlimited" BOOLEAN NOT NULL DEFAULT false,
    "planId" INTEGER NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Permission_planId_idx" ON "public"."Permission"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_planId_type_key" ON "public"."Permission"("planId", "type");

-- AddForeignKey
ALTER TABLE "public"."Permission" ADD CONSTRAINT "Permission_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
