-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Yard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "addressLine" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "zip" TEXT NOT NULL DEFAULT '',
    "aboutText" TEXT NOT NULL DEFAULT '',
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "minLeadDays" INTEGER NOT NULL DEFAULT 1,
    "maxAdvanceDays" INTEGER NOT NULL DEFAULT 30,
    "orderCutoffHour" INTEGER NOT NULL DEFAULT 15,
    "acceptOnlineOrders" BOOLEAN NOT NULL DEFAULT true,
    "paymentOnDelivery" BOOLEAN NOT NULL DEFAULT true,
    "plan" TEXT NOT NULL DEFAULT 'TRIAL',
    "planStatus" TEXT NOT NULL DEFAULT 'TRIALING',
    "trialEndsAt" DATETIME,
    "stripeCustomerId" TEXT,
    "onboardedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Yard" ("aboutText", "acceptOnlineOrders", "addressLine", "city", "createdAt", "email", "id", "maxAdvanceDays", "minLeadDays", "name", "onboardedAt", "orderCutoffHour", "paymentOnDelivery", "phone", "plan", "planStatus", "slug", "state", "stripeCustomerId", "trialEndsAt", "updatedAt", "zip") SELECT "aboutText", "acceptOnlineOrders", "addressLine", "city", "createdAt", "email", "id", "maxAdvanceDays", "minLeadDays", "name", "onboardedAt", "orderCutoffHour", "paymentOnDelivery", "phone", "plan", "planStatus", "slug", "state", "stripeCustomerId", "trialEndsAt", "updatedAt", "zip" FROM "Yard";
DROP TABLE "Yard";
ALTER TABLE "new_Yard" RENAME TO "Yard";
CREATE UNIQUE INDEX "Yard_slug_key" ON "Yard"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
