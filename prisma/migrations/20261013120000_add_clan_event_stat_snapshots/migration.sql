-- CreateTable
CREATE TABLE "ClanEventStatSnapshot" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "rsn" TEXT NOT NULL,
    "rsnKey" TEXT NOT NULL,
    "baseline" JSONB,
    "baselineAt" TIMESTAMP(3),
    "final" JSONB,
    "finalAt" TIMESTAMP(3),
    "updateRequestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClanEventStatSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClanEventStatSnapshot_eventId_rsnKey_key" ON "ClanEventStatSnapshot"("eventId", "rsnKey");

-- AddForeignKey
ALTER TABLE "ClanEventStatSnapshot" ADD CONSTRAINT "ClanEventStatSnapshot_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ClanEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

