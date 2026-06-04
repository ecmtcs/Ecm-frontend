import { useCallback, useEffect, useState } from 'react'
import {
  downloadDocumentFile,
  fetchDocumentPreview,
  updateDocumentMetadata,
} from '../utils/documentApi'
import { fetchDocumentVersions } from '../utils/versionApi'
import {
  getDocumentTitle,
  splitDocumentMetadata,
} from '../utils/documentMetadata'
import DocumentPreviewContent from './DocumentPreviewContent'
import MetadataSection from './MetadataSection'
import './DocumentPreviewModal.css'

/** Prepend a "Version" row (e.g. "V3 (latest of 3)") to system metadata. */
async function withVersionEntry(documentId, systemEntries) {
  try {
    const { versions } = await fetchDocumentVersions(documentId)
    if (!versions.length) return systemEntries

    const latestIndex = versions.findIndex((v) => v.isLatest)
    const idx = latestIndex >= 0 ? latestIndex : 0
    const versionNumber = versions.length - idx
    const value =
      versions.length > 1 ? `V${versionNumber} (latest of ${versions.length})` : 'V1'

    return [{ key: 'Version', label: 'Version', value }, ...systemEntries]
  } catch {
    return systemEntries
  }
}

export default function DocumentPreviewModal({ documentId, onClose }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('Document preview')
  const [previewUrl, setPreviewUrl] = useState('')
  const [mimeType, setMimeType] = useState('')
  const [filePath, setFilePath] = useState('')
  const [systemEntries, setSystemEntries] = useState([])
  const [documentEntries, setDocumentEntries] = useState([])
  const [savingMetadata, setSavingMetadata] = useState(false)
  const [saveNotice, setSaveNotice] = useState('')
  const [downloading, setDownloading] = useState(false)

  const loadPreview = useCallback(async (id) => {
    setLoading(true)
    setError('')
    setSaveNotice('')
    setPreviewUrl('')

    try {
      const data = await fetchDocumentPreview(id)
      const { system, document } = splitDocumentMetadata({
        ...data.metadata,
        systemMetadata: data.systemMetadata ?? undefined,
        documentMetadata: data.documentMetadata ?? undefined,
      })

      const metadata = data.metadata ?? {}

      setPreviewUrl(data.previewUrl)
      setMimeType(data.mimeType ?? metadata.MimeType ?? '')
      setFilePath(metadata.FilePath ?? metadata.filePath ?? '')
      setSystemEntries(await withVersionEntry(id, system))
      setDocumentEntries(document)
      setTitle(getDocumentTitle(metadata))
    } catch (err) {
      setError(err.message || 'Failed to load document.')
      setSystemEntries([])
      setDocumentEntries([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSaveMetadata = useCallback(
    async (changes) => {
      setSavingMetadata(true)
      setError('')
      setSaveNotice('')
      try {
        const { metadata } = await updateDocumentMetadata(documentId, changes)
        const { document } = splitDocumentMetadata({ ...metadata })
        setDocumentEntries(document)
        setSaveNotice('Document metadata updated.')
      } catch (err) {
        setError(err.message || 'Failed to update metadata.')
      } finally {
        setSavingMetadata(false)
      }
    },
    [documentId]
  )

  const handleDownload = useCallback(async () => {
    if (!previewUrl) return
    setDownloading(true)
    try {
      await downloadDocumentFile({ url: previewUrl, title, filePath, mimeType })
    } finally {
      setDownloading(false)
    }
  }, [previewUrl, title, filePath, mimeType])

  useEffect(() => {
    if (!documentId) return
    loadPreview(documentId)
  }, [documentId, loadPreview])

  useEffect(() => {
    if (!documentId) return undefined

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [documentId, onClose])

  if (!documentId) return null

  return (
    <div
      className="doc-preview-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-preview-title"
      onClick={onClose}
    >
      <div className="doc-preview-modal fade-in" onClick={(e) => e.stopPropagation()}>
        <header className="doc-preview-header">
          <div>
            <h2 id="doc-preview-title">{title}</h2>
            <p className="doc-preview-id text-muted">{documentId}</p>
          </div>
          <div className="doc-preview-header-actions">
            <button
              type="button"
              className="btn btn-outline btn-sm doc-preview-download"
              onClick={handleDownload}
              disabled={!previewUrl || loading || downloading}
            >
              {downloading ? 'Exporting…' : 'Download'}
            </button>
            <button
              type="button"
              className="doc-preview-close"
              onClick={onClose}
              aria-label="Close preview"
            >
              ×
            </button>
          </div>
        </header>

        {error ? (
          <div className="doc-preview-error" role="alert">
            <p>{error}</p>
            <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <div className="doc-preview-body">
            <section className="doc-preview-viewer" aria-label="Document preview">
              {loading && (
                <div className="doc-preview-loading">
                  <span className="doc-preview-spinner" aria-hidden="true" />
                  <span>Loading document…</span>
                </div>
              )}

              {!loading && previewUrl && (
                <DocumentPreviewContent
                  url={previewUrl}
                  title={title}
                  mimeType={mimeType}
                  filePath={filePath}
                />
              )}
            </section>

            <aside className="doc-preview-sidebar" aria-label="Document metadata">
              {loading ? (
                <p className="text-muted">Loading metadata…</p>
              ) : (
                <>
                  <MetadataSection
                    title="System metadata"
                    entries={systemEntries}
                    emptyMessage="No system metadata available."
                  />
                  {saveNotice && <p className="doc-preview-save-notice">{saveNotice}</p>}
                  <MetadataSection
                    title="Document metadata"
                    entries={documentEntries}
                    emptyMessage="No additional document metadata."
                    editable
                    onSave={handleSaveMetadata}
                    saving={savingMetadata}
                  />
                </>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}
