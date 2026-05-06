-- AlterEnum
ALTER TYPE "public"."WalletLedgerSource" ADD VALUE 'COMPANY_ALLOWANCE_PAYOUT';

-- AlterEnum
ALTER TYPE "public"."WalletOwnerType" ADD VALUE 'COMPANY';

-- AlterTable
ALTER TABLE "public"."WalletWithdrawal" ADD COLUMN     "companyId" TEXT;

-- CreateIndex
CREATE INDEX "WalletWithdrawal_companyId_idx" ON "public"."WalletWithdrawal"("companyId");

-- AddForeignKey
ALTER TABLE "public"."WalletWithdrawal" ADD CONSTRAINT "WalletWithdrawal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
