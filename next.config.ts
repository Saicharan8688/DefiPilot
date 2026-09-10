import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    ignoreIssue: [
      // @coinbase/cdp-sdk (pulled in by RainbowKit's wallet registry) has
      // optional peer dependencies (@x402/*, @solana v1) that are not part of
      // our install. Those modules are only referenced from Coinbase smart
      // wallet / x402 payment flows that this app never uses.
      {
        path: /node_modules\/@coinbase\/cdp-sdk/,
      },
    ],
  },
};

// Basic hardening for the demo (safe defaults that don't break the app).
// A full CSP is omitted deliberately: Next.js/Turbopack inject inline
// scripts/styles, and a strict policy would do more harm for a judging demo.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const configWithHeaders: NextConfig = {
  ...nextConfig,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default configWithHeaders;