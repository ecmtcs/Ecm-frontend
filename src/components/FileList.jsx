import {
  formatSearchCellValue,
  formatSearchColumnLabel,
  getDocumentViewUrl,
  getSearchDisplayColumns,
} from '../utils/searchDisplay'

export default function FileList({ files }) {
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
            const rowKey = file.uuid || file.DocumentId || file.DocumentTitle
            const viewUrl = getDocumentViewUrl(file)

            return (
              <tr key={rowKey} className="table-row">
                {columns.map((column) => (
                  <td key={`${rowKey}-${column}`} title={formatSearchCellValue(file[column])}>
                    {formatSearchCellValue(file[column])}
                  </td>
                ))}
                <td className="col-actions">
                  {viewUrl ? (
                    <a href={viewUrl} target="_blank" rel="noreferrer">
                      View
                    </a>
                  ) : (
                    '-'
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
