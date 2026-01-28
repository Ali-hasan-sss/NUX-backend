-- CreateIndex
CREATE INDEX "Subscription_restaurantId_endDate_status_idx" ON "public"."Subscription"("restaurantId", "endDate", "status");
