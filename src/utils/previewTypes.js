import { isPdfMimeType } from './documentMetadata'

const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'bmp',
  'webp',
  'svg',
  'tif',
  'tiff',
  'ico',
])

const TEXT_EXTENSIONS = new Set(['txt', 'csv', 'json', 'xml', 'md', 'log', 'html', 'htm'])
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'ogg', 'mov'])
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac'])

function normalizeMime(mimeType) {
  return String(mimeType || '')
    .toLowerCase()
    .split(';')[0]
    .trim()
}

function getFileExtension(filePath) {
  if (!filePath) return ''
  const clean = String(filePath).split('?')[0].split('#')[0]
  const match = clean.match(/\.([a-z0-9]+)$/i)
  return match ? match[1].toLowerCase() : ''
}

/**
 * Resolve how to render a document in the preview panel.
 * @returns {'pdf' | 'image' | 'text' | 'video' | 'audio' | 'iframe'}
 */
export function resolvePreviewKind(mimeType, filePath = '') {
  const mime = normalizeMime(mimeType)
  const ext = getFileExtension(filePath)

  if (isPdfMimeType(mime) || ext === 'pdf') return 'pdf'

  if (mime.startsWith('image/') || IMAGE_EXTENSIONS.has(ext)) return 'image'

  if (mime.startsWith('text/') || TEXT_EXTENSIONS.has(ext)) return 'text'

  if (mime.startsWith('video/') || VIDEO_EXTENSIONS.has(ext)) return 'video'

  if (mime.startsWith('audio/') || AUDIO_EXTENSIONS.has(ext)) return 'audio'

  // Browser may render other types in iframe (e.g. some XML, JSON)
  return 'iframe'
}

export function canInlinePreview(mimeType, filePath = '') {
  const kind = resolvePreviewKind(mimeType, filePath)
  return kind !== 'iframe' || normalizeMime(mimeType) !== ''
}
