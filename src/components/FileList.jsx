export default function FileList({ files }) {
  if (files.length === 0) {
    return (
      <div className="empty-state fade-in">
        <p>No assets found.</p>
        <span className="text-muted">Upload a file or adjust your search.</span>
      </div>
    )
  }

  return (
    <div className="file-table-wrap fade-in">
      <table className="file-table">
        <thead>
          <tr>
            <th>Asset name</th>
            <th>Owner</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr key={file.id} className="table-row">
              <td>{file.name}</td>
              <td>{file.owner}</td>
              <td>{new Date(file.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
