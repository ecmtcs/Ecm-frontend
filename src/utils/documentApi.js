// import { parseLambdaJson } from './lambdaResponse'

// const DOCUMENT_PREVIEW_DIRECT =
//   import.meta.env.VITE_DOCUMENT_PREVIEW_LAMBDA_URL?.trim() ||
//   'https://43htd6x7vtya4cqd447tt4qpfq0pbjwk.lambda-url.us-east-1.on.aws/'

// const DOCUMENT_DELETE_DIRECT =
//   import.meta.env.VITE_DOCUMENT_DELETE_LAMBDA_URL?.trim() ||
//   'https://REPLACE_AFTER_DEPLOY.lambda-url.us-east-1.on.aws/'

// const DOCUMENT_UPDATE_DIRECT =
//   import.meta.env.VITE_DOCUMENT_UPDATE_LAMBDA_URL?.trim() ||
//   'https://REPLACE_AFTER_DEPLOY.lambda-url.us-east-1.on.aws/'

// const useProxy = import.meta.env.VITE_USE_LAMBDA_PROXY !== 'false'

// export const DOCUMENT_PREVIEW_URL = useProxy ? '/api/document' : DOCUMENT_PREVIEW_DIRECT
// export const DOCUMENT_DELETE_URL = useProxy ? '/api/document-delete' : DOCUMENT_DELETE_DIRECT
// export const DOCUMENT_UPDATE_URL = useProxy ? '/api/document-update' : DOCUMENT_UPDATE_DIRECT

// /**
//  * Load document preview URL + full metadata from DynamoDB via Lambda.
//  * @param {string} documentId
//  */
// export async function fetchDocumentPreview(documentId) {
//   const id = String(documentId ?? '').trim()
//   if (!id || id === '—') {
//     throw new Error('Document ID is required.')
//   }

//   let response
//   try {
//     response = await fetch(DOCUMENT_PREVIEW_URL, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ documentId: id }),
//     })
//   } catch {
//     throw new Error(
//       'Could not reach document preview service. Check Lambda Function URL and /api/document proxy.'
//     )
//   }

//   const data = parseLambdaJson(await response.text(), response)

//   if (!response.ok) {
//     throw new Error(data?.error || `Preview failed (HTTP ${response.status}).`)
//   }
//   if (data?.error) {
//     throw new Error(data.error)
//   }
//   if (!data?.previewUrl) {
//     throw new Error('Preview URL was not returned.')
//   }

//   return {
//     documentId: data.documentId ?? id,
//     previewUrl: data.previewUrl,
//     mimeType: data.mimeType ?? 'application/pdf',
//     metadata: data.metadata ?? {},
//     systemMetadata: data.systemMetadata,
//     documentMetadata: data.documentMetadata,
//   }
// }

// const MIME_EXTENSIONS = {
//   'application/pdf': 'pdf',
//   'image/png': 'png',
//   'image/jpeg': 'jpg',
//   'image/gif': 'gif',
//   'image/webp': 'webp',
//   'text/plain': 'txt',
//   'text/csv': 'csv',
//   'application/json': 'json',
// }

// /** Build a safe, friendly download filename from title/path/mime. */
// function resolveDownloadFilename(title, filePath, mimeType) {
//   const clean = String(title || 'document').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'document'
//   if (/\.[a-z0-9]+$/i.test(clean)) return clean

//   const pathExt = (String(filePath || '').split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i) || [])[1]
//   const ext = pathExt || MIME_EXTENSIONS[String(mimeType || '').toLowerCase().split(';')[0].trim()]
//   return ext ? `${clean}.${ext}` : clean
// }

// /**
//  * Download a document from its presigned URL to the user's device.
//  * Falls back to opening the URL when the object cannot be fetched as a blob
//  * (e.g. cross-origin restrictions on the presigned URL).
//  */
// export async function downloadDocumentFile({ url, title, filePath, mimeType }) {
//   if (!url) throw new Error('Nothing to download.')
//   const filename = resolveDownloadFilename(title, filePath, mimeType)

//   let objectUrl
//   try {
//     const response = await fetch(url)
//     if (!response.ok) throw new Error(`HTTP ${response.status}`)
//     objectUrl = URL.createObjectURL(await response.blob())
//   } catch {
//     window.open(url, '_blank', 'noopener,noreferrer')
//     return { filename }
//   }

//   const link = document.createElement('a')
//   link.href = objectUrl
//   link.download = filename
//   document.body.appendChild(link)
//   link.click()
//   link.remove()
//   URL.revokeObjectURL(objectUrl)

//   return { filename }
// }

// /**
//  * Delete document from S3 Archival/ and DynamoDB by UUID.
//  * @param {string} documentId
//  */
// export async function deleteDocument(documentId) {
//   const id = String(documentId ?? '').trim()
//   if (!id || id === '—') {
//     throw new Error('Document ID is required.')
//   }

