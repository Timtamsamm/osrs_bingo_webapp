/**
 * Bootstrap the first admin account.
 *
 * Usage:
 *   npx tsx scripts/create-admin.ts <username> <password>
 *
 * Requires DATABASE_URL to be set in your environment or .env.local file.
 * Run from the project root.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const [, , rawUsername, password] = process.argv;
const username = rawUsername?.trim().toLowerCase();

if (!username || !password) {
  console.error("Usage: npx tsx scripts/create-admin.ts <username> <password>");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Create a .env.local file or export the variable.");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    if (existing.role === "ADMIN") {
      console.log(`Admin account "${username}" already exists.`);
    } else {
      await prisma.user.update({
        where: { username },
        data: { role: "ADMIN", passwordHash: await bcrypt.hash(password, 12) },
      });
      console.log(`Upgraded "${username}" to ADMIN and updated password.`);
    }
    return;
  }

  await prisma.user.create({
    data: {
      username,
      passwordHash: await bcrypt.hash(password, 12),
      role: "ADMIN",
    },
  });

  console.log(`Admin account "${username}" created successfully.`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
