// import { useState } from 'react'
// import { saveFile } from '../utils/files'
// import { getSession } from '../utils/auth'

// import { UPLOAD_LAMBDA_URL } from '../config/api.js'

// // UPLOAD_LAMBDA_URL uses /api/upload proxy in dev (see vite.config.js)

// const METADATA_KEY = 'ecm_metadata'

// async function callCopyLambda(rows) {
//   const response = await fetch(UPLOAD_LAMBDA_URL, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ rows }),
//   })

//   let data
//   try {
//     data = await response.json()
//   } catch {
//     throw new Error('Invalid response from Lambda.')
//   }

//   if (!response.ok && response.status !== 207) {
//     const message =
//       (typeof data === 'object' && data?.error) ||
//       `Lambda request failed (${response.status}).`
//     throw new Error(message)
//   }

//   if (!Array.isArray(data)) {
//     throw new Error('Unexpected response from Lambda.')
//   }

//   const failures = data.filter((item) => item.status === 'error')
//   if (failures.length === data.length) {
//     throw new Error(failures[0]?.error || 'All files failed to process.')
//   }

//   return data
// }

// async function readTextFile(file) {
//   return new Promise((resolve, reject) => {
//     const reader = new FileReader()
//     reader.onload = () => resolve(reader.result)
//     reader.onerror = () => reject(reader.error)
//     reader.readAsText(file)
//   })
// }

// async function parseCsvFile(file) {
//   const text = await readTextFile(file)
//   const lines = text
//     .replace(/\r\n/g, '\n')
//     .replace(/\r/g, '\n')
//     .split('\n')
//     .filter((line) => line.trim() !== '')

//   if (lines.length === 0) {
//     return { headers: [], rows: [] }
//   }

//   const headers = lines[0].split(',').map((header) => header.trim())
//   const rows = lines.slice(1).map((line) => {
//     const values = line.split(',').map((value) => value.trim())
//     return headers.reduce((row, header, index) => {
//       row[header] = values[index] ?? ''
//       return row
//     }, {})
//   })

//   return { headers, rows }
// }

// function getCsvFileKey(headers) {
//   const normalized = headers.map((header) => header.trim().toLowerCase())
//   const candidates = ['file path', 'filepath', 'file name', 'filename', 'path', 'documentpath', 'document path']
//   const index = normalized.findIndex((header) => candidates.includes(header))
//   return headers[index] || headers[0] || 'file'
// }
// function getColumnKey(headers, possibleNames) {
//   const normalizedHeaders = headers.map((header) =>
//     header.trim().toLowerCase()
//   )

//   const index = normalizedHeaders.findIndex((header) =>
//     possibleNames.includes(header)
//   )
//   return index !== -1 ? headers[index] : null
// }
// function saveMetadata(items) {
//   try {
//     const existing = JSON.parse(localStorage.getItem(METADATA_KEY) || '[]')
//     const allItems = Array.isArray(existing) ? existing.concat(items) : items
//     localStorage.setItem(METADATA_KEY, JSON.stringify(allItems))
//     return allItems
//   } catch (error) {
//     throw new Error('Failed to save metadata locally.')
//   }
// }

// function buildMetadata(row, fileKey, owner, lambdaResult) {
//   return {
//     owner,
//     fileUrl: lambdaResult?.newS3Path || '',
//     uuid: lambdaResult?.uuid || '',
//     uploadedAt: new Date().toISOString(),
//     fileName: row[fileKey] || '',
//     metadata: Object.entries(row).reduce((acc, [key, value]) => {
//       if (key === fileKey) return acc
//       if (value != null && `${value}`.trim() !== '') {
//         acc[key] = value
//       }
//       return acc
//     }, {}),
//   }
// }

// export default function FileUpload({ onUploaded }) {
//   const [csvFile, setCsvFile] = useState(null)
//   const [parsedHeaders, setParsedHeaders] = useState([])
//   const [parsedRows, setParsedRows] = useState([])
//   const [statusMessage, setStatusMessage] = useState('')
//   const [errorMessage, setErrorMessage] = useState('')
//   const [isSubmitting, setIsSubmitting] = useState(false)

//   function handleCsvChange(e) {
//     const file = e.target.files?.[0]
//     if (!file) return

//     if (!file.name.toLowerCase().endsWith('.csv')) {
//       alert('Only .csv files are allowed.')
//       e.target.value = ''
//       setCsvFile(null)
//       setStatusMessage('')
//       setErrorMessage('')
//       return
//     }

//     setCsvFile(file)
//     setStatusMessage('')
//     setErrorMessage('')
//   }

//   async function handleSubmit(e) {
//     e.preventDefault()
//     setErrorMessage('')
//     setStatusMessage('')

