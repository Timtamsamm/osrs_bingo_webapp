-- AlterTable
ALTER TABLE "BingoBoard" ADD COLUMN     "maxTeamSize" INTEGER NOT NULL DEFAULT 5;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "teamMembers" TEXT[] DEFAULT ARRAY[]::TEXT[];
