-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "yardId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Category_yardId_idx" ON "Category"("yardId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_yardId_slug_key" ON "Category"("yardId", "slug");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_yardId_fkey" FOREIGN KEY ("yardId") REFERENCES "Yard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every existing yard gets the six built-in categories, so nothing changes for them
-- until they edit. gen_random_uuid() is used for ids (cuid is app-side only).
INSERT INTO "Category" ("id", "yardId", "slug", "label", "sortOrder", "active", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, y."id", d."slug", d."label", d."sortOrder", true, NOW(), NOW()
FROM "Yard" y
CROSS JOIN (VALUES
    ('mulch',    'Mulch',          0),
    ('soil',     'Topsoil & Soil', 10),
    ('compost',  'Compost',        20),
    ('stone',    'Stone & Gravel', 30),
    ('firewood', 'Firewood',       40),
    ('other',    'More',           50)
) AS d("slug", "label", "sortOrder")
ON CONFLICT ("yardId", "slug") DO NOTHING;

-- Backfill: any category value already in use that isn't one of the built-ins gets a row too,
-- so pre-existing products keep a named, editable section instead of falling back to the slug.
INSERT INTO "Category" ("id", "yardId", "slug", "label", "sortOrder", "active", "createdAt", "updatedAt")
SELECT DISTINCT gen_random_uuid()::text, p."yardId", p."category", INITCAP(REPLACE(p."category", '-', ' ')), 100, true, NOW(), NOW()
FROM "Product" p
WHERE p."category" <> ''
ON CONFLICT ("yardId", "slug") DO NOTHING;
