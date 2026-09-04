-- AlterTable
ALTER TABLE "BingoTile" ADD COLUMN     "scoringMode" TEXT NOT NULL DEFAULT 'TIERED';
ALTER TABLE "BingoTile" ADD COLUMN     "pointsConfig" JSONB;

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "pointsAwarded" DOUBLE PRECISION;
