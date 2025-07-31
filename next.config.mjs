/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['*'],
      bodySizeLimit: '2mb'
    }
  },
  eslint: {
    // ESLintエラーがあってもビルドを続行できるようにする
    ignoreDuringBuilds: true
  }
}

export default nextConfig; 