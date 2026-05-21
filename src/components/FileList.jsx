// export default function FileList({ files }) {
//   if (files.length === 0) {
//     return (
//       <div className="empty-state fade-in">
//         <p>No assets found.</p>
//         <span className="text-muted">Upload a file or adjust your search.</span>
//       </div>
//     )
//   }

//   return (
//     <div className="file-table-wrap fade-in">
//       <table className="file-table">
//         <thead>
//           <tr>
//             <th>Asset name</th>
//             <th>Owner</th>
//             <th>Created</th>
//           </tr>
//         </thead>
//         <tbody>
//           {files.map((file) => (
//             <tr key={file.id} className="table-row">
//               <td>{file.name}</td>
//               <td>{file.owner}</td>
//               <td>{new Date(file.createdAt).toLocaleString()}</td>
//             </tr>
//           ))}
//         </tbody>
//       </table>
//     </div>
//   )
// }
export default function FileList({
  files
}) {

  if (!files.length) {

    return (

      <div className="empty-state fade-in">

        <p>No assets found.</p>

        <span className="text-muted">
          Search documents using metadata.
        </span>

      </div>

    )
  }

  return (

    <div className="file-table-wrap fade-in">

      <table className="file-table">

        <thead>

          <tr>

            <th>UUID</th>

            <th>Document Type</th>

            <th>Account Number</th>

            <th>Account Holder Name</th>

            <th>Branch</th>

            <th>Document</th>

          </tr>

        </thead>

        <tbody>

          {files.map((file) => (

            <tr
              key={file.uuid || file.DocumentId}
              className="table-row"
            >

              <td className="cell-mono">{file.uuid || file.DocumentId}</td>

              <td>
                {file.DocumentType}
              </td>

              <td>
                {file.AccountNumber || '-'}
              </td>

              <td>
                {file.AccountHolderName || '-'}
              </td>

              <td>
                {file.Branch || '-'}
              </td>

              <td>

                <a
                  href={file.archivalFilePath}
                  target="_blank"
                  rel="noreferrer"
                >
                  View
                </a>

              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>

  )
}