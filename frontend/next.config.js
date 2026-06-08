/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:5000/api/:path*',
      },
    ];
  },
  images: {
    domains: ['cryptologos.cc', 'assets.coingecko.com', 'bin.bnbstatic.com'],
    unoptimized: true,
  },
};

module.exports = nextConfig;
