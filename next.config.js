/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['clawgame.io'],
  },
  async headers() {
    return [
      {
        source: '/skill.md',
        headers: [
          {
            key: 'Content-Type',
            value: 'text/markdown',
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
