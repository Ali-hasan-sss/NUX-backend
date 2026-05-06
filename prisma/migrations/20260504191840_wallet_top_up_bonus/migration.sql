-- CreateEnum
CREATE TYPE "public"."WalletTopUpBonusType" AS ENUM ('PERCENTAGE', 'FIXED');

-- AlterEnum
ALTER TYPE "public"."WalletLedgerSource" ADD VALUE 'BONUS';

-- CreateTable
CREATE TABLE "public"."WalletTopUpBonusCampaign" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "minTopUpAmount" DECIMAL(18,4) NOT NULL,
    "bonusType" "public"."WalletTopUpBonusType" NOT NULL,
    "bonusValue" DECIMAL(18,4) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletTopUpBonusCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WalletTopUpBonusCampaign_startsAt_endsAt_idx" ON "public"."WalletTopUpBonusCampaign"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "WalletTopUpBonusCampaign_isActive_idx" ON "public"."WalletTopUpBonusCampaign"("isActive");

-- AddForeignKey
ALTER TABLE "public"."WalletTopUpBonusCampaign" ADD CONSTRAINT "WalletTopUpBonusCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
