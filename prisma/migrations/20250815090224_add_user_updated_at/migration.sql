-- AlterTable
ALTER TABLE "public"."TopUp" ADD COLUMN     "planId" TEXT;

-- CreateTable
CREATE TABLE "public"."TopUpPackage" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "bonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopUpPackage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TopUpPackage_restaurantId_isActive_idx" ON "public"."TopUpPackage"("restaurantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TopUpPackage_restaurantId_name_key" ON "public"."TopUpPackage"("restaurantId", "name");

-- AddForeignKey
ALTER TABLE "public"."TopUpPackage" ADD CONSTRAINT "TopUpPackage_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "public"."Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TopUp" ADD CONSTRAINT "TopUp_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."TopUpPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
