-- CreateEnum
CREATE TYPE "LoyaltyScanApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "LoyaltyScanApproval" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "type" "scanType" NOT NULL,
    "qrCode" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "status" "LoyaltyScanApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyScanApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoyaltyScanApproval_restaurantId_status_idx" ON "LoyaltyScanApproval"("restaurantId", "status");

-- CreateIndex
CREATE INDEX "LoyaltyScanApproval_userId_status_idx" ON "LoyaltyScanApproval"("userId", "status");

-- CreateIndex
CREATE INDEX "LoyaltyScanApproval_expiresAt_idx" ON "LoyaltyScanApproval"("expiresAt");

-- AddForeignKey
ALTER TABLE "LoyaltyScanApproval" ADD CONSTRAINT "LoyaltyScanApproval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyScanApproval" ADD CONSTRAINT "LoyaltyScanApproval_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
