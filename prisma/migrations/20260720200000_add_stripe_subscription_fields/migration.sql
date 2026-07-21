-- AlterTable
ALTER TABLE "Yard" ADD COLUMN     "stripeSubscriptionId" TEXT;
ALTER TABLE "Yard" ADD COLUMN     "stripeCancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;
