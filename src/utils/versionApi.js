import { parseLambdaJson } from './lambdaResponse'

const DOCUMENT_VERSIONS_DIRECT =
  import.meta.env.VITE_DOCUMENT_VERSIONS_LAMBDA_URL?.trim() ||
  'https://3kasyusjjzoo3runlrouojndve0exjbo.lambda-url.us-east-1.on.aws/'

const useProxy = import.meta.env.VITE_USE_LAMBDA_PROXY !== 'false'

export const DOCUMENT_VERSIONS_URL = useProxy
  ? '/api/document-versions'
  : DOCUMENT_VERSIONS_DIRECT

async function requestVersions(payload) {
  let response
  try {
    response = await fetch(DOCUMENT_VERSIONS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new Error(
      'Could not reach version service. Deploy document-versions-lambda and configure /api/document-versions proxy.'
    )
  }

  const data = parseLambdaJson(await response.text(), response)

  if (!response.ok) {
    throw new Error(data?.error || `Version request failed (HTTP ${response.status}).`)
  }
  if (data?.error) {
    throw new Error(data.error)
  }

  return {
    documentId: data.documentId,
    key: data.key,
    versions: Array.isArray(data.versions) ? data.versions : [],
    uploadUrl: data.uploadUrl,
    contentType: data.contentType,
    expiresIn: data.expiresIn,
  }
}

/** List all S3 versions of a document (newest first). */
export function fetchDocumentVersions(documentId) {
  const id = String(documentId ?? '').trim()
  if (!id || id === '—') {
    throw new Error('Document ID is required.')
  }
  return requestVersions({ documentId: id, action: 'list' })
}

/** Make a specific version the current/active version. */
export function promoteDocumentVersion(documentId, versionId) {
  const id = String(documentId ?? '').trim()
  const version = String(versionId ?? '').trim()
  if (!id || id === '—') {
    throw new Error('Document ID is required.')
  }
  if (!version) {
    throw new Error('Version ID is required.')
  }
  return requestVersions({ documentId: id, action: 'promote', versionId: version })
}

/** Roll the current version back to the immediately previous version. */
export function demoteDocumentVersion(documentId) {
  const id = String(documentId ?? '').trim()
  if (!id || id === '—') {
    throw new Error('Document ID is required.')
  }
  return requestVersions({ documentId: id, action: 'demote' })
}

const MAX_UPGRADE_BYTES = 5 * 1024 * 1024

/**
 * Upload a replacement file via the version API proxy (no direct S3 CORS).
 * @param {string} documentId
 * @param {File} file
 */
export async function upgradeDocumentVersion(documentId, file) {
  const id = String(documentId ?? '').trim()
  if (!id || id === '—') {
    throw new Error('Document ID is required.')
  }
  if (!file) {
    throw new Error('Choose a file to upload.')
  }
  if (file.size > MAX_UPGRADE_BYTES) {
    throw new Error(`File must be ${MAX_UPGRADE_BYTES / (1024 * 1024)} MB or smaller.`)
  }

  const contentType = file.type || 'application/octet-stream'

  let response
  try {
    response = await fetch(DOCUMENT_VERSIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        'X-Document-Id': id,
        'X-Action': 'upgrade',
      },
      body: file,
    })
  } catch {
    throw new Error(
      'Could not reach version service. Redeploy document-versions-lambda with the upgrade action and use npm run dev proxy.'
    )
  }

  const data = parseLambdaJson(await response.text(), response)

  if (!response.ok) {
    throw new Error(data?.error || `Upgrade failed (HTTP ${response.status}).`)
  }
  if (data?.error) {
    throw new Error(data.error)
  }

  return {
    documentId: data.documentId ?? id,
    key: data.key,
    versions: Array.isArray(data.versions) ? data.versions : [],
  }
}
