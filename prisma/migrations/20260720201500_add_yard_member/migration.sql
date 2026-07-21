-- CreateTable
CREATE TABLE "YardMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "yardId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'OWNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YardMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "YardMember_userId_yardId_key" ON "YardMember"("userId", "yardId");

-- CreateIndex
CREATE INDEX "YardMember_userId_idx" ON "YardMember"("userId");

-- AddForeignKey
ALTER TABLE "YardMember" ADD CONSTRAINT "YardMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YardMember" ADD CONSTRAINT "YardMember_yardId_fkey" FOREIGN KEY ("yardId") REFERENCES "Yard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill ownership rows for existing owners (one membership per owner's current yard).
INSERT INTO "YardMember" ("id", "userId", "yardId", "role", "createdAt")
SELECT gen_random_uuid()::text, "id", "yardId", 'OWNER', CURRENT_TIMESTAMP
FROM "User"
WHERE "yardId" IS NOT NULL AND "role" = 'OWNER'
ON CONFLICT ("userId", "yardId") DO NOTHING;
