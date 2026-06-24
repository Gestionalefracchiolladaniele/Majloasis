/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // LinkedIn / Apify profile photos are served from arbitrary CDNs; allow remote.
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
};

export default nextConfig;
