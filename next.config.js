/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'avatar.vercel.sh'
    ],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  swcMinify: true,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't attempt to load these modules on the client side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      }
    }
    return config
  },
}

module.exports = nextConfig 