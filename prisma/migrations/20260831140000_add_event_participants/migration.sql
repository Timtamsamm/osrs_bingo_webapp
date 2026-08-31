-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "participantNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
