/**
 * Collapsible metadata panel for the document preview modal.
 */
export default function MetadataSection({
  title,
  entries,
  emptyMessage,
  defaultOpen = true,
}) {
  const count = entries?.length ?? 0

  return (
    <details className="metadata-section" open={defaultOpen}>
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
        ) : (
          <dl className="metadata-section__list">
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
