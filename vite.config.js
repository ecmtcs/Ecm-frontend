import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const SEARCH_LAMBDA_TARGET =
  'https://sdnh3b56ojmfasqplglv6w2ddy0ozvce.lambda-url.us-east-1.on.aws'
const UPLOAD_LAMBDA_TARGET =
  'https://trloz5caellu5a4odhzeyesl3y0zwxet.lambda-url.us-east-1.on.aws'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5176,
    strictPort: false,
    headers: {
      'Cache-Control': 'no-store',
    },
    proxy: {
      // Proxies to Lambda; secure:false fixes "unable to get local issuer certificate" on some networks
      '/api/search': {
        target: SEARCH_LAMBDA_TARGET,
        changeOrigin: true,
        secure: false,
        rewrite: () => '/',
      },
      '/api/upload': {
        target: UPLOAD_LAMBDA_TARGET,
        changeOrigin: true,
        secure: false,
        rewrite: () => '/',
      },
    },
  },
})