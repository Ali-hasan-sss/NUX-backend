/*
  Warnings:

  - A unique constraint covering the columns `[transactionId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[paymentId]` on the table `Subscription` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Payment` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."InvoiceStatus" AS ENUM ('PENDING', 'PAID', 'UNPAID', 'CANCELLED', 'FAILED');

-- AlterTable
ALTER TABLE "public"."Payment" ADD COLUMN     "checkoutSessionId" TEXT,
ADD COLUMN     "currency" TEXT,
ADD COLUMN     "paymentIntentId" TEXT,
ADD COLUMN     "provider" TEXT DEFAULT 'stripe',
ADD COLUMN     "receiptUrl" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "public"."Plan" ADD COLUMN     "stripePriceId" TEXT,
ADD COLUMN     "stripeProductId" TEXT;

-- AlterTable
ALTER TABLE "public"."Restaurant" ADD COLUMN     "stripeCustomerId" TEXT;

-- AlterTable
ALTER TABLE "public"."Subscription" ADD COLUMN     "stripeCurrentPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "stripeCurrentPeriodStart" TIMESTAMP(3),
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripePriceId" TEXT,
ADD COLUMN     "stripePriceObject" JSONB,
ADD COLUMN     "stripeStatus" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT;

-- CreateTable
CREATE TABLE "public"."Invoice" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "subscriptionId" INTEGER,
    "stripeInvoiceId" TEXT,
    "hostedInvoiceUrl" TEXT,
    "pdfUrl" TEXT,
    "amountDue" DOUBLE PRECISION NOT NULL,
    "amountPaid" DOUBLE PRECISION,
    "currency" TEXT NOT NULL,
    "status" "public"."InvoiceStatus" NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paymentId" TEXT,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_stripeInvoiceId_key" ON "public"."Invoice"("stripeInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_paymentId_key" ON "public"."Invoice"("paymentId");

-- CreateIndex
CREATE INDEX "Invoice_restaurantId_createdAt_idx" ON "public"."Invoice"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "Invoice_subscriptionId_idx" ON "public"."Invoice"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_transactionId_key" ON "public"."Payment"("transactionId");

-- CreateIndex
CREATE INDEX "Payment_restaurantId_createdAt_idx" ON "public"."Payment"("restaurantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_paymentId_key" ON "public"."Subscription"("paymentId");

-- AddForeignKey
ALTER TABLE "public"."Subscription" ADD CONSTRAINT "Subscription_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "public"."Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "public"."Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
