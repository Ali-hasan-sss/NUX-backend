-- CreateEnum
CREATE TYPE "public"."WalletOwnerType" AS ENUM ('USER', 'RESTAURANT');

-- CreateEnum
CREATE TYPE "public"."WalletLedgerEntryType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "public"."WalletLedgerStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."WalletLedgerSource" AS ENUM ('STRIPE', 'PAYPAL', 'ORDER', 'WITHDRAWAL', 'ADMIN');

-- CreateEnum
CREATE TYPE "public"."WalletWithdrawalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateTable
CREATE TABLE "public"."Wallet" (
    "id" TEXT NOT NULL,
    "ownerType" "public"."WalletOwnerType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."wallet_transactions" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "public"."WalletLedgerEntryType" NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "status" "public"."WalletLedgerStatus" NOT NULL,
    "source" "public"."WalletLedgerSource" NOT NULL,
    "referenceId" TEXT,
    "metadata" JSONB,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WalletWithdrawal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" "public"."WalletWithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "accountInfo" JSONB,
    "adminId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletWithdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "ipAddress" TEXT,
    "deviceInfo" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Wallet_ownerId_idx" ON "public"."Wallet"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_ownerType_ownerId_key" ON "public"."Wallet"("ownerType", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_idempotencyKey_key" ON "public"."wallet_transactions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "wallet_transactions_walletId_idx" ON "public"."wallet_transactions"("walletId");

-- CreateIndex
CREATE INDEX "wallet_transactions_referenceId_idx" ON "public"."wallet_transactions"("referenceId");

-- CreateIndex
CREATE INDEX "wallet_transactions_createdAt_idx" ON "public"."wallet_transactions"("createdAt");

-- CreateIndex
CREATE INDEX "WalletWithdrawal_userId_idx" ON "public"."WalletWithdrawal"("userId");

-- CreateIndex
CREATE INDEX "WalletWithdrawal_status_idx" ON "public"."WalletWithdrawal"("status");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "public"."AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "public"."AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "public"."AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."wallet_transactions" ADD CONSTRAINT "wallet_transactions_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "public"."Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WalletWithdrawal" ADD CONSTRAINT "WalletWithdrawal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