//     if (!csvFile) {
//       setErrorMessage('Please select a CSV file to upload.')
//       return
//     }

//     setIsSubmitting(true)

//     try {
//       const session = getSession()
//       const owner = session?.name || 'Unknown'
//       const { headers, rows } = await parseCsvFile(csvFile)

//       if (rows.length === 0) {
//         throw new Error('The CSV file contains no rows.')
//       }

//       const filePathKey = getColumnKey(headers, [
//         'filepath',
//         'file path'
//       ])

//       const documentTypeKey = getColumnKey(headers, [
//         'documenttype',
//         'document type'
//       ])

//       if (!filePathKey) {
//         throw new Error('FilePath column not found.')
//       }

//       if (!documentTypeKey) {
//         throw new Error('DocumentType column not found.')
//       }

//       // Send full CSV row so Lambda can persist all columns (except source FilePath) to DynamoDB.
//       const lambdaRows = rows.map((row) => {
//         const payload = { ...row }
//         if (filePathKey !== 'FilePath') {
//           payload.FilePath = row[filePathKey]
//         }
//         if (documentTypeKey !== 'DocumentType') {
//           payload.DocumentType = row[documentTypeKey]
//         }
//         return payload
//       })

//       setParsedHeaders(headers)
//       setParsedRows(lambdaRows)

//       const lambdaResponse = await callCopyLambda(lambdaRows)
//       console.log('Lambda Response:', lambdaResponse)

//       const copiedCount = lambdaResponse.filter((r) => r.status === 'copied').length
//       const failedCount = lambdaResponse.filter((r) => r.status === 'error').length

//       const fileKey = getCsvFileKey(headers)
//       const uploadMetadata = rows.map((row, index) =>
//         buildMetadata(row, fileKey, owner, lambdaResponse[index])
//       )

//       saveMetadata(uploadMetadata)

//       const savedRecord = saveFile({ name: csvFile.name, owner })
//       setCsvFile(null)
//       setParsedRows([])
//       setParsedHeaders([])
//       e.currentTarget.reset()

//       const metadataSavedCount = lambdaResponse.filter(
//         (r) => r.status === 'copied' && r.metadataSaved
//       ).length

//       let message = `Copied ${copiedCount} file(s) to Archival and saved ${metadataSavedCount} record(s) to DynamoDB.`
//       if (failedCount > 0) {
//         message += ` ${failedCount} row(s) failed.`
//       }
//       setStatusMessage(message)
//       onUploaded(savedRecord)
//     } catch (err) {
//       setErrorMessage(err.message || 'Upload failed. Please try again.')
//     } finally {
//       setIsSubmitting(false)
//     }
//   }

//   return (
//     <form className="upload-card fade-in" onSubmit={handleSubmit}>
//       <h3>Upload asset</h3>
//       <p className="text-muted">
//         CSV is parsed, then sent to AWS Lambda to copy files into Archival and save metadata to DynamoDB.
//       </p>

//       <label className="file-drop">
//         <div>CSV file</div>
//         <input type="file" accept=".csv" onChange={handleCsvChange} />
//         <span>{csvFile ? csvFile.name : 'Choose a CSV file'}</span>
//       </label>

//       {errorMessage && <p className="text-danger">{errorMessage}</p>}
//       {statusMessage && <p className="text-success">{statusMessage}</p>}

//       <button type="submit" className="btn btn-primary" disabled={isSubmitting || !csvFile}>
//         {isSubmitting ? 'Processing...' : 'Upload'}
//       </button>

//       {parsedRows.length > 0 && (
//         <div className="csv-preview">
//           <h4>Parsed CSV preview</h4>
//           <p>{parsedRows.length} row(s) parsed</p>
//           <div className="table-responsive">
//             <table className="csv-table">
//               <thead>
//                 <tr>
//                   {parsedHeaders.map((header) => (
//                     <th key={header}>{header}</th>
//                   ))}
//                 </tr>
//               </thead>
//               <tbody>
//                 {parsedRows.slice(0, 5).map((row, rowIndex) => (
//                   <tr key={rowIndex}>
//                     {parsedHeaders.map((header) => (
//                       <td key={`${rowIndex}-${header}`}>{row[header]}</td>
//                     ))}
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//             {parsedRows.length > 5 && <p>Showing first 5 rows.</p>}
//           </div>
//         </div>
//       )}
//     </form>
//   )
// }

import { useState } from 'react'
import { saveFile } from '../utils/files'
import { getSession } from '../utils/auth'

import { UPLOAD_LAMBDA_URL } from '../config/api.js'

