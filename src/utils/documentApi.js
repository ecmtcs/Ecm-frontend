import { parseLambdaJson } from './lambdaResponse'

const DOCUMENT_PREVIEW_DIRECT =
  import.meta.env.VITE_DOCUMENT_PREVIEW_LAMBDA_URL?.trim() ||
  'https://43htd6x7vtya4cqd447tt4qpfq0pbjwk.lambda-url.us-east-1.on.aws/'

const useProxy = import.meta.env.VITE_USE_LAMBDA_PROXY !== 'false'

export const DOCUMENT_PREVIEW_URL = useProxy ? '/api/document' : DOCUMENT_PREVIEW_DIRECT

/**
 * Load document preview URL + full metadata from DynamoDB via Lambda.
 * @param {string} documentId
 */
export async function fetchDocumentPreview(documentId) {
  const id = String(documentId ?? '').trim()
  if (!id || id === '—') {
    throw new Error('Document ID is required.')
  }

  let response
  try {
    response = await fetch(DOCUMENT_PREVIEW_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: id }),
    })
  } catch {
    throw new Error(
      'Could not reach document preview service. Check Lambda Function URL and /api/document proxy.'
    )
  }

  const data = parseLambdaJson(await response.text(), response)

  if (!response.ok) {
    throw new Error(data?.error || `Preview failed (HTTP ${response.status}).`)
  }
  if (data?.error) {
    throw new Error(data.error)
  }
  if (!data?.previewUrl) {
    throw new Error('Preview URL was not returned.')
  }

  return {
    documentId: data.documentId ?? id,
    previewUrl: data.previewUrl,
    mimeType: data.mimeType ?? 'application/pdf',
    metadata: data.metadata ?? {},
    systemMetadata: data.systemMetadata,
    documentMetadata: data.documentMetadata,
  }
}
