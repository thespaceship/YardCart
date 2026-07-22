-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "palletsPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "weightLbsPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "yardsPerUnit" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Truck" ADD COLUMN     "deliveryMethodId" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryAddOnsSnap" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "deliveryMethodId" TEXT,
ADD COLUMN     "deliveryMethodSnap" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "tripCount" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "DeliveryMethod" (
    "id" TEXT NOT NULL,
    "yardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "maxYards" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxWeightLbs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxPallets" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "allowMultipleTrips" BOOLEAN NOT NULL DEFAULT true,
    "quoteOnly" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryRate" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "methodId" TEXT NOT NULL,
    "feeCents" INTEGER NOT NULL,

    CONSTRAINT "DeliveryRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryAddOn" (
    "id" TEXT NOT NULL,
    "yardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "feeCents" INTEGER NOT NULL DEFAULT 0,
    "perTrip" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryAddOn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMethod" (
    "productId" TEXT NOT NULL,
    "methodId" TEXT NOT NULL,

    CONSTRAINT "ProductMethod_pkey" PRIMARY KEY ("productId","methodId")
);

-- CreateTable
CREATE TABLE "ProductAddOn" (
    "productId" TEXT NOT NULL,
    "addOnId" TEXT NOT NULL,

    CONSTRAINT "ProductAddOn_pkey" PRIMARY KEY ("productId","addOnId")
);

-- CreateIndex
CREATE INDEX "DeliveryMethod_yardId_idx" ON "DeliveryMethod"("yardId");

-- CreateIndex
CREATE INDEX "DeliveryRate_methodId_idx" ON "DeliveryRate"("methodId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryRate_zoneId_methodId_key" ON "DeliveryRate"("zoneId", "methodId");

-- CreateIndex
CREATE INDEX "DeliveryAddOn_yardId_idx" ON "DeliveryAddOn"("yardId");

-- CreateIndex
CREATE INDEX "ProductMethod_methodId_idx" ON "ProductMethod"("methodId");

-- CreateIndex
CREATE INDEX "ProductAddOn_addOnId_idx" ON "ProductAddOn"("addOnId");

-- AddForeignKey
ALTER TABLE "DeliveryMethod" ADD CONSTRAINT "DeliveryMethod_yardId_fkey" FOREIGN KEY ("yardId") REFERENCES "Yard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryRate" ADD CONSTRAINT "DeliveryRate_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryRate" ADD CONSTRAINT "DeliveryRate_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "DeliveryMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAddOn" ADD CONSTRAINT "DeliveryAddOn_yardId_fkey" FOREIGN KEY ("yardId") REFERENCES "Yard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMethod" ADD CONSTRAINT "ProductMethod_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMethod" ADD CONSTRAINT "ProductMethod_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "DeliveryMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAddOn" ADD CONSTRAINT "ProductAddOn_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAddOn" ADD CONSTRAINT "ProductAddOn_addOnId_fkey" FOREIGN KEY ("addOnId") REFERENCES "DeliveryAddOn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Truck" ADD CONSTRAINT "Truck_deliveryMethodId_fkey" FOREIGN KEY ("deliveryMethodId") REFERENCES "DeliveryMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryMethodId_fkey" FOREIGN KEY ("deliveryMethodId") REFERENCES "DeliveryMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: give every existing yard one unlimited delivery method. With no limits and no
-- DeliveryRate rows, the fee falls back to Zone.deliveryFeeCents x 1 trip — identical to the
-- pricing these yards have today. Nothing changes until an owner configures real methods.
INSERT INTO "DeliveryMethod" (
    "id", "yardId", "name", "description", "maxYards", "maxWeightLbs", "maxPallets",
    "allowMultipleTrips", "quoteOnly", "sortOrder", "active", "createdAt", "updatedAt"
)
SELECT gen_random_uuid()::text, y."id", 'Delivery',
       'Standard delivery. Set truck limits and per-zone pricing to offer more options.',
       0, 0, 0, true, false, 0, true, NOW(), NOW()
FROM "Yard" y;

-- Existing orders were delivered by that default method; label them so order history reads
-- consistently instead of showing a blank delivery method.
UPDATE "Order" o
SET "deliveryMethodId" = m."id", "deliveryMethodSnap" = m."name"
FROM "DeliveryMethod" m
WHERE m."yardId" = o."yardId" AND o."deliveryMethodId" IS NULL;

-- Point existing trucks at it too, so per-method capacity has somewhere to land.
UPDATE "Truck" t
SET "deliveryMethodId" = m."id"
FROM "DeliveryMethod" m
WHERE m."yardId" = t."yardId" AND t."deliveryMethodId" IS NULL;