//   let response
//   try {
//     response = await fetch(DOCUMENT_DELETE_URL, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ documentId: id }),
//     })
//   } catch {
//     throw new Error(
//       'Could not reach document delete service. Deploy document-delete-lambda and configure /api/document-delete proxy.'
//     )
//   }

//   const data = parseLambdaJson(await response.text(), response)

//   if (!response.ok) {
//     throw new Error(data?.error || `Delete failed (HTTP ${response.status}).`)
//   }
//   if (data?.error) {
//     throw new Error(data.error)
//   }

//   return {
//     documentId: data.documentId ?? id,
//     deleted: Boolean(data.deleted),
//   }
// }

// /**
//  * Update editable document (business) metadata fields in DynamoDB.
//  * @param {string} documentId
//  * @param {Record<string, string>} updates - changed field key/value pairs
//  */
// export async function updateDocumentMetadata(documentId, updates) {
//   const id = String(documentId ?? '').trim()
//   if (!id || id === '—') {
//     throw new Error('Document ID is required.')
//   }
//   if (!updates || Object.keys(updates).length === 0) {
//     throw new Error('No changes to save.')
//   }

//   let response
//   try {
//     response = await fetch(DOCUMENT_UPDATE_URL, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ documentId: id, updates }),
//     })
//   } catch {
//     throw new Error(
//       'Could not reach document update service. Deploy document-update-lambda and configure /api/document-update proxy.'
//     )
//   }

//   const data = parseLambdaJson(await response.text(), response)

//   if (!response.ok) {
//     throw new Error(data?.error || `Update failed (HTTP ${response.status}).`)
//   }
//   if (data?.error) {
//     throw new Error(data.error)
//   }

//   return {
//     documentId: data.documentId ?? id,
//     updated: Boolean(data.updated),
//     metadata: data.metadata ?? {},
//   }
// }
import JSZip from 'jszip'

import { parseLambdaJson } from './lambdaResponse'

const DOCUMENT_PREVIEW_DIRECT =
  import.meta.env.VITE_DOCUMENT_PREVIEW_LAMBDA_URL?.trim() ||
  'https://43htd6x7vtya4cqd447tt4qpfq0pbjwk.lambda-url.us-east-1.on.aws/'

const DOCUMENT_DELETE_DIRECT =
  import.meta.env.VITE_DOCUMENT_DELETE_LAMBDA_URL?.trim() ||
  'https://REPLACE_AFTER_DEPLOY.lambda-url.us-east-1.on.aws/'

const DOCUMENT_UPDATE_DIRECT =
  import.meta.env.VITE_DOCUMENT_UPDATE_LAMBDA_URL?.trim() ||
  'https://REPLACE_AFTER_DEPLOY.lambda-url.us-east-1.on.aws/'

const useProxy = import.meta.env.VITE_USE_LAMBDA_PROXY !== 'false'

export const DOCUMENT_PREVIEW_URL = useProxy ? '/api/document' : DOCUMENT_PREVIEW_DIRECT
export const DOCUMENT_DELETE_URL = useProxy ? '/api/document-delete' : DOCUMENT_DELETE_DIRECT
export const DOCUMENT_UPDATE_URL = useProxy ? '/api/document-update' : DOCUMENT_UPDATE_DIRECT

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

const MIME_EXTENSIONS = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/json': 'json',
}

/**
 * Rewrite a presigned S3 URL to a same-origin path so the bytes can be read in
 * JS without a bucket CORS policy. The proxy (Vite in dev, Vercel rewrite in
 * prod) forwards to the original signed host, keeping the SigV4 signature valid.
 * Non-S3 URLs are returned unchanged.
 */
function toProxiedObjectUrl(rawUrl) {
  try {
    const u = new URL(rawUrl)
    if (!/\.amazonaws\.com$/i.test(u.host)) return rawUrl
    return `/api/s3-object/${u.host}${u.pathname}${u.search}`
  } catch {
    return rawUrl
  }
}

/** Build a safe, friendly download filename from title/path/mime. */
function resolveDownloadFilename(title, filePath, mimeType) {
  const clean = String(title || 'document').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'document'
  if (/\.[a-z0-9]+$/i.test(clean)) return clean

  const pathExt = (String(filePath || '').split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i) || [])[1]
  const ext = pathExt || MIME_EXTENSIONS[String(mimeType || '').toLowerCase().split(';')[0].trim()]
  return ext ? `${clean}.${ext}` : clean
}

/**
 * Download a document from its presigned URL to the user's device.
 * Falls back to opening the URL when the object cannot be fetched as a blob
 * (e.g. cross-origin restrictions on the presigned URL).
 */
export async function downloadDocumentFile({ url, title, filePath, mimeType }) {
  if (!url) throw new Error('Nothing to download.')
  const filename = resolveDownloadFilename(title, filePath, mimeType)

  let objectUrl
  try {
    const response = await fetch(toProxiedObjectUrl(url))
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    objectUrl = URL.createObjectURL(await response.blob())
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer')
    return { filename }
  }

  triggerBlobDownload(objectUrl, filename)
  URL.revokeObjectURL(objectUrl)

  return { filename }
}

