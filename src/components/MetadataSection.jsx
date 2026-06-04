import { useEffect, useMemo, useState } from 'react'

/**
 * Collapsible metadata panel for the document preview modal.
 *
 * When `editable` is set, document (business) fields render as inputs and a
 * Save button surfaces only the changed fields via `onSave`.
 */
export default function MetadataSection({
  title,
  entries,
  emptyMessage,
  defaultOpen = false,
  editable = false,
  onSave,
  saving = false,
}) {
  const count = entries?.length ?? 0

  const initialDraft = useMemo(() => {
    const draft = {}
    for (const { key, value } of entries ?? []) {
      draft[key] = value === '—' ? '' : String(value ?? '')
    }
    return draft
  }, [entries])

  const [draft, setDraft] = useState(initialDraft)

  useEffect(() => {
    setDraft(initialDraft)
  }, [initialDraft])

  const changes = useMemo(() => {
    const diff = {}
    for (const { key } of entries ?? []) {
      const original = initialDraft[key] ?? ''
      const next = draft[key] ?? ''
      if (next !== original) diff[key] = next
    }
    return diff
  }, [draft, initialDraft, entries])

  const hasChanges = Object.keys(changes).length > 0

  function handleSubmit(event) {
    event.preventDefault()
    if (!hasChanges || saving) return
    onSave?.(changes)
  }

  return (
    <details className="metadata-section" open={defaultOpen || editable}>
      <summary className="metadata-section__trigger">
        <span className="metadata-section__heading">
          <span className="metadata-section__title">{title}</span>
          <span className="metadata-section__count">{count}</span>
        </span>
        <svg
          className="metadata-section__chevron"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>

      <div className="metadata-section__panel">
        {!count ? (
          <p className="metadata-section__empty text-muted">{emptyMessage}</p>
        ) : editable ? (
          <form className="metadata-section__form" onSubmit={handleSubmit}>
            <dl className="metadata-section__list metadata-section__list--scroll">
              {entries.map(({ key, label }) => (
                <div key={key} className="metadata-section__row">
                  <dt>
                    <label htmlFor={`meta-${key}`}>{label}</label>
                  </dt>
                  <dd>
                    <input
                      id={`meta-${key}`}
                      className="metadata-section__input"
                      value={draft[key] ?? ''}
                      disabled={saving}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                    />
                  </dd>
                </div>
              ))}
            </dl>
            <div className="metadata-section__actions">
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={!hasChanges || saving}
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        ) : (
          <dl className="metadata-section__list metadata-section__list--scroll">
            {entries.map(({ key, label, value }) => (
              <div key={key} className="metadata-section__row">
                <dt>{label}</dt>
                <dd className={key === 'DocumentId' || key === 'FilePath' ? 'cell-mono' : ''}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </details>
  )
}
