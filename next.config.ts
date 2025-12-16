import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* KEEP any existing config here (like images: {}, etc.) 
     ONLY add or replace the async headers() block below.
  */

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            // CRITICAL FIX: Added 'unsafe-eval' to script-src
            // CRITICAL FIX: Added Supabase/Replicate domains to connect-src/img-src
            value: `
              default-src 'self'; 
              script-src 'self' 'unsafe-eval' 'unsafe-inline' https://va.vercel-scripts.com; 
              style-src 'self' 'unsafe-inline'; 
              img-src 'self' blob: data: https://*.supabase.co; 
              connect-src 'self' https://*.supabase.co https://api.replicate.com;
            `.replace(/\s{2,}/g, ' ').trim() // Cleans up newlines for the header
          },
        ],
      },
    ];
  },
};

export default nextConfig;