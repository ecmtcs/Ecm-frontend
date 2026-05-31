import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const SEARCH_LAMBDA_TARGET =
  'https://sdnh3b56ojmfasqplglv6w2ddy0ozvce.lambda-url.us-east-1.on.aws'
const UPLOAD_LAMBDA_TARGET =
  'https://trloz5caellu5a4odhzeyesl3y0zwxet.lambda-url.us-east-1.on.aws'
const AI_SEARCH_LAMBDA_TARGET =
  'https://ypq6aalk4lulj23yfgxd34vx3q0ohqhp.lambda-url.us-east-1.on.aws'
// Set after deploying document-preview-lambda (Function URL)
const DOCUMENT_PREVIEW_LAMBDA_TARGET =
  process.env.VITE_DOCUMENT_PREVIEW_LAMBDA_URL ||
  'https://43htd6x7vtya4cqd447tt4qpfq0pbjwk.lambda-url.us-east-1.on.aws/'
const DOCUMENT_STATUS_LAMBDA_TARGET =
  process.env.VITE_DOCUMENT_STATUS_LAMBDA_URL ||
  'https://fa4miq2mznezeapjo2xcfz5xw40chnnt.lambda-url.us-east-1.on.aws/'

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
      '/api/ai-search': {
        target: AI_SEARCH_LAMBDA_TARGET,
        changeOrigin: true,
        secure: false,
        rewrite: () => '/',
      },
      '/api/document-status': {
        target: DOCUMENT_STATUS_LAMBDA_TARGET,
        changeOrigin: true,
        secure: false,
        rewrite: () => '/',
      },
      // Negative lookahead: match /api/document but NOT /api/document-status
      '^/api/document(?!-status)': {
        target: DOCUMENT_PREVIEW_LAMBDA_TARGET,
        changeOrigin: true,
        secure: false,
        rewrite: () => '/',
      },
    },
  },
})