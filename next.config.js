/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { nextRuntime }) => {
    if (nextRuntime === 'edge') {
      const webpack = require('webpack')
      config.plugins.push(
        new webpack.DefinePlugin({
          __dirname: JSON.stringify('/'),
        })
      )
    }
    return config
  },
}

module.exports = nextConfig
