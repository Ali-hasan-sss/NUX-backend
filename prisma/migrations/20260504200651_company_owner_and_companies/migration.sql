-- CreateEnum
CREATE TYPE "public"."CompanySubscriptionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "public"."Role" ADD VALUE 'COMPANY_OWNER';

-- AlterEnum
ALTER TYPE "public"."WalletLedgerSource" ADD VALUE 'COMPANY_ALLOWANCE';

-- CreateTable
CREATE TABLE "public"."Company" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxNumber" TEXT NOT NULL,
    "commercialRegister" TEXT NOT NULL,
    "reportedEmployeeCount" INTEGER NOT NULL DEFAULT 0,
    "monthlyAllowancePerEmployee" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "subscriptionPerEmployeeEur" DECIMAL(18,4) NOT NULL DEFAULT 1.75,
    "subscriptionStatus" "public"."CompanySubscriptionStatus" NOT NULL DEFAULT 'DRAFT',
    "stripeCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompanyEmployee" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompanyAllowanceMonth" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "employeeCount" INTEGER NOT NULL,
    "allowancePerEmployee" DECIMAL(18,4) NOT NULL,
    "totalAllowanceCredited" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "subscriptionFeeEur" DECIMAL(18,4) NOT NULL,
    "creditedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyAllowanceMonth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Company_ownerId_idx" ON "public"."Company"("ownerId");

-- CreateIndex
CREATE INDEX "CompanyEmployee_userId_idx" ON "public"."CompanyEmployee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyEmployee_companyId_userId_key" ON "public"."CompanyEmployee"("companyId", "userId");

-- CreateIndex
CREATE INDEX "CompanyAllowanceMonth_yearMonth_idx" ON "public"."CompanyAllowanceMonth"("yearMonth");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyAllowanceMonth_companyId_yearMonth_key" ON "public"."CompanyAllowanceMonth"("companyId", "yearMonth");

-- AddForeignKey
ALTER TABLE "public"."Company" ADD CONSTRAINT "Company_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyEmployee" ADD CONSTRAINT "CompanyEmployee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyEmployee" ADD CONSTRAINT "CompanyEmployee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyAllowanceMonth" ADD CONSTRAINT "CompanyAllowanceMonth_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
