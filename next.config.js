const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // ビルド時の型チェックを無効化
    ignoreBuildErrors: true,
  },
  eslint: {
    // ビルド時のESLintチェックを無効化
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.plugins.push(
        new CopyPlugin({
          patterns: [
            {
              from: path.join(__dirname, 'node_modules/kuromoji/dict'),
              to: path.join(__dirname, 'public/kuromoji/dict'),
            },
          ],
        })
      );
    }
    return config;
  },
  serverExternalPackages: ['kuromoji'],
};

module.exports = nextConfig; 