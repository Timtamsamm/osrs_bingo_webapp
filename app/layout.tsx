import type { Metadata } from "next";
import { Geist, Geist_Mono, Cinzel } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import LeadColorAmbience from "@/app/components/LeadColorAmbience";
import "./globals.css";

const getLeadingTeamColor = unstable_cache(
  async (): Promise<string> => {
    const [teams, topGroup] = await Promise.all([
      prisma.team.findMany({ select: { id: true, color: true } }),
      prisma.submission.groupBy({
        by: ["teamId"],
        where: { status: "APPROVED", teamId: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 1,
      }),
    ]);

    const leadingId = topGroup[0]?.teamId;
    if (!leadingId) return "#c9aa71"; // OSRS gold — default when no team leads
    return teams.find((t) => t.id === leadingId)?.color ?? "#c9aa71";
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
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
