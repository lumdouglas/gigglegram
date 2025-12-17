import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: ["rmbpncyftoyhueanjjaq.supabase.co", "replicate.delivery"],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            // ADDED 'https://replicate.delivery' to connect-src below 👇
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https://*.supabase.co https://replicate.delivery; media-src 'self' https://replicate.delivery; connect-src 'self' https://*.supabase.co https://api.replicate.com https://replicate.delivery;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;