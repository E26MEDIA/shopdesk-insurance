import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Used when packaging the offline desktop app
  output: process.env.SHOPDESK_DESKTOP === "1" ? "standalone" : undefined,
};

export default nextConfig;
