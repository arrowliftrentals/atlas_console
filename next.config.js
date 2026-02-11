/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,  // Disabled to prevent HMR WebSocket payload overflow
  poweredByHeader: false,
  // Empty turbopack config to silence warning (Turbopack works fine with no config)
  turbopack: {},
  // Increase WebSocket payload size limit for architecture graph data
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  env: {
    NEXT_PUBLIC_ATLAS_API_URL: process.env.NEXT_PUBLIC_ATLAS_API_URL || "http://127.0.0.1:8000"
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8000/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