/** Programmatically click an anchor to download an object URL. */
function triggerBlobDownload(objectUrl, filename) {
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}

/** Ensure each archive entry name is unique by suffixing duplicates. */
function uniqueEntryName(name, used) {
  if (!used.has(name)) {
    used.add(name)
    return name
  }
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  let i = 2
  let candidate = `${base} (${i})${ext}`
  while (used.has(candidate)) {
    i += 1
    candidate = `${base} (${i})${ext}`
  }
  used.add(candidate)
  return candidate
}

/** Resolve a presigned URL, fetch its bytes, and return a named blob entry. */
async function fetchDocumentBlob({ documentId, title }) {
  const { previewUrl, mimeType } = await fetchDocumentPreview(documentId)
  const response = await fetch(toProxiedObjectUrl(previewUrl))
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const blob = await response.blob()
  const filePath = previewUrl.split(/[?#]/)[0]
  return { blob, filename: resolveDownloadFilename(title, filePath, mimeType) }
}

/**
 * Download multiple documents as a single client-side ZIP archive.
 *
 * File bytes are streamed straight from each presigned S3 URL into the ZIP in
 * the browser, so the bundle is never routed through Lambda and is unaffected
 * by the 6MB Lambda payload limit. Failures are isolated per document.
 *
 * @param {Array<{ documentId: string, title?: string }>} documents
 * @param {{ zipName?: string, concurrency?: number }} [options]
 * @returns {Promise<{ filename: string, total: number, succeeded: number, failed: string[] }>}
 */
export async function downloadDocumentsZip(documents, { zipName, concurrency = 4 } = {}) {
  const items = (documents || []).filter((doc) => doc?.documentId)
  if (!items.length) throw new Error('No documents selected to download.')

  const zip = new JSZip()
  const usedNames = new Set()
  const failed = []
  let cursor = 0

  const worker = async () => {
    while (cursor < items.length) {
      const item = items[cursor++]
      try {
        const { blob, filename } = await fetchDocumentBlob(item)
        zip.file(uniqueEntryName(filename, usedNames), blob)
      } catch (err) {
        console.error('[ECM ZIP] Failed to add document', item.documentId, err)
        failed.push(item.title || item.documentId)
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker)
  )

  const succeeded = items.length - failed.length
  if (!succeeded) {
    throw new Error('None of the selected documents could be downloaded.')
  }

  const archive = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  const filename = `${String(zipName || 'documents').replace(/[\\/:*?"<>|]+/g, '_') || 'documents'}.zip`
  const objectUrl = URL.createObjectURL(archive)
  triggerBlobDownload(objectUrl, filename)
  URL.revokeObjectURL(objectUrl)

  return { filename, total: items.length, succeeded, failed }
}

/**
 * Delete document from S3 Archival/ and DynamoDB by UUID.
 * @param {string} documentId
 */
export async function deleteDocument(documentId) {
  const id = String(documentId ?? '').trim()
  if (!id || id === '—') {
    throw new Error('Document ID is required.')
  }

  let response
  try {
    response = await fetch(DOCUMENT_DELETE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: id }),
    })
  } catch {
    throw new Error(
      'Could not reach document delete service. Deploy document-delete-lambda and configure /api/document-delete proxy.'
    )
  }

  const data = parseLambdaJson(await response.text(), response)

  if (!response.ok) {
    throw new Error(data?.error || `Delete failed (HTTP ${response.status}).`)
  }
  if (data?.error) {
    throw new Error(data.error)
  }

  return {
    documentId: data.documentId ?? id,
    deleted: Boolean(data.deleted),
  }
}

/**
 * Update editable document (business) metadata fields in DynamoDB.
 * @param {string} documentId
 * @param {Record<string, string>} updates - changed field key/value pairs
 */
export async function updateDocumentMetadata(documentId, updates) {
  const id = String(documentId ?? '').trim()
  if (!id || id === '—') {
    throw new Error('Document ID is required.')
  }
  if (!updates || Object.keys(updates).length === 0) {
    throw new Error('No changes to save.')
  }

  let response
  try {
    response = await fetch(DOCUMENT_UPDATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: id, updates }),
    })
  } catch {
    throw new Error(
      'Could not reach document update service. Deploy document-update-lambda and configure /api/document-update proxy.'
    )
  }

  const data = parseLambdaJson(await response.text(), response)

  if (!response.ok) {
    throw new Error(data?.error || `Update failed (HTTP ${response.status}).`)
  }
  if (data?.error) {
    throw new Error(data.error)
  }

  return {
    documentId: data.documentId ?? id,
    updated: Boolean(data.updated),
    metadata: data.metadata ?? {},
  }
}
