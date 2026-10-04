import type { NextConfig } from 'next';

const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: '/backend/:path*', destination: `${backendUrl.replace(/\/$/, '')}/:path*` }];
  },
};

export default nextConfig;
