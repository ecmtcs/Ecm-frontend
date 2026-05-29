import { useCallback, useEffect, useState } from 'react'
import { fetchDocumentPreview } from '../utils/documentApi'
import {
  getDocumentTitle,
  isPdfMimeType,
  splitDocumentMetadata,
} from '../utils/documentMetadata'
import MetadataSection from './MetadataSection'
import './DocumentPreviewModal.css'

export default function DocumentPreviewModal({ documentId, onClose }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('Document preview')
  const [previewUrl, setPreviewUrl] = useState('')
  const [mimeType, setMimeType] = useState('application/pdf')
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

      setPreviewUrl(data.previewUrl)
      setMimeType(data.mimeType)
      setSystemEntries(system)
      setDocumentEntries(document)
      setTitle(getDocumentTitle(data.metadata))
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

  const showPdf = previewUrl && isPdfMimeType(mimeType)

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

              {!loading && showPdf && (
                <iframe src={previewUrl} title={title} className="doc-preview-iframe" />
              )}

              {!loading && previewUrl && !showPdf && (
                <div className="doc-preview-fallback">
                  <p className="text-muted">Inline preview is not available for this file type.</p>
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                  >
                    Open / download file
                  </a>
                </div>
              )}
            </section>

            <aside className="doc-preview-sidebar" aria-label="Document metadata">
              {loading ? (
                <p className="text-muted">Loading metadata…</p>
              ) : (
                <>
                <MetadataSection
                    title="Document metadata"
                    entries={documentEntries}
                    emptyMessage="No additional document metadata."
                    defaultOpen
                  /> 
                  <MetadataSection
                    title="System metadata"
                    entries={systemEntries}
                    emptyMessage="No system metadata available."
                    defaultOpen
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
