import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "192.168.0.100",
    "localhost",
    "127.0.0.1",
    "192.168.*.*",
  ],
};

export default nextConfig;
