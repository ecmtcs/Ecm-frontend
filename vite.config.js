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
const DOCUMENT_DELETE_LAMBDA_TARGET =
  process.env.VITE_DOCUMENT_DELETE_LAMBDA_URL ||
  'https://se7baow2x23g53ctwu6s75mo6y0qciyi.lambda-url.us-east-1.on.aws/'
// Set after deploying document-versions-lambda (Function URL)
const DOCUMENT_VERSIONS_LAMBDA_TARGET =
  process.env.VITE_DOCUMENT_VERSIONS_LAMBDA_URL ||
  'https://3kasyusjjzoo3runlrouojndve0exjbo.lambda-url.us-east-1.on.aws/'
// Set after deploying document-update-lambda (Function URL)
const DOCUMENT_UPDATE_LAMBDA_TARGET =
  process.env.VITE_DOCUMENT_UPDATE_LAMBDA_URL ||
  'https://ycle65oidker4ylrtlumirxk7y0ggjkx.lambda-url.us-east-1.on.aws/'

function rewriteApiPrefix(prefix) {
  return (path) => {
    const rewritten = path.replace(prefix, '') || '/'
    return rewritten.startsWith('?') ? `/${rewritten}` : rewritten
  }
}

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
        rewrite: rewriteApiPrefix(/^\/api\/search/),
      },
      '/api/upload': {
        target: UPLOAD_LAMBDA_TARGET,
        changeOrigin: true,
        secure: false,
        rewrite: rewriteApiPrefix(/^\/api\/upload/),
      },
      '/api/ai-search': {
        target: AI_SEARCH_LAMBDA_TARGET,
        changeOrigin: true,
        secure: false,
        rewrite: rewriteApiPrefix(/^\/api\/ai-search/),
      },
      '/api/document-status': {
        target: DOCUMENT_STATUS_LAMBDA_TARGET,
        changeOrigin: true,
        secure: false,
        rewrite: rewriteApiPrefix(/^\/api\/document-status/),
      },
      // Negative lookahead: match /api/document but NOT the more specific document-* routes
      '^/api/document(?!-status|-delete|-versions|-update)': {
        target: DOCUMENT_PREVIEW_LAMBDA_TARGET,
        changeOrigin: true,
        secure: false,
        rewrite: rewriteApiPrefix(/^\/api\/document/),
      },
      '/api/document-delete': {
        target: DOCUMENT_DELETE_LAMBDA_TARGET,
        changeOrigin: true,
        secure: false,
        rewrite: rewriteApiPrefix(/^\/api\/document-delete/),
      },
      '/api/document-versions': {
        target: DOCUMENT_VERSIONS_LAMBDA_TARGET,
        changeOrigin: true,
        secure: false,
        rewrite: rewriteApiPrefix(/^\/api\/document-versions/),
      },
      '/api/document-update': {
        target: DOCUMENT_UPDATE_LAMBDA_TARGET,
        changeOrigin: true,
        secure: false,
        rewrite: rewriteApiPrefix(/^\/api\/document-update/),
      },
    },
  },
})