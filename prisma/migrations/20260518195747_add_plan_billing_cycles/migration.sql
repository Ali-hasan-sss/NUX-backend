-- AlterTable
ALTER TABLE "public"."Plan" ADD COLUMN     "annualPrice" DOUBLE PRECISION,
ADD COLUMN     "displayOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "monthlyPrice" DOUBLE PRECISION,
ADD COLUMN     "stripeAnnualPriceId" TEXT,
ADD COLUMN     "stripeMonthlyPriceId" TEXT;

-- AlterTable
ALTER TABLE "public"."Subscription" ADD COLUMN     "billingCycle" TEXT;
