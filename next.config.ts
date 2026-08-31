import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com",
      },
    ],
  },
  async redirects() {
    // Bingo used to live at the site root. Keep old bookmarks/links working
    // now that it's a subsection under /bingo.
    return [
      { source: "/board", destination: "/bingo/board", permanent: false },
      { source: "/teams", destination: "/bingo/teams", permanent: false },
      { source: "/team/:id", destination: "/bingo/team/:id", permanent: false },
      { source: "/players", destination: "/bingo/players", permanent: false },
      { source: "/leaderboard", destination: "/bingo/leaderboard", permanent: false },
      { source: "/admin", destination: "/bingo/admin", permanent: false },
      { source: "/admin/:path*", destination: "/bingo/admin/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
