-- AlterTable
ALTER TABLE "BingoBoard" ADD COLUMN     "templeSnapshotTakenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TempleSnapshot" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "rsn" TEXT NOT NULL,
    "stats" JSONB NOT NULL,
    "collectionFinished" INTEGER NOT NULL DEFAULT 0,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TempleSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TempleSnapshot_boardId_rsn_key" ON "TempleSnapshot"("boardId", "rsn");

-- AddForeignKey
ALTER TABLE "TempleSnapshot" ADD CONSTRAINT "TempleSnapshot_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "BingoBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
