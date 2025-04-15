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
    ignoreDuringBuilds: true,
    // ESLintの実行を無効化
    ignore: true
  }
}

module.exports = nextConfig 