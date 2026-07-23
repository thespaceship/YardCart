/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Product photo uploads flow through a server action; phone photos can be several MB
    // before we compress them, so lift the default 1 MB body cap. processProductImage still
    // hard-rejects anything over 10 MB.
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
