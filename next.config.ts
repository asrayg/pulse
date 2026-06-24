import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 / pg are native/node-only — keep them external to the bundle.
  serverExternalPackages: ["better-sqlite3", "pg"],
  // Pin the workspace root to this project (multiple lockfiles exist on the machine).
  turbopack: { root: import.meta.dirname },
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
