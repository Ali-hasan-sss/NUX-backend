-- AlterTable
ALTER TABLE "public"."Gift" ADD COLUMN     "groupId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."Gift" ADD CONSTRAINT "Gift_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."RestaurantGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
