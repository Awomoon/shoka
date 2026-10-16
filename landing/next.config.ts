import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

// The site is served by GitHub Pages at https://awomoon.github.io/shoka/
// (project page), so every URL must be prefixed with /shoka and the build
// must be a fully static export that lands in ../docs.
const nextConfig: NextConfig = {
  output: "export",
  basePath: "/shoka",
  trailingSlash: true,
  images: { unoptimized: true },
  outputFileTracingRoot: fileURLToPath(new URL(".", import.meta.url)),
};

export default nextConfig;
