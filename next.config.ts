import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @napi-rs/canvas ships a native .node addon; Next.js's bundler can't
  // process that, so it must run through plain Node `require` instead of
  // being bundled (unlike `canvas`, it isn't in Next's built-in externals
  // list yet).
  serverExternalPackages: ["@napi-rs/canvas"],
};

export default nextConfig;
