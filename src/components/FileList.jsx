import {
  formatSearchCellValue,
  formatSearchColumnLabel,
  getSearchDisplayColumns,
} from '../utils/searchDisplay'

function getDocumentId(file) {
  return file?.uuid || file?.DocumentId || file?.documentId || ''
}

export default function FileList({ files, onView }) {
  if (!files.length) {
    return (
      <div className="empty-state empty-state--full fade-in">
        <p>No assets found.</p>
        <span className="text-muted">Search documents using metadata.</span>
      </div>
    )
  }

  const columns = getSearchDisplayColumns(files)

  return (
    <div className="file-table-wrap file-table-wrap--search fade-in">
      <table className="file-table file-table--search">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{formatSearchColumnLabel(column)}</th>
            ))}
            <th className="col-actions">Document</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => {
            const rowKey = getDocumentId(file) || file.DocumentTitle
            const documentId = getDocumentId(file)

            return (
              <tr key={rowKey} className="table-row">
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
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
