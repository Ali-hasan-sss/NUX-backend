-- Nullable userId; optional restaurantId for restaurant wallet payout requests
ALTER TABLE "WalletWithdrawal" ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "WalletWithdrawal" ADD COLUMN "restaurantId" TEXT;

ALTER TABLE "WalletWithdrawal" ADD CONSTRAINT "WalletWithdrawal_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "WalletWithdrawal_restaurantId_idx" ON "WalletWithdrawal"("restaurantId");
