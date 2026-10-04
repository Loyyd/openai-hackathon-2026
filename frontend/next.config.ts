import type { NextConfig } from 'next';
import path from 'node:path';

const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(__dirname, '..'),
  async rewrites() {
    return [{ source: '/backend/:path*', destination: `${backendUrl.replace(/\/$/, '')}/:path*` }];
  },
};

export default nextConfig;
