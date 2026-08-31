import { prisma } from "@/lib/prisma";

const SETTINGS_ID = "settings";

export async function getSettings() {
  return prisma.settings.findUnique({ where: { id: SETTINGS_ID } });
}

export async function updateSettings(data: { discordWebhookUrl?: string | null }) {
  return prisma.settings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...data },
    update: data,
  });
}
