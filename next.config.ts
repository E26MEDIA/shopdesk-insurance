import type { NextConfig } from "next";

const isDesktop = process.env.SHOPDESK_DESKTOP === "1";

const nextConfig: NextConfig = {
  // Used when packaging the offline desktop app
  output: isDesktop ? "standalone" : undefined,
  // Avoid shipping platform-native sharp binaries in the Electron package
  images: isDesktop ? { unoptimized: true } : undefined,
  // Let the localhost preview open through public tunnels from this cloud VM.
  allowedDevOrigins: ["127.0.0.1", "*.trycloudflare.com", "*.lhr.life", "*.loca.lt"],
};

export default nextConfig;
