-- CreateEnum
CREATE TYPE "public"."DiscountType" AS ENUM ('PERCENTAGE', 'AMOUNT');

-- AlterTable
ALTER TABLE "public"."MenuItem" ADD COLUMN     "allergies" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "calories" INTEGER,
ADD COLUMN     "discountType" "public"."DiscountType",
ADD COLUMN     "discountValue" DOUBLE PRECISION,
ADD COLUMN     "extras" JSONB,
ADD COLUMN     "kitchenSectionId" INTEGER,
ADD COLUMN     "preparationTime" INTEGER;

-- CreateTable
CREATE TABLE "public"."KitchenSection" (
    "id" SERIAL NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KitchenSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Table" (
    "id" SERIAL NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "qrCode" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSessionOpen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Table_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KitchenSection_restaurantId_idx" ON "public"."KitchenSection"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "KitchenSection_restaurantId_name_key" ON "public"."KitchenSection"("restaurantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Table_qrCode_key" ON "public"."Table"("qrCode");

-- CreateIndex
CREATE INDEX "Table_restaurantId_idx" ON "public"."Table"("restaurantId");

-- CreateIndex
CREATE INDEX "Table_qrCode_idx" ON "public"."Table"("qrCode");

-- CreateIndex
CREATE UNIQUE INDEX "Table_restaurantId_number_key" ON "public"."Table"("restaurantId", "number");

-- CreateIndex
CREATE INDEX "MenuItem_categoryId_idx" ON "public"."MenuItem"("categoryId");

-- CreateIndex
CREATE INDEX "MenuItem_kitchenSectionId_idx" ON "public"."MenuItem"("kitchenSectionId");

-- AddForeignKey
ALTER TABLE "public"."KitchenSection" ADD CONSTRAINT "KitchenSection_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "public"."Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MenuItem" ADD CONSTRAINT "MenuItem_kitchenSectionId_fkey" FOREIGN KEY ("kitchenSectionId") REFERENCES "public"."KitchenSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Table" ADD CONSTRAINT "Table_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "public"."Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
