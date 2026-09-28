import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The model artefacts are read from disk at runtime; list them so Vercel
  // bundles them with the route functions. Goldens and the .cbm are test/
  // Python-only and deliberately excluded.
  outputFileTracingIncludes: {
    "/api/v1/predictions/crop": ["./artifacts/crop-manifest.json", "./artifacts/crop-catboost.model.json"],
    "/api/v1/predictions/irrigation": ["./artifacts/irrigation-manifest.json", "./artifacts/irrigation-xgboost.model.json"],
    "/api/v1/model-metadata": ["./artifacts/*-manifest.json", "./artifacts/*.model.json"],
    "/api/v1/readiness": ["./artifacts/*-manifest.json", "./artifacts/*.model.json"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    // Next 16 defaults this to [75] and silently coerces any other `quality`
    // prop to the nearest allowed value. 70 is the value the decorative
    // photographs use, chosen to cut page weight on low-bandwidth connections.
    qualities: [70, 75],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
