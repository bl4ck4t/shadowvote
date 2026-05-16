import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  webpack(config) {
    config.resolve.alias['isomorphic-ws'] = path.resolve('./src/lib/isomorphic-ws-fix.mjs')
    config.resolve.fallback = { fs: false, net: false, tls: false, child_process: false }
    config.experiments = { asyncWebAssembly: true, topLevelAwait: true, layers: true }
    config.ignoreWarnings = [
      /The generated code contains.*async\/await/,
      /Critical dependency/,
    ]
    return config
  },
}

export default nextConfig
