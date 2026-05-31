import { parseLambdaJson } from './lambdaResponse'

const STATUS_REPORT_DIRECT =
  import.meta.env.VITE_DOCUMENT_STATUS_LAMBDA_URL?.trim() ||
  'https://fa4miq2mznezeapjo2xcfz5xw40chnnt.lambda-url.us-east-1.on.aws/'

const useProxy = import.meta.env.VITE_USE_LAMBDA_PROXY !== 'false'

export const STATUS_REPORT_URL = useProxy ? '/api/document-status' : STATUS_REPORT_DIRECT

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
export async function fetchDocumentStatusReport({ limit = 25, page = 0, lastEvaluatedKey = null } = {}) {
  const params = new URLSearchParams({ limit: String(limit), page: String(page) })

  if (lastEvaluatedKey) {
    params.set('lastEvaluatedKey', JSON.stringify(lastEvaluatedKey))
  }

  const url = `${STATUS_REPORT_URL}?${params.toString()}`

  let response
  try {
    response = await fetch(url, { method: 'GET' })
  } catch (error) {
    console.error('[StatusReport] Network error', error)
    throw new Error(
      'Could not reach document status service. Check Lambda Function URL and /api/document-status proxy.'
    )
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
 * Build pie chart segments from status distribution.
 */
export function buildStatusChartData(statusDistribution = {}) {
  const labelMap = {
    INDEXED: 'Completed',
    COMPLETED: 'Completed',
    PROCESSING: 'Processing',
    UPLOADED: 'Processing',
    FAILED: 'Failed',
  }

  const grouped = { Completed: 0, Processing: 0, Failed: 0, Other: 0 }

  for (const [status, count] of Object.entries(statusDistribution)) {
    const label = labelMap[String(status).toUpperCase()] || 'Other'
    grouped[label] += Number(count) || 0
  }

  return Object.entries(grouped)
    .filter(([, value]) => value > 0)
    .map(([label, value]) => ({ label, value }))
}
