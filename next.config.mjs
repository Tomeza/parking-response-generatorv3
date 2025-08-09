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
  },
  // API routesのビルド時評価を無効化
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...config.externals, 'openai'];
    }
    return config;
  }
}

export default nextConfig; 