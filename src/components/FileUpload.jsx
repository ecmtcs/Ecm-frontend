import { useState } from 'react'
import { saveFile } from '../utils/files'
import { getSession } from '../utils/auth'

export default function FileUpload({ onUploaded }) {
  const [fileName, setFileName] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setFileName(file.name)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!selectedFile) return

    const session = getSession()
    const file = saveFile({
      name: fileName || selectedFile.name,
      owner: session.name,
    })

    setSelectedFile(null)
    setFileName('')
    e.currentTarget.reset()
    onUploaded(file)
  }

  return (
    <form className="upload-card fade-in" onSubmit={handleSubmit}>
      <h3>Upload asset</h3>
      <p className="text-muted">Files are stored locally until AWS S3 is connected.</p>

      <label className="file-drop">
        <input type="file" onChange={handleFileChange} />
        <span>{selectedFile ? selectedFile.name : 'Choose a file or drag here'}</span>
      </label>

      <div className="form-group">
        <label htmlFor="assetName">Asset name</label>
        <input
          id="assetName"
          type="text"
          placeholder="Display name (optional)"
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
        />
      </div>

      <button type="submit" className="btn btn-primary" disabled={!selectedFile}>
        Upload
      </button>
    </form>
  )
}
