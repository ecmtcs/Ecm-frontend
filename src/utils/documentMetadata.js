import { formatSearchColumnLabel, normalizeFieldKey } from './searchDisplay'

/** DynamoDB fields shown under “System metadata”. */
export const SYSTEM_METADATA_KEYS = [
  'DocumentId',
  'DocumentTitle',
  'Creator',
  'CreatedDate',
  'MimeType',
  'Size',
  'FilePath',
]

const SYSTEM_KEY_SET = new Set(
  SYSTEM_METADATA_KEYS.map((key) => normalizeFieldKey(key))
)

const INTERNAL_KEY_SET = new Set([
  'searchpk',
  'referencedocumentid',
])

const CREATOR_ALIASES = ['creator', 'creatorname', 'creatoremail']
const CREATED_ALIASES = ['createddate', 'created']
const MIME_ALIASES = ['mimetype', 'mimetype']
const SIZE_ALIASES = ['size']
const FILE_PATH_ALIASES = ['filepath', 'archivalfilepath']

function findValue(metadata, aliases) {
  for (const [key, value] of Object.entries(metadata)) {
    if (aliases.includes(normalizeFieldKey(key)) && value != null && value !== '') {
      return value
    }
  }
  return null
}

export function formatMetadataValue(key, value) {
  if (value == null || value === '') return '—'

  const norm = normalizeFieldKey(key)
  if (SIZE_ALIASES.includes(norm) || norm === 'size') {
    const bytes = Number(value)
    if (!Number.isFinite(bytes)) return String(value)
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function buildEntry(key, value) {
  return {
    key,
    label: formatSearchColumnLabel(key),
    value: formatMetadataValue(key, value),
  }
}

/**
 * Split raw DynamoDB metadata into system vs document (business) fields.
 */
export function splitDocumentMetadata(raw = {}) {
  const { systemMetadata, documentMetadata, ...metadata } = raw

  if (systemMetadata != null && documentMetadata != null) {
    return {
      system: entriesFromObject(systemMetadata, SYSTEM_METADATA_KEYS),
      document: entriesFromObject(documentMetadata),
    }
  }

  const systemValues = {
    DocumentId: metadata.DocumentId ?? metadata.documentId ?? metadata.uuid,
    DocumentTitle: metadata.DocumentTitle ?? metadata.documentTitle,
    Creator: findValue(metadata, CREATOR_ALIASES),
    CreatedDate: findValue(metadata, CREATED_ALIASES),
    MimeType: findValue(metadata, MIME_ALIASES),
    Size: findValue(metadata, SIZE_ALIASES),
    FilePath: findValue(metadata, FILE_PATH_ALIASES),
  }

  const usedKeys = new Set()
  const system = []

  for (const key of SYSTEM_METADATA_KEYS) {
    const value = systemValues[key]
    if (value != null && value !== '') {
      system.push(buildEntry(key, value))
    }
    usedKeys.add(normalizeFieldKey(key))
  }

  for (const alias of [...CREATOR_ALIASES, ...CREATED_ALIASES, ...MIME_ALIASES, ...SIZE_ALIASES, ...FILE_PATH_ALIASES]) {
    usedKeys.add(alias)
  }

  const document = Object.entries(metadata)
    .filter(([key]) => {
      const norm = normalizeFieldKey(key)
      return !INTERNAL_KEY_SET.has(norm) && !usedKeys.has(norm) && !SYSTEM_KEY_SET.has(norm)
    })
    .sort(([a], [b]) => formatSearchColumnLabel(a).localeCompare(formatSearchColumnLabel(b)))
    .map(([key, value]) => buildEntry(key, value))

  return { system, document }
}

function entriesFromObject(obj, preferredOrder) {
  const keys = preferredOrder
    ? [
        ...preferredOrder.filter((k) => k in obj),
        ...Object.keys(obj).filter((k) => !preferredOrder.includes(k)),
      ]
    : Object.keys(obj).sort((a, b) => formatSearchColumnLabel(a).localeCompare(formatSearchColumnLabel(b)))

  return keys
    .filter((key) => obj[key] != null && obj[key] !== '')
    .map((key) => buildEntry(key, obj[key]))
}

export function getDocumentTitle(metadata = {}) {
  return (
    metadata.DocumentTitle ||
    metadata.documentTitle ||
    metadata.FileName ||
    metadata.fileName ||
    'Document preview'
  )
}

export function isPdfMimeType(mimeType) {
  if (!mimeType) return true
  const lower = String(mimeType).toLowerCase()
  return lower === 'application/pdf' || lower.endsWith('/pdf')
}
