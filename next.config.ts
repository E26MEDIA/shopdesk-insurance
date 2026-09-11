import type { NextConfig } from "next";

const isDesktop = process.env.SHOPDESK_DESKTOP === "1";

const nextConfig: NextConfig = {
  // Used when packaging the offline desktop app
  output: isDesktop ? "standalone" : undefined,
  // Avoid shipping platform-native sharp binaries in the Electron package
  images: isDesktop ? { unoptimized: true } : undefined,
  // Let the localhost preview open through a Cloudflare tunnel from this cloud VM.
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;
