import type { NextConfig } from "next";

/**
 * STATIC_EXPORT=1 turns the build into a static export for GitHub Pages (see .github/workflows/pages.yml):
 * plain files under apps/docs/out, served beneath STATIC_BASE_PATH (the repository name on a project
 * site). Everything else (CI, the e2e suite, `next start`) keeps the server build, which a static export
 * cannot serve.
 */
const staticExport = process.env.STATIC_EXPORT === "1";
const basePath = staticExport ? (process.env.STATIC_BASE_PATH ?? "").replace(/\/$/, "") || undefined : undefined;

const nextConfig: NextConfig = {
  // Cache Components / partial prefetching enable PPR, which a static export cannot use; every route is
  // fully prerendered either way, so the export simply turns them off.
  cacheComponents: !staticExport,
  partialPrefetching: !staticExport,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  ...(staticExport
    ? {
        output: "export",
        basePath,
        // folder-per-route (components/field-magnet/index.html) so a static host needs no rewrite rules
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {
        async headers() {
          // Registry JSON is fetched by the shadcn CLI from any origin. (A static export cannot set headers;
          // GitHub Pages sends Access-Control-Allow-Origin: * on its own.)
          return [
            {
              source: "/r/:path*",
              headers: [
                { key: "Access-Control-Allow-Origin", value: "*" },
                { key: "Cache-Control", value: "public, max-age=300" },
              ],
            },
          ];
        },
      }),
};

export default nextConfig;
