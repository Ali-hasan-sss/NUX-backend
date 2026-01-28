-- DropForeignKey
ALTER TABLE "public"."Gift" DROP CONSTRAINT "Gift_restaurantId_fkey";

-- AlterTable
ALTER TABLE "public"."Gift" ALTER COLUMN "restaurantId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."Gift" ADD CONSTRAINT "Gift_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "public"."Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
