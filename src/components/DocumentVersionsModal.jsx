import { useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  demoteDocumentVersion,
  fetchDocumentVersions,
  promoteDocumentVersion,
  upgradeDocumentVersion,
} from '../utils/versionApi'
import './DocumentPreviewModal.css'
import './DocumentVersionsModal.css'

function formatSize(bytes) {
  const num = Number(bytes)
  if (!Number.isFinite(num)) return ''
  if (num < 1024) return `${num} B`
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`
  return `${(num / (1024 * 1024)).toFixed(2)} MB`
}

function formatDate(value) {
  if (!value) return 'Unknown date'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
}

export default function DocumentVersionsModal({ documentId, title, onClose, onChanged }) {
  const fileInputId = useId()
  const fileInputRef = useRef(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [versions, setVersions] = useState([])
  const [busyVersionId, setBusyVersionId] = useState('')
  const [upgradeFile, setUpgradeFile] = useState(null)
  const [upgrading, setUpgrading] = useState(false)

  const load = useCallback(async (id) => {
    setLoading(true)
    setError('')
    setNotice('')
    try {
      const { versions: list } = await fetchDocumentVersions(id)
      setVersions(list)
    } catch (err) {
      setVersions([])
      setError(err.message || 'Failed to load versions.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!documentId) return
    setUpgradeFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    load(documentId)
  }, [documentId, load])

  useEffect(() => {
    if (!documentId) return undefined
    const onKeyDown = (e) => e.key === 'Escape' && !upgrading && !busyVersionId && onClose()
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [documentId, onClose, upgrading, busyVersionId])

  async function runAction(actionFn, busyKey, successMessage) {
    setBusyVersionId(busyKey)
    setError('')
    setNotice('')
    try {
      const { versions: list } = await actionFn()
      setVersions(list)
      setNotice(successMessage)
      onChanged?.()
    } catch (err) {
      setError(err.message || 'Action failed.')
    } finally {
      setBusyVersionId('')
    }
  }

  async function handleUpgradeSubmit(e) {
    e.preventDefault()
    if (!upgradeFile || upgrading || busyVersionId) return

    setUpgrading(true)
    setError('')
    setNotice('')
    try {
      const { versions: list } = await upgradeDocumentVersion(documentId, upgradeFile)
      setVersions(list)
      setNotice('New version uploaded. Promote or demote older versions below if needed.')
      setUpgradeFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      onChanged?.()
    } catch (err) {
      setError(err.message || 'Upgrade failed.')
    } finally {
      setUpgrading(false)
    }
  }

  function handleUpgradeFileChange(e) {
    setUpgradeFile(e.target.files?.[0] ?? null)
    setError('')
  }

  if (!documentId) return null

  const busy = Boolean(busyVersionId) || upgrading

  return (
    <div
      className="doc-preview-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-versions-title"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="doc-preview-modal doc-versions-modal fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="doc-preview-header">
          <div>
            <h2 id="doc-versions-title">{title || 'Version history'}</h2>
            <p className="doc-preview-id text-muted">{documentId}</p>
          </div>
          <button
            type="button"
            className="doc-preview-close"
            onClick={onClose}
            disabled={busy}
            aria-label="Close versions"
          >
            ×
          </button>
        </header>

        <div className="doc-versions-body">
          <p className="doc-versions-hint text-muted">
            Upload a new file to replace the current content at the same storage path (creates a
            new version). Use promote or demote to switch which version is active.
          </p>

          <form className="doc-versions-upgrade" onSubmit={handleUpgradeSubmit}>
            <div className="doc-versions-upgrade-label">
              <label htmlFor={fileInputId}>Upgrade (new version)</label>
              <span className="text-muted">
                Same S3 key — previous versions are kept (max 5 MB per upload)
              </span>
            </div>
            <div className="doc-versions-upgrade-controls">
              <input
                ref={fileInputRef}
                id={fileInputId}
                type="file"
                className="doc-versions-file-input"
                disabled={busy || loading}
                onChange={handleUpgradeFileChange}
              />
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={busy || loading || !upgradeFile}
              >
                {upgrading ? 'Uploading…' : 'Upload new version'}
              </button>
            </div>
          </form>

          {error && <p className="text-danger">{error}</p>}
          {notice && <p className="doc-versions-notice">{notice}</p>}

          {loading ? (
            <div className="doc-versions-loading">
              <span className="doc-preview-spinner" aria-hidden="true" />
              <span>Loading versions…</span>
            </div>
          ) : versions.length === 0 ? (
            <p className="doc-versions-empty">No versions found for this document.</p>
          ) : (
            <ul className="doc-versions-list">
              {versions.map((version, index) => {
                const isCurrent = version.isLatest
                const canDemote = isCurrent && versions.length > 1
                const versionLabel = versions.length - index

                return (
                  <li
                    key={version.versionId}
                    className={`doc-version-row ${isCurrent ? 'doc-version-row--current' : ''}`}
                  >
                    <div className="doc-version-meta">
                      <div className="doc-version-title">
                        <span>Version {versionLabel}</span>
                        {isCurrent && <span className="doc-version-badge">Current</span>}
                      </div>
                      <p className="doc-version-sub text-muted">
                        {formatDate(version.lastModified)}
                        {formatSize(version.size) ? ` · ${formatSize(version.size)}` : ''}
                      </p>
                    </div>

                    <div className="doc-version-actions">
                      {version.viewUrl && (
                        <a
                          className="btn-link btn-view"
                          href={version.viewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View
                        </a>
                      )}

                      {isCurrent ? (
                        canDemote ? (
                          <button
                            type="button"
                            className="btn-link"
                            disabled={busy}
                            onClick={() =>
                              runAction(
                                () => demoteDocumentVersion(documentId),
                                version.versionId,
                                'Rolled back to the previous version.'
                              )
                            }
                          >
                            {busyVersionId === version.versionId ? 'Demoting…' : 'Demote'}
                          </button>
                        ) : (
                          <span className="doc-version-note text-muted">Latest</span>
                        )
                      ) : (
                        <button
                          type="button"
                          className="btn-link"
                          disabled={busy}
                          onClick={() =>
                            runAction(
                              () => promoteDocumentVersion(documentId, version.versionId),
                              version.versionId,
                              'Promoted — this version is now current.'
                            )
                          }
                        >
                          {busyVersionId === version.versionId ? 'Promoting…' : 'Promote'}
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
