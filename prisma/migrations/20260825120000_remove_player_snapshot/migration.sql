-- DropForeignKey
ALTER TABLE "PlayerSnapshot" DROP CONSTRAINT IF EXISTS "PlayerSnapshot_boardId_fkey";

-- DropTable
DROP TABLE IF EXISTS "PlayerSnapshot";
