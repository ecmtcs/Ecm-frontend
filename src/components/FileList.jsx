import {
  formatSearchCellValue,
  formatSearchColumnLabel,
  getSearchDisplayColumns,
} from '../utils/searchDisplay'

function getDocumentId(file) {
  return file?.uuid || file?.DocumentId || file?.documentId || ''
}

export default function FileList({
  files,
  onView,
  onVersions,
  onDelete,
  deletingId = '',
  selectedIds = null,
  onToggleSelect,
  onToggleSelectAll,
}) {
  if (!files.length) {
    return (
      <div className="empty-state empty-state--full fade-in">
        <p>No assets found.</p>
        <span className="text-muted">Search documents using metadata.</span>
      </div>
    )
  }

  const columns = getSearchDisplayColumns(files)
  const selectable = Boolean(selectedIds && onToggleSelect)

  const selectableIds = selectable
    ? files.map(getDocumentId).filter(Boolean)
    : []
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id))
  const someSelected = selectableIds.some((id) => selectedIds.has(id))

  return (
    <div className="file-table-wrap file-table-wrap--search fade-in">
      <table className="file-table file-table--search">
        <thead>
          <tr>
            {selectable && (
              <th className="col-select">
                <input
                  type="checkbox"
                  className="row-checkbox"
                  aria-label="Select all documents"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected && !allSelected
                  }}
                  onChange={() => onToggleSelectAll?.()}
                />
              </th>
            )}
            {columns.map((column) => (
              <th key={column}>{formatSearchColumnLabel(column)}</th>
            ))}
            <th className="col-actions">View</th>
            <th className="col-actions">Versions</th>
            <th className="col-actions">Delete</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => {
            const documentId = getDocumentId(file)
            const rowKey = documentId || file.DocumentTitle
            const isSelected = selectable && documentId ? selectedIds.has(documentId) : false

            return (
              <tr
                key={rowKey}
                className={`table-row ${isSelected ? 'table-row--selected' : ''}`}
              >
                {selectable && (
                  <td className="col-select">
                    {documentId ? (
                      <input
                        type="checkbox"
                        className="row-checkbox"
                        aria-label={`Select ${file.DocumentTitle || documentId}`}
                        checked={isSelected}
                        onChange={() => onToggleSelect?.(documentId)}
                      />
                    ) : null}
                  </td>
                )}
                {columns.map((column) => (
                  <td key={`${rowKey}-${column}`} title={formatSearchCellValue(file[column])}>
                    {formatSearchCellValue(file[column])}
                  </td>
                ))}
                <td className="col-actions">
                  {documentId ? (
                    <button
                      type="button"
                      className="btn-link btn-view"
                      onClick={() => onView?.(documentId)}
                    >
                      View
                    </button>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="col-actions">
                  {documentId ? (
                    <button
                      type="button"
                      className="btn-link btn-versions"
                      onClick={() => onVersions?.(documentId, file.DocumentTitle)}
                    >
                      Versions
                    </button>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="col-actions">
                  {documentId ? (
                    <button
                      type="button"
                      className="btn-link btn-delete"
                      disabled={deletingId === documentId}
                      onClick={() => onDelete?.(documentId)}
                    >
                      {deletingId === documentId ? 'Deleting…' : 'Delete'}
                    </button>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
