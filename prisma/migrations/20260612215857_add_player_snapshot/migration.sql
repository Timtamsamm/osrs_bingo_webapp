-- AlterTable
ALTER TABLE "BingoBoard" ALTER COLUMN "maxTeamSize" SET DEFAULT 10;

-- CreateTable
CREATE TABLE "PlayerSnapshot" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "memberName" TEXT NOT NULL,
    "bosses" JSONB NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlayerSnapshot_boardId_memberName_key" ON "PlayerSnapshot"("boardId", "memberName");

-- AddForeignKey
ALTER TABLE "PlayerSnapshot" ADD CONSTRAINT "PlayerSnapshot_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "BingoBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
