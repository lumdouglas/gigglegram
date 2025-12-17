import type { NextConfig } from "next";

const nextConfig = {
  // ... keep your other config (like images) here ...

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            // This is the "VIP List" for your browser
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https://*.supabase.co https://replicate.delivery; media-src 'self' https://replicate.delivery; connect-src 'self' https://*.supabase.co https://api.replicate.com;",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;