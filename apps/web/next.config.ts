import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Docker deployment (standalone output): only in Docker builds
  // to avoid Windows symlink permission issues during local dev
  output: process.env.DOCKER_BUILD === '1' ? 'standalone' : undefined,

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },

  // Allow GitHub avatars
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    ],
  },
}

export default nextConfig
