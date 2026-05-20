import { useState } from 'react'
import { saveFile } from '../utils/files'
import { getSession } from '../utils/auth'

const METADATA_KEY = 'ecm_metadata'

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

function buildMetadata(row, fileKey, owner) {
  return {
    owner,
    fileUrl: '',
    uploadedAt: new Date().toISOString(),
    fileName: row[fileKey] || '',
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
      const owner = session?.name || 'Unknown'
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

      const filteredRows = rows.map((row) => ({
        FilePath: row[filePathKey],
        DocumentType: row[documentTypeKey]
      }))

      setParsedHeaders(['FilePath', 'DocumentType'])
      setParsedRows(filteredRows)
      const response = await fetch(
        'https://trloz5caellu5a4odhzeyesl3y0zwxet.lambda-url.us-east-1.on.aws/',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            rows: filteredRows
          })
        }
      )

      if (!response.ok) {
        throw new Error('Failed to process files.')
      }

      const lambdaResponse = await response.json()

      console.log('Lambda Response:', lambdaResponse)

      setStatusMessage(
        `Successfully processed ${lambdaResponse.length} file(s).`
      )

      const fileKey = getCsvFileKey(headers)
      const uploadMetadata = rows.map((row) => buildMetadata(row, fileKey, owner))

      await saveMetadata(uploadMetadata)

      const savedRecord = saveFile({ name: csvFile.name, owner })
      setCsvFile(null)
      e.currentTarget.reset()
      setStatusMessage(`CSV parsed and saved locally: ${rows.length} row(s)`)
      onUploaded(savedRecord)
    } catch (err) {
      setErrorMessage(err.message || 'Upload failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="upload-card fade-in" onSubmit={handleSubmit}>
      <h3>Upload asset</h3>
      <p className="text-muted">CSV metadata is stored locally in the browser for now.</p>

      <label className="file-drop">
        <div>CSV file</div>
        <input type="file" accept=".csv" onChange={handleCsvChange} />
        <span>{csvFile ? csvFile.name : 'Choose a CSV file'}</span>
      </label>

      {errorMessage && <p className="text-danger">{errorMessage}</p>}
      {statusMessage && <p className="text-success">{statusMessage}</p>}

      <button type="submit" className="btn btn-primary" disabled={isSubmitting || !csvFile}>
        {isSubmitting ? 'Parsing...' : 'Upload'}
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
