import type { Metadata } from "next";
import { Geist, Geist_Mono, Cinzel } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import LeadColorAmbience from "@/app/components/LeadColorAmbience";
import PageFade from "@/app/components/PageFade";
import { computeStandings, type TierDef } from "@/lib/scoring";
import "./globals.css";

const getLeadingTeamColor = unstable_cache(
  async (): Promise<string> => {
    const [board, teams] = await Promise.all([
      prisma.bingoBoard.findFirst({
        where: { active: true },
        select: {
          rowColBonuses: true,
          size: true,
          tiles: {
            select: {
              id: true,
              position: true,
              title: true,
              tiers: true,
              submissions: {
                where: { status: { not: "REJECTED" }, teamId: { not: null } },
                select: { teamId: true, status: true, tier: true },
              },
            },
          },
        },
      }),
      prisma.team.findMany({ select: { id: true, name: true, color: true } }),
    ]);

    const rawBonuses = board?.rowColBonuses as { t1?: number; t2?: number; t3?: number } | null;
    const bonusConfig = { t1: rawBonuses?.t1 ?? 0, t2: rawBonuses?.t2 ?? 0, t3: rawBonuses?.t3 ?? 0 };
    const scoringTiles = (board?.tiles ?? []).map((t) => ({
      id: t.id,
      position: t.position,
      title: t.title,
      tiers: (t.tiers as TierDef[]) ?? [],
      submissions: t.submissions,
    }));

    const { standings } = computeStandings(scoringTiles, teams, bonusConfig, board?.size ?? 5);
    const leader = standings[0];
    if (!leader || leader.earnedPoints <= 0) return "#c9aa71"; // OSRS gold — default when no team leads
    return leader.color;
  },
  ["leading-team-color"],
  { revalidate: 30 }
);

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["700", "900"],
});

export const metadata: Metadata = {
  title: "OSRS Bingo",
  description: "Old School RuneScape bingo competition",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const leadColor = await getLeadingTeamColor();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${cinzel.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LeadColorAmbience color={leadColor} />
        <PageFade>{children}</PageFade>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
