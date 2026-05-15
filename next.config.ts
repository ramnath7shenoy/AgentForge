import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@e2b/code-interpreter", "e2b", "undici"],
};

export default nextConfig;
