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
  outputFileTracingIncludes: {
    "**": ["./app/generated/prisma/**"],
  },
};

export default nextConfig;
