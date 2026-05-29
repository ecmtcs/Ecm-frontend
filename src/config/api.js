/** AWS Lambda Function URLs — must be absolute https URLs */
const UPLOAD_URL =
  'https://trloz5caellu5a4odhzeyesl3y0zwxet.lambda-url.us-east-1.on.aws/'

const SEARCH_URL =
  'https://sdnh3b56ojmfasqplglv6w2ddy0ozvce.lambda-url.us-east-1.on.aws/'

function resolveUrl(envValue, fallback) {
  const value = (envValue || '').trim() || fallback
  if (!value.startsWith('http://') && !value.startsWith('https://')) {
    throw new Error(
      `Invalid Lambda URL "${value}". It must start with https:// (check .env or src/config/api.js).`
    )
  }
  return value
}

// Same-origin /api/upload: Vite proxy (dev) or vercel.json rewrites (prod). Avoids browser CORS to Lambda.
const useProxy = import.meta.env.VITE_USE_LAMBDA_PROXY !== 'false'

export const UPLOAD_LAMBDA_URL = useProxy
  ? '/api/upload'
  : resolveUrl(import.meta.env.VITE_UPLOAD_LAMBDA_URL, UPLOAD_URL)

// Search URL lives in src/utils/searchApi.js (hardcoded) to avoid stale env/cache issues.
export { SEARCH_LAMBDA_URL } from '../utils/searchApi.js'
export { DOCUMENT_PREVIEW_URL } from '../utils/documentApi.js'