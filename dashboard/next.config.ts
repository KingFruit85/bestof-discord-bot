import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The repo root has its own package-lock.json (the bot). Pin the root so
  // Next doesn't treat the whole repo as the workspace.
  turbopack: { root: path.resolve('.') },
};

export default nextConfig;
