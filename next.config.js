/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'flagcdn.com' },
    ],
  },
  experimental: {
    staleTimes: {
      dynamic: 0,  // never serve dynamic pages from router cache
    },
  },
}

module.exports = nextConfig
