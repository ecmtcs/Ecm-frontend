/**
 * Search Lambda URL.
 * Dev: Vite proxy `/api/search` → Lambda (no CORS issues).
 * Prod: direct Lambda Function URL.
 */
const SEARCH_LAMBDA_DIRECT =
  'https://sdnh3b56ojmfasqplglv6w2ddy0ozvce.lambda-url.us-east-1.on.aws/'

// Same-origin /api/search: Vite proxy (dev) or vercel.json rewrites (prod).
const useProxy = import.meta.env.VITE_USE_LAMBDA_PROXY !== 'false'

export const SEARCH_LAMBDA_URL = useProxy
  ? '/api/search'
  : SEARCH_LAMBDA_DIRECT

const SEARCH_FILTERS = new Set([
  'all',
  'DocumentType',
  'AccountNumber',
  'AccountHolderName',
  'Branch',
])

/**
 * Normalize a DynamoDB item for FileList display.
 */
export function normalizeSearchResult(item) {
  if (!item || typeof item !== 'object') return null

  const documentId =
    item.DocumentId ?? item.documentId ?? item.uuid ?? ''

  const filePath =
    item.FilePath ?? item.filePath ?? item.newS3Path ?? item.archivalFilePath ?? ''

  return {
    ...item,
    uuid: documentId,
    DocumentType: item.DocumentType ?? item.documentType ?? '',
    DocumentTitle: item.DocumentTitle ?? item.documentTitle ?? '',
    AccountNumber: item.AccountNumber ?? item.accountNumber ?? '',
    AccountHolderName:
      item.AccountHolderName ?? item.accountHolderName ?? '',
    Branch: item.Branch ?? item.branch ?? '',
    Creator: item.Creator ?? item.creator ?? '',
    CreatedDate: item.CreatedDate ?? item.createdDate ?? '',
    Size: item.Size ?? item.size ?? null,
    MimeType: item.MimeType ?? item.mimeType ?? '',
    archivalFilePath: filePath,
  }
}

function parseLambdaJson(rawText, response) {
  if (!rawText?.trim()) {
    const status = response?.status
    if (status === 502 || status === 504) {
      throw new Error(
        'Search proxy could not reach Lambda (SSL/network). Restart "npm run dev" after saving vite.config.js.'
      )
    }
    throw new Error(
      status
        ? `Empty response from search service (HTTP ${status}).`
        : 'Empty response from search service.'
    )
  }

  let parsed
  try {
    parsed = JSON.parse(rawText)
  } catch {
    throw new Error('Invalid JSON from search service.')
  }

  if (parsed && typeof parsed === 'object' && 'statusCode' in parsed && 'body' in parsed) {
    const statusCode = parsed.statusCode
    const inner =
      typeof parsed.body === 'string' ? JSON.parse(parsed.body) : parsed.body

    if (statusCode >= 400) {
      throw new Error(inner?.error || `Search failed (${statusCode}).`)
    }
    return inner
  }

  return parsed
}

/**
 * Search documents via the search Lambda (DynamoDB GSI: SearchPK-index).
 */
export async function searchDocuments({ query = '', filter = 'DocumentType' } = {}) {
  const trimmedQuery = String(query ?? '').trim()
  const normalizedFilter = SEARCH_FILTERS.has(filter) ? filter : 'DocumentType'

  if (!trimmedQuery) {
    throw new Error('Enter a search term.')
  }

  let response
  try {
    response = await fetch(SEARCH_LAMBDA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: trimmedQuery,
        filter: normalizedFilter,
      }),
    })
  } catch {
    throw new Error(
      'Could not reach the search API. Restart with "npm run dev" (uses /api/search proxy) or enable CORS on the Lambda Function URL in AWS.'
    )
  }

  const rawText = await response.text()
  const data = parseLambdaJson(rawText, response)

  if (!response.ok) {
    throw new Error(data?.error || `Search failed (${response.status}).`)
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  const rawResults = Array.isArray(data?.results) ? data.results : []
  const results = rawResults.map(normalizeSearchResult).filter(Boolean)

  return {
    results,
    count: typeof data?.count === 'number' ? data.count : results.length,
  }
}