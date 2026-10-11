-- AlterTable
ALTER TABLE "ClanEventActivity" ADD COLUMN     "durationMs" INTEGER,
ADD COLUMN     "isPb" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "party" JSONB;

