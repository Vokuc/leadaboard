import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
      },
      {
        protocol: 'https',
        hostname: 'ffhhjuraefjpvnurkqmt.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'lpumyabyytnyuzgmnqgq.supabase.co',
      },
    ],
  },
};

export default nextConfig;
