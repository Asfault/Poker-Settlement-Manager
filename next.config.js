/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the workspace root. Without this, Turbopack can pick up a stray
  // package-lock.json further up the tree and infer the wrong root.
  turbopack: {
    root: __dirname,
  },
};

module.exports = nextConfig;
