/** Fields stored on items but not shown in metadata search results. */
const HIDDEN_FIELD_KEYS = new Set([
  'uuid',
  'documentid',
  'creator',
  'creatorname',
  'creatoremail',
  'createddate',
  'created',
  'size',
  'mimetype',
  'searchpk',
  'referencedocumentid',
  'filepath',
  'archivalfilepath',
  'Branch',
  'Currency',
  'Remarks'
])

/** Preferred column order when present in result data. */
const PREFERRED_COLUMN_ORDER = [
  'DocumentTitle',
  'DocumentType',
  'AccountNumber',
  'AccountHolderName',
  'Date',
  'Amount'
]

export function normalizeFieldKey(key) {
  return String(key || '').replace(/\s+/g, '').toLowerCase()
}

export function isHiddenSearchField(key) {
  return HIDDEN_FIELD_KEYS.has(normalizeFieldKey(key))
}

export function formatSearchColumnLabel(key) {
  const spaced = String(key).replace(/([a-z])([A-Z])/g, '$1 $2')
  return spaced
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

/**
 * Build visible columns from search results (all fields except system/hidden).
 */
export function getSearchDisplayColumns(files) {
  if (!files?.length) return []

  const discovered = new Map()
  for (const file of files) {
    for (const key of Object.keys(file)) {
      if (!isHiddenSearchField(key)) {
        discovered.set(normalizeFieldKey(key), key)
      }
    }
  }

  const columns = []
  const used = new Set()

  for (const preferred of PREFERRED_COLUMN_ORDER) {
    const norm = normalizeFieldKey(preferred)
    const match = discovered.get(norm)
    if (match) {
      columns.push(match)
      used.add(norm)
    }
  }

  const remaining = [...discovered.entries()]
    .filter(([norm]) => !used.has(norm))
    .map(([, key]) => key)
    .sort((a, b) => formatSearchColumnLabel(a).localeCompare(formatSearchColumnLabel(b)))

  return columns.concat(remaining)
}

export function formatSearchCellValue(value) {
  if (value == null || value === '') return '-'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function getDocumentViewUrl(file) {
  return file?.archivalFilePath || file?.FilePath || ''
}
