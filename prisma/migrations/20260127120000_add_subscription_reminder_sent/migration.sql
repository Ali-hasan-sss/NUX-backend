-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN "reminderSentAt30Days" TIMESTAMP(3),
ADD COLUMN "reminderSentAt3Days" TIMESTAMP(3);
