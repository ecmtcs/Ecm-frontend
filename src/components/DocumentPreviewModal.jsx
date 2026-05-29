import { useCallback, useEffect, useState } from 'react'
import { fetchDocumentPreview } from '../utils/documentApi'
import {
  getDocumentTitle,
  splitDocumentMetadata,
} from '../utils/documentMetadata'
import DocumentPreviewContent from './DocumentPreviewContent'
import MetadataSection from './MetadataSection'
import './DocumentPreviewModal.css'

export default function DocumentPreviewModal({ documentId, onClose }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('Document preview')
  const [previewUrl, setPreviewUrl] = useState('')
  const [mimeType, setMimeType] = useState('')
  const [filePath, setFilePath] = useState('')
  const [systemEntries, setSystemEntries] = useState([])
  const [documentEntries, setDocumentEntries] = useState([])

  const loadPreview = useCallback(async (id) => {
    setLoading(true)
    setError('')
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
      setSystemEntries(system)
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
          <button
            type="button"
            className="doc-preview-close"
            onClick={onClose}
            aria-label="Close preview"
          >
            ×
          </button>
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
                  <MetadataSection
                    title="Document metadata"
                    entries={documentEntries}
                    emptyMessage="No additional document metadata."
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