// UPLOAD_LAMBDA_URL uses /api/upload proxy in dev (see vite.config.js)

const METADATA_KEY = 'ecm_metadata'

function parseUploadLambdaBody(rawText, response) {
  if (!rawText?.trim()) {
    const status = response?.status
    throw new Error(
      status
        ? `Empty response from upload service (HTTP ${status}).`
        : 'Empty response from upload service.'
    )
  }

  let parsed
  try {
    parsed = JSON.parse(rawText)
  } catch {
    throw new Error('Invalid response from Lambda.')
  }

  // Lambda may return API Gateway shape: { statusCode, body: "..." }
  if (parsed && typeof parsed === 'object' && 'statusCode' in parsed && 'body' in parsed) {
    const statusCode = parsed.statusCode
    const inner =
      typeof parsed.body === 'string' ? JSON.parse(parsed.body) : parsed.body

    if (statusCode >= 400) {
      throw new Error(inner?.error || `Lambda request failed (${statusCode}).`)
    }
    return inner
  }

  return parsed
}

async function callCopyLambda(rows) {
  let response
  try {
    response = await fetch(UPLOAD_LAMBDA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    })
  } catch {
    throw new Error(
      'Could not reach the upload API. Use /api/upload proxy (Vercel rewrites or npm run dev) or enable CORS on the Lambda Function URL.'
    )
  }

  const rawText = await response.text()
  const data = parseUploadLambdaBody(rawText, response)

  if (!response.ok && response.status !== 207) {
    const message =
      (typeof data === 'object' && data?.error) ||
      `Lambda request failed (${response.status}).`
    throw new Error(message)
  }

  if (!Array.isArray(data)) {
    throw new Error('Unexpected response from Lambda.')
  }

  const failures = data.filter((item) => item.status === 'error')
  if (failures.length === data.length) {
    throw new Error(failures[0]?.error || 'All files failed to process.')
  }

  return data
}

async function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

async function parseCsvFile(file) {
  const text = await readTextFile(file)
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((line) => line.trim() !== '')

  if (lines.length === 0) {
    return { headers: [], rows: [] }
  }

  const headers = lines[0].split(',').map((header) => header.trim())
  const rows = lines.slice(1).map((line) => {
    const values = line.split(',').map((value) => value.trim())
    return headers.reduce((row, header, index) => {
      row[header] = values[index] ?? ''
      return row
    }, {})
  })

  return { headers, rows }
}

function getCsvFileKey(headers) {
  const normalized = headers.map((header) => header.trim().toLowerCase())
  const candidates = ['file path', 'filepath', 'file name', 'filename', 'path', 'documentpath', 'document path']
  const index = normalized.findIndex((header) => candidates.includes(header))
  return headers[index] || headers[0] || 'file'
}
function getColumnKey(headers, possibleNames) {
  const normalizedHeaders = headers.map((header) =>
    header.trim().toLowerCase()
  )

  const index = normalizedHeaders.findIndex((header) =>
    possibleNames.includes(header)
  )
  return index !== -1 ? headers[index] : null
}
function saveMetadata(items) {
  try {
    const existing = JSON.parse(localStorage.getItem(METADATA_KEY) || '[]')
    const allItems = Array.isArray(existing) ? existing.concat(items) : items
    localStorage.setItem(METADATA_KEY, JSON.stringify(allItems))
    return allItems
  } catch (error) {
    throw new Error('Failed to save metadata locally.')
  }
}

function formatCreator(session) {
  if (!session) return 'Unknown'
  const { name, email } = session
  if (name && email) return `${name} (${email})`
  return name || email || 'Unknown'
}

function buildMetadata(row, fileKey, creator, lambdaResult) {
  const dynamoItem = lambdaResult?.dynamoItem || {}
  const sourceFileName =
    row[fileKey] ||
    lambdaResult?.documentTitle ||
    dynamoItem.DocumentTitle ||
    ''

  return {
    owner: creator,
    fileUrl: lambdaResult?.newS3Path || '',
    uuid: lambdaResult?.uuid || '',
    uploadedAt: dynamoItem.CreatedDate || lambdaResult?.createdDate || new Date().toISOString(),
    fileName: sourceFileName,
    documentTitle: dynamoItem.DocumentTitle || lambdaResult?.documentTitle || sourceFileName,
    creator: dynamoItem.Creator || lambdaResult?.creator || creator,
    createdDate: dynamoItem.CreatedDate || lambdaResult?.createdDate || '',
    size: dynamoItem.Size ?? lambdaResult?.size ?? null,
    mimeType: dynamoItem.MimeType || lambdaResult?.mimeType || '',
    metadata: Object.entries(row).reduce((acc, [key, value]) => {
      if (key === fileKey) return acc
      if (value != null && `${value}`.trim() !== '') {
        acc[key] = value
      }
      return acc
    }, {}),
  }
}

