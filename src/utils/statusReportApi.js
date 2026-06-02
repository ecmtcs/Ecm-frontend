import { parseLambdaJson } from './lambdaResponse'

const STATUS_REPORT_DIRECT =
  import.meta.env.VITE_DOCUMENT_STATUS_LAMBDA_URL?.trim() ||
  'https://fa4miq2mznezeapjo2xcfz5xw40chnnt.lambda-url.us-east-1.on.aws/'

const useProxy = import.meta.env.VITE_USE_LAMBDA_PROXY !== 'false'

export const STATUS_REPORT_URL = useProxy ? '/api/document-status' : STATUS_REPORT_DIRECT

const REQUEST_TIMEOUT_MS = 20000

function normalizeStatusRow(item) {
  if (!item || typeof item !== 'object') return null

  return {
    documentId: item.documentId ?? item.DocumentId ?? '—',
    filename: item.filename ?? item.OriginalFileName ?? '—',
    creator: item.creator ?? item.Creator ?? '—',
    date: item.date ?? '—',
    timestamp: item.timestamp ?? item.EventTime ?? '—',
    status: item.status ?? item.Status ?? 'UNKNOWN',
  }
}

function normalizeSummary(summary = {}) {
  return {
    totalFiles: Number(summary.totalFiles ?? 0),
    totalProcessing: Number(summary.totalProcessing ?? 0),
    totalCompleted: Number(summary.totalCompleted ?? 0),
    totalFailed: Number(summary.totalFailed ?? 0),
    statusDistribution: summary.statusDistribution ?? {},
  }
}

/**
 * Fetch paginated document status report (admin only — caller must verify role).
 */
export async function fetchDocumentStatusReport({
  limit = 25,
  page = 0,
  lastEvaluatedKey = null,
  all = false,
} = {}) {
  const params = new URLSearchParams({ limit: String(limit), page: String(page) })

  if (all) {
    params.set('all', 'true')
  }

  if (lastEvaluatedKey) {
    params.set('lastEvaluatedKey', JSON.stringify(lastEvaluatedKey))
  }

  const url = `${STATUS_REPORT_URL}?${params.toString()}`
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let response
  try {
    response = await fetch(url, { method: 'GET', signal: controller.signal })
  } catch (error) {
    console.error('[StatusReport] Network error', error)
    if (error?.name === 'AbortError') {
      throw new Error('Document status service timed out. Please retry.')
    }
    throw new Error(
      'Could not reach document status service. Check Lambda Function URL and /api/document-status proxy.'
    )
  } finally {
    window.clearTimeout(timeoutId)
  }

  const rawText = await response.text()
  const data = parseLambdaJson(rawText, response)

  if (!response.ok) {
    throw new Error(data?.error || `Status report failed (HTTP ${response.status}).`)
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  const items = Array.isArray(data.items)
    ? data.items.map(normalizeStatusRow).filter(Boolean)
    : []

  return {
    items,
    count: Number(data.count ?? items.length),
    totalCount: Number(data.totalCount ?? items.length),
    page: Number(data.page ?? page),
    hasMore: Boolean(data.hasMore),
    lastEvaluatedKey: data.lastEvaluatedKey ?? null,
    summary: normalizeSummary(data.summary),
  }
}

/**
 * Fetch all pages for the status report so client-side filtering/sorting can
 * operate on the complete dataset.
 */
export async function fetchAllDocumentStatusRecords({ pageSize = 100, maxPages = 1000 } = {}) {
  const firstResponse = await fetchDocumentStatusReport({
    limit: pageSize,
    page: 0,
    all: true,
  })

  if (!firstResponse.hasMore || firstResponse.items.length >= firstResponse.totalCount) {
    return {
      items: firstResponse.items,
      summary: firstResponse.summary,
    }
  }

  const allItems = []
  let page = 0
  let hasMore = true
  let summary = firstResponse.summary
  let lastEvaluatedKey = null

  while (hasMore && page < maxPages) {
    const response = await fetchDocumentStatusReport({
      limit: pageSize,
      page,
      lastEvaluatedKey,
    })

    if (!summary) {
      summary = response.summary
    }

    allItems.push(...response.items)
    hasMore = response.hasMore
    lastEvaluatedKey = response.lastEvaluatedKey
    page += 1
  }

  if (page >= maxPages && hasMore) {
    throw new Error('Status report pagination exceeded safe limit. Please narrow the dataset.')
  }

  return {
    items: allItems,
    summary: summary || normalizeSummary(),
  }
}

/**
 * Build pie chart segments from status distribution.
 */
// export function buildStatusChartData(statusDistribution = {}) {
//   const labelMap = {
//     INDEXED: 'Indexed',
//     // COMPLETED: 'Completed',
//     PROCESSING: 'Processing',
//     UPLOADED: 'Uploaded',
//     FAILED: 'Failed',
//   }
export function buildStatusChartData(statusDistribution = {}) {
  return [
    {
      label: 'INDEXED',
      value: Number(statusDistribution.INDEXED || 0),
      color: '#10b981',
    },
    {
      label: 'PROCESSING',
      value: Number(statusDistribution.PROCESSING || 0),
      color: '#3b82f6',
    },
    {
      label: 'UPLOADED',
      value: Number(statusDistribution.UPLOADED || 0),
      color: '#f59e0b',
    },
    {
      label: 'FAILED',
      value: Number(statusDistribution.FAILED || 0),
      color: '#ef4444',
    },
  ]


  const grouped = { Indexed: 0, Processing: 0, Failed: 0, Other: 0 }

  for (const [status, count] of Object.entries(statusDistribution)) {
    const label = labelMap[String(status).toUpperCase()] || 'Other'
    grouped[label] += Number(count) || 0
  }

  return Object.entries(grouped)
    .filter(([, value]) => value > 0)
    .map(([label, value]) => ({ label, value }))
}
