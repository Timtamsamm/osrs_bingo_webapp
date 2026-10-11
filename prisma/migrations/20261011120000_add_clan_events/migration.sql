-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "eventsWebhookToken" TEXT;

-- CreateTable
CREATE TABLE "ClanEvent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "joinPhrase" TEXT NOT NULL DEFAULT '!join',
    "bossFilter" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClanEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClanEventAttendee" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "rsn" TEXT NOT NULL,
    "rsnKey" TEXT NOT NULL,
    "via" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClanEventAttendee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClanEventActivity" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "rsn" TEXT NOT NULL,
    "rsnKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT,
    "killCount" INTEGER,
    "itemId" INTEGER,
    "itemName" TEXT,
    "quantity" INTEGER,
    "priceEach" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClanEventActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClanEventAttendee_eventId_rsnKey_key" ON "ClanEventAttendee"("eventId", "rsnKey");

-- CreateIndex
CREATE INDEX "ClanEventActivity_eventId_createdAt_idx" ON "ClanEventActivity"("eventId", "createdAt");

-- AddForeignKey
ALTER TABLE "ClanEventAttendee" ADD CONSTRAINT "ClanEventAttendee_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ClanEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClanEventActivity" ADD CONSTRAINT "ClanEventActivity_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ClanEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

