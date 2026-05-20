/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['@react-pdf/renderer'],
    // Ensure Prisma native query engine is included in the standalone bundle
    outputFileTracingIncludes: {
      '/*': [
        './node_modules/.prisma/client/**',
        './node_modules/prisma/build/**',
      ],
    },
  },
}

module.exports = nextConfig
