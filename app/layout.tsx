import type { Metadata } from "next";
import { Geist, Geist_Mono, Cinzel } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import LeadColorAmbience from "@/app/components/LeadColorAmbience";
import PageFade from "@/app/components/PageFade";
import { computeStandings, type TierDef, type PointsConfig } from "@/lib/scoring";
import "./globals.css";

const getLeadingTeamColor = unstable_cache(
  async (): Promise<string> => {
    const [board, teams] = await Promise.all([
      prisma.bingoBoard.findFirst({
        where: { active: true },
        select: {
          rowColBonuses: true,
          size: true,
          scaleByTeamSize: true,
          tiles: {
            select: {
              id: true,
              position: true,
              title: true,
              scoringMode: true,
              tiers: true,
              pointsConfig: true,
              submissions: {
                where: { status: { not: "REJECTED" }, teamId: { not: null } },
                select: { teamId: true, status: true, tier: true, pointsAwarded: true, dinkItemId: true },
              },
            },
          },
        },
      }),
      prisma.team.findMany({ select: { id: true, name: true, color: true, _count: { select: { participants: true } } } }),
    ]);

    const rawBonuses = board?.rowColBonuses as { t1?: number; t2?: number; t3?: number } | null;
    const bonusConfig = { t1: rawBonuses?.t1 ?? 0, t2: rawBonuses?.t2 ?? 0, t3: rawBonuses?.t3 ?? 0 };
    const scoringTiles = (board?.tiles ?? []).map((t) => ({
      id: t.id,
      position: t.position,
      title: t.title,
      scoringMode: t.scoringMode as "TIERED" | "POINTS",
      tiers: (t.tiers as TierDef[]) ?? [],
      pointsConfig: t.pointsConfig as PointsConfig | null,
      submissions: t.submissions,
    }));

    const teamsForScoring = teams.map((t) => ({ id: t.id, name: t.name, color: t.color, size: t._count.participants }));
    const { standings } = computeStandings(scoringTiles, teamsForScoring, bonusConfig, board?.size ?? 5, board?.scaleByTeamSize ?? false);
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

const SITE_TITLE = "Wong Tongs";
const SITE_DESCRIPTION = "Wong Tongs clan hub — bingo, events, and member stats.";
const SITE_IMAGE = "/WONG_TONGS_2026_06_24_00_50_40_UTC.png";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.upthetongs.com"),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [SITE_IMAGE],
  },
  twitter: {
    card: "summary",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [SITE_IMAGE],
  },
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