export default function FileUpload({ onUploaded }) {
  const [csvFile, setCsvFile] = useState(null)
  const [parsedHeaders, setParsedHeaders] = useState([])
  const [parsedRows, setParsedRows] = useState([])
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleCsvChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Only .csv files are allowed.')
      e.target.value = ''
      setCsvFile(null)
      setStatusMessage('')
      setErrorMessage('')
      return
    }

    setCsvFile(file)
    setStatusMessage('')
    setErrorMessage('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErrorMessage('')
    setStatusMessage('')

    if (!csvFile) {
      setErrorMessage('Please select a CSV file to upload.')
      return
    }

    setIsSubmitting(true)

    try {
      const session = getSession()
      const creator = formatCreator(session)
      const { headers, rows } = await parseCsvFile(csvFile)

      if (rows.length === 0) {
        throw new Error('The CSV file contains no rows.')
      }

      const filePathKey = getColumnKey(headers, [
        'filepath',
        'file path'
      ])

      const documentTypeKey = getColumnKey(headers, [
        'documenttype',
        'document type'
      ])

      if (!filePathKey) {
        throw new Error('FilePath column not found.')
      }

      if (!documentTypeKey) {
        throw new Error('DocumentType column not found.')
      }

      // Send full CSV row so Lambda can persist all columns (except source FilePath) to DynamoDB.
      const lambdaRows = rows.map((row) => {
        const payload = { ...row }
        if (filePathKey !== 'FilePath') {
          payload.FilePath = row[filePathKey]
        }
        if (documentTypeKey !== 'DocumentType') {
          payload.DocumentType = row[documentTypeKey]
        }
        payload.Creator = creator
        if (session?.name) payload.CreatorName = session.name
        if (session?.email) payload.CreatorEmail = session.email
        return payload
      })

      setParsedHeaders(headers)
      setParsedRows(lambdaRows)

      const lambdaResponse = await callCopyLambda(lambdaRows)
      console.log('Lambda Response:', lambdaResponse)

      const copiedCount = lambdaResponse.filter((r) => r.status === 'copied').length
      const failedCount = lambdaResponse.filter((r) => r.status === 'error').length

      const fileKey = getCsvFileKey(headers)
      const uploadMetadata = rows.map((row, index) =>
        buildMetadata(row, fileKey, creator, lambdaResponse[index])
      )

      saveMetadata(uploadMetadata)

      const savedRecord = saveFile({ name: csvFile.name, owner: creator })
      setCsvFile(null)
      setParsedRows([])
      setParsedHeaders([])
      e.currentTarget.reset()

      const metadataSavedCount = lambdaResponse.filter(
        (r) => r.status === 'copied' && r.metadataSaved
      ).length

      let message = `Copied ${copiedCount} file(s) to Archival and saved ${metadataSavedCount} record(s) to DynamoDB.`
      if (failedCount > 0) {
        message += ` ${failedCount} row(s) failed.`
      }
      setStatusMessage(message)
      onUploaded(savedRecord)
    } catch (err) {
      setErrorMessage(err.message || 'Upload failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="upload-card fade-in" onSubmit={handleSubmit}>
      <h3>Bulk Upload</h3>
      <p className="text-muted">
        CSV is parsed, then sent to AWS Lambda to copy files into Archival and save metadata to DynamoDB.
      </p>

      <label className="file-drop">
        <div>CSV file</div>
        <input type="file" accept=".csv" onChange={handleCsvChange} />
        <span>{csvFile ? csvFile.name : 'Choose a CSV file'}</span>
      </label>

      {errorMessage && <p className="text-danger">{errorMessage}</p>}
      {statusMessage && <p className="text-success">{statusMessage}</p>}

      <button type="submit" className="btn btn-primary" disabled={isSubmitting || !csvFile}>
        {isSubmitting ? 'Processing...' : 'Upload'}
      </button>

      {parsedRows.length > 0 && (
        <div className="csv-preview">
          <h4>Parsed CSV preview</h4>
          <p>{parsedRows.length} row(s) parsed</p>
          <div className="table-responsive">
            <table className="csv-table">
              <thead>
                <tr>
                  {parsedHeaders.map((header) => (
                    <th key={header}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsedRows.slice(0, 5).map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {parsedHeaders.map((header) => (
                      <td key={`${rowIndex}-${header}`}>{row[header]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {parsedRows.length > 5 && <p>Showing first 5 rows.</p>}
          </div>
        </div>
      )}
    </form>
  )
}