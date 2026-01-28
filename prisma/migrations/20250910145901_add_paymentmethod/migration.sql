-- AlterTable
ALTER TABLE "public"."Invoice" ADD COLUMN     "paymentMethod" TEXT;

-- AlterTable
ALTER TABLE "public"."Payment" ADD COLUMN     "paymentMethod" TEXT;
