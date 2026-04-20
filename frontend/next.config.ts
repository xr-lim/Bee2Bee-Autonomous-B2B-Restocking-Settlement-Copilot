import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin the Turbopack workspace root to the frontend/ directory so Next.js
  // does not walk up and get confused by package.json files in the repo root
  // (backend/, db-init scripts, etc). Without this, Turbopack may pick the
  // monorepo root and blow up with "Fatal JavaScript out of memory" during
  // dependency deserialization.
  turbopack: {
    root: path.resolve(__dirname),
  },
  outputFileTracingRoot: path.resolve(__dirname),
};

export default nextConfig;
