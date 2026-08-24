-- AlterTable
ALTER TABLE "BingoBoard" ADD COLUMN     "dinkToken" TEXT;

-- AlterTable
ALTER TABLE "BingoTile" ADD COLUMN     "dinkItems" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "dinkItemId" INTEGER,
ADD COLUMN     "dinkItemName" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual',
ALTER COLUMN "imageUrl" DROP NOT NULL;
