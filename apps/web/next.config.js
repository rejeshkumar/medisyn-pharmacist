const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development', // disable in dev to avoid noise
  runtimeCaching: [
    {
      // Cache API responses for medicine search
      urlPattern: /\/medicines\/search-enriched/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'medicine-search',
        expiration: { maxEntries: 100, maxAgeSeconds: 3600 },
      },
    },
    {
      // Cache static assets aggressively
      urlPattern: /\/_next\/static\/.*/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-assets',
        expiration: { maxEntries: 200, maxAgeSeconds: 86400 },
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: false },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },
};

module.exports = withPWA(nextConfig);
