// import { useState } from 'react'

// import Sidebar from '../components/Sidebar'
// import Navbar from '../components/Navbar'
// import FileUpload from '../components/FileUpload'
// import FileSearch from '../components/FileSearch'
// import FileList from '../components/FileList'
// import AISearch from '../components/AISearch'
// import DocumentPreviewModal from '../components/DocumentPreviewModal'
// import DocumentVersionsModal from '../components/DocumentVersionsModal'
// import { deleteDocument } from '../utils/documentApi'
// import { searchDocuments, SEARCH_LAMBDA_URL } from '../utils/searchApi'

// export default function Home() {
//   const [query, setQuery] = useState('')
//   const [filter, setFilter] = useState('DocumentType')
//   const [sidebarOpen, setSidebarOpen] = useState(true)
//   const [activeTab, setActiveTab] = useState('upload')
//   const [files, setFiles] = useState([])
//   const [resultCount, setResultCount] = useState(null)
//   const [loading, setLoading] = useState(false)
//   const [error, setError] = useState('')
//   const [previewDocumentId, setPreviewDocumentId] = useState(null)
//   const [versionsDocument, setVersionsDocument] = useState(null)
//   const [deletingId, setDeletingId] = useState('')
//   const [selectedIds, setSelectedIds] = useState(() => new Set())
//   const [bulkDeleting, setBulkDeleting] = useState(false)

//   const docId = (file) => file?.uuid || file?.DocumentId || file?.documentId || ''

//   async function handleSearch() {
//     const trimmed = query.trim()
//     if (!trimmed) {
//       setError('Enter a search term.')
//       setFiles([])
//       setResultCount(null)
//       return
//     }

//     setLoading(true)
//     setError('')
//     setResultCount(null)
//     setSelectedIds(new Set())

//     try {
//       console.info('[ECM Search] POST', SEARCH_LAMBDA_URL)
//       const { results, count } = await searchDocuments({
//         query: trimmed,
//         filter,
//       })
//       setFiles(results)
//       setResultCount(count)
//     } catch (err) {
//       setFiles([])
//       setResultCount(null)
//       setError(err.message || 'Search failed')
//     } finally {
//       setLoading(false)
//     }
//   }

//   async function handleDelete(documentId) {
//     const title =
//       files.find((file) => (file.uuid || file.DocumentId) === documentId)?.DocumentTitle ||
//       documentId

//     if (!window.confirm(`Delete "${title}" permanently from S3 and DynamoDB?`)) {
//       return
//     }

//     setDeletingId(documentId)
//     setError('')

//     try {
//       await deleteDocument(documentId)
//       setFiles((prev) => prev.filter((file) => docId(file) !== documentId))
//       setResultCount((prev) => (typeof prev === 'number' ? Math.max(0, prev - 1) : prev))
//       setSelectedIds((prev) => {
//         if (!prev.has(documentId)) return prev
//         const next = new Set(prev)
//         next.delete(documentId)
//         return next
//       })
//       if (previewDocumentId === documentId) {
//         setPreviewDocumentId(null)
//       }
//     } catch (err) {
//       setError(err.message || 'Delete failed')
//     } finally {
//       setDeletingId('')
//     }
//   }

//   function handleToggleSelect(documentId) {
//     setSelectedIds((prev) => {
//       const next = new Set(prev)
//       if (next.has(documentId)) next.delete(documentId)
//       else next.add(documentId)
//       return next
//     })
//   }

//   function handleToggleSelectAll() {
//     const ids = files.map(docId).filter(Boolean)
//     setSelectedIds((prev) => {
//       const allSelected = ids.length > 0 && ids.every((id) => prev.has(id))
//       return allSelected ? new Set() : new Set(ids)
//     })
//   }

//   async function handleBulkDelete() {
//     const ids = [...selectedIds]
//     if (!ids.length) return

//     if (
//       !window.confirm(
//         `Delete ${ids.length} selected document${ids.length === 1 ? '' : 's'} permanently from S3 and DynamoDB?`
//       )
//     ) {
//       return
//     }

//     setBulkDeleting(true)
//     setError('')

//     const outcomes = await Promise.allSettled(ids.map((id) => deleteDocument(id)))
//     const deletedIds = ids.filter((_, i) => outcomes[i].status === 'fulfilled')

//     if (deletedIds.length) {
//       const deletedSet = new Set(deletedIds)
//       setFiles((prev) => prev.filter((file) => !deletedSet.has(docId(file))))
//       setResultCount((prev) =>
//         typeof prev === 'number' ? Math.max(0, prev - deletedIds.length) : prev
//       )
//       if (deletedSet.has(previewDocumentId)) {
//         setPreviewDocumentId(null)
//       }
//     }

//     setSelectedIds((prev) => {
//       const next = new Set(prev)
//       deletedIds.forEach((id) => next.delete(id))
//       return next
//     })

//     const failed = ids.length - deletedIds.length
//     if (failed > 0) {
//       setError(`${failed} document${failed === 1 ? '' : 's'} could not be deleted.`)
//     }

//     setBulkDeleting(false)
//   }

//   function handleOpenVersions(documentId, title) {
//     setVersionsDocument({ documentId, title })
//   }

//   function handleToggleSidebar() {
//     setSidebarOpen((prev) => !prev)
//   }

//   const pageTitle =
//     activeTab === 'ai-search'
//       ? 'AI Document Search'
//       : activeTab === 'search'
//         ? 'Metadata search'
//         : 'Asset library'

//   const pageSubtitle =
//     activeTab === 'ai-search'
//       ? 'Semantic search powered by vector embeddings — find relevant document chunks by meaning, not just keywords.'
//       : activeTab === 'search'
//         ? 'Search documents by metadata fields such as document type, account number, and branch.'
//         : 'Manage and search your enterprise content'

//   return (
//     <div className={`app-layout ${sidebarOpen ? '' : 'sidebar-hidden'}`}>
//       <Sidebar collapsed={!sidebarOpen} onToggle={handleToggleSidebar} />

//       <div className="main-wrapper">
//         <Navbar activeTab={activeTab} onTabChange={setActiveTab} />

//         <main className="main-content">
//           <header className="page-header fade-in">
//             <h1>{pageTitle}</h1>
//             <p className="text-muted">{pageSubtitle}</p>
//           </header>

//           {activeTab === 'upload' && (
//             <section className="tab-panel fade-in">
//               <FileUpload />
//             </section>
//           )}

//           {activeTab === 'search' && (
//             <section className="tab-panel tab-panel--search fade-in">
//               <FileSearch
//                 query={query}
//                 filter={filter}
//                 onQueryChange={setQuery}
//                 onFilterChange={setFilter}
//                 onSearch={handleSearch}
//                 loading={loading}
//               />

//               {error && <p className="text-danger">{error}</p>}

//               <div className="search-results-region">
//                 {resultCount !== null && !error && (
//                   <p className="search-result-count text-muted">
//                     {resultCount} document{resultCount === 1 ? '' : 's'} found
//                   </p>
//                 )}

//                 {selectedIds.size > 0 && (
//                   <div className="bulk-actions-bar fade-in">
//                     <span className="bulk-actions-count">
//                       {selectedIds.size} selected
//                     </span>
//                     <div className="bulk-actions-buttons">
//                       <button
//                         type="button"
//                         className="btn btn-danger btn-sm"
//                         onClick={handleBulkDelete}
//                         disabled={bulkDeleting}
//                       >
//                         {bulkDeleting
//                           ? 'Deleting…'
//                           : `Delete selected (${selectedIds.size})`}
//                       </button>
//                       <button
//                         type="button"
//                         className="btn btn-outline btn-sm"
//                         onClick={() => setSelectedIds(new Set())}
//                         disabled={bulkDeleting}
//                       >
//                         Clear
//                       </button>
//                     </div>
//                   </div>
//                 )}

//                 <FileList
//                   files={files}
//                   onView={setPreviewDocumentId}
//                   onVersions={handleOpenVersions}
//                   onDelete={handleDelete}
//                   deletingId={deletingId}
//                   selectedIds={selectedIds}
//                   onToggleSelect={handleToggleSelect}
//                   onToggleSelectAll={handleToggleSelectAll}
//                 />
//               </div>
//             </section>
//           )}

//           {/* {activeTab === 'ai-search' && (
//             <section className="tab-panel fade-in">
//               <AISearch onView={setPreviewDocumentId} />
//             </section>
//           )} */}
//         </main>
//       </div>

//       <DocumentPreviewModal
//         documentId={previewDocumentId}
//         onClose={() => setPreviewDocumentId(null)}
//       />

//       <DocumentVersionsModal
//         documentId={versionsDocument?.documentId || null}
//         title={versionsDocument?.title}
//         onClose={() => setVersionsDocument(null)}
//         onChanged={() => {
//           if (resultCount !== null && query.trim()) {
//             handleSearch()
//           }
//         }}
//       />
//     </div>
//   )
// }
import { useState } from 'react'

import Sidebar from '../components/Sidebar'
import Navbar from '../components/Navbar'
import FileUpload from '../components/FileUpload'
import FileSearch from '../components/FileSearch'
import FileList from '../components/FileList'
import AISearch from '../components/AISearch'
import DocumentPreviewModal from '../components/DocumentPreviewModal'
import DocumentVersionsModal from '../components/DocumentVersionsModal'
import { deleteDocument, downloadDocumentsZip } from '../utils/documentApi'
import { searchDocuments, SEARCH_LAMBDA_URL } from '../utils/searchApi'

export default function Home() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('DocumentType')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeTab, setActiveTab] = useState('upload')
  const [files, setFiles] = useState([])
  const [resultCount, setResultCount] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [previewDocumentId, setPreviewDocumentId] = useState(null)
  const [versionsDocument, setVersionsDocument] = useState(null)
  const [deletingId, setDeletingId] = useState('')
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkDownloading, setBulkDownloading] = useState(false)

  const docId = (file) => file?.uuid || file?.DocumentId || file?.documentId || ''

  async function handleSearch() {
    const trimmed = query.trim()
    if (!trimmed) {
      setError('Enter a search term.')
      setFiles([])
      setResultCount(null)
      return
    }

    setLoading(true)
    setError('')
    setResultCount(null)
    setSelectedIds(new Set())

    try {
      console.info('[ECM Search] POST', SEARCH_LAMBDA_URL)
      const { results, count } = await searchDocuments({
        query: trimmed,
        filter,
      })
      setFiles(results)
      setResultCount(count)
    } catch (err) {
      setFiles([])
      setResultCount(null)
      setError(err.message || 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(documentId) {
    const title =
      files.find((file) => (file.uuid || file.DocumentId) === documentId)?.DocumentTitle ||
      documentId

    if (!window.confirm(`Delete "${title}" permanently from S3 and DynamoDB?`)) {
      return
    }

    setDeletingId(documentId)
    setError('')

    try {
      await deleteDocument(documentId)
      setFiles((prev) => prev.filter((file) => docId(file) !== documentId))
      setResultCount((prev) => (typeof prev === 'number' ? Math.max(0, prev - 1) : prev))
      setSelectedIds((prev) => {
        if (!prev.has(documentId)) return prev
        const next = new Set(prev)
        next.delete(documentId)
        return next
      })
      if (previewDocumentId === documentId) {
        setPreviewDocumentId(null)
      }
    } catch (err) {
      setError(err.message || 'Delete failed')
    } finally {
      setDeletingId('')
    }
  }

  function handleToggleSelect(documentId) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(documentId)) next.delete(documentId)
      else next.add(documentId)
      return next
    })
  }

  function handleToggleSelectAll() {
    const ids = files.map(docId).filter(Boolean)
    setSelectedIds((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id))
      return allSelected ? new Set() : new Set(ids)
    })
  }

  async function handleBulkDelete() {
    const ids = [...selectedIds]
    if (!ids.length) return

    if (
      !window.confirm(
        `Delete ${ids.length} selected document${ids.length === 1 ? '' : 's'} permanently from S3 and DynamoDB?`
      )
    ) {
      return
    }

    setBulkDeleting(true)
    setError('')

    const outcomes = await Promise.allSettled(ids.map((id) => deleteDocument(id)))
    const deletedIds = ids.filter((_, i) => outcomes[i].status === 'fulfilled')

    if (deletedIds.length) {
      const deletedSet = new Set(deletedIds)
      setFiles((prev) => prev.filter((file) => !deletedSet.has(docId(file))))
      setResultCount((prev) =>
        typeof prev === 'number' ? Math.max(0, prev - deletedIds.length) : prev
      )
      if (deletedSet.has(previewDocumentId)) {
        setPreviewDocumentId(null)
      }
    }

    setSelectedIds((prev) => {
      const next = new Set(prev)
      deletedIds.forEach((id) => next.delete(id))
      return next
    })

    const failed = ids.length - deletedIds.length
    if (failed > 0) {
      setError(`${failed} document${failed === 1 ? '' : 's'} could not be deleted.`)
    }

    setBulkDeleting(false)
  }

  async function handleBulkDownload() {
    const documents = files
      .filter((file) => selectedIds.has(docId(file)))
      .map((file) => ({ documentId: docId(file), title: file.DocumentTitle }))

    if (!documents.length) return

    setBulkDownloading(true)
    setError('')

    try {
      const { failed } = await downloadDocumentsZip(documents, {
        zipName: `documents-${documents.length}`,
      })
      if (failed.length) {
        setError(
          `${failed.length} document${failed.length === 1 ? '' : 's'} could not be added to the ZIP.`
        )
      }
    } catch (err) {
      setError(err.message || 'Download failed.')
    } finally {
      setBulkDownloading(false)
    }
  }

  function handleOpenVersions(documentId, title) {
    setVersionsDocument({ documentId, title })
  }

  function handleToggleSidebar() {
    setSidebarOpen((prev) => !prev)
  }

  const pageTitle =
    activeTab === 'ai-search'
      ? 'AI Document Search'
      : activeTab === 'search'
        ? 'Metadata search'
        : 'Asset library'

  const pageSubtitle =
    activeTab === 'ai-search'
      ? 'Semantic search powered by vector embeddings — find relevant document chunks by meaning, not just keywords.'
      : activeTab === 'search'
        ? 'Search documents by metadata fields such as document type, account number, and branch.'
        : 'Manage and search your enterprise content'

  return (
    <div className={`app-layout ${sidebarOpen ? '' : 'sidebar-hidden'}`}>
      <Sidebar collapsed={!sidebarOpen} onToggle={handleToggleSidebar} />

      <div className="main-wrapper">
        <Navbar activeTab={activeTab} onTabChange={setActiveTab} />

        <main className="main-content">
          <header className="page-header fade-in">
            <h1>{pageTitle}</h1>
            <p className="text-muted">{pageSubtitle}</p>
          </header>

          {activeTab === 'upload' && (
            <section className="tab-panel fade-in">
              <FileUpload />
            </section>
          )}

          {activeTab === 'search' && (
            <section className="tab-panel tab-panel--search fade-in">
              <FileSearch
                query={query}
                filter={filter}
                onQueryChange={setQuery}
                onFilterChange={setFilter}
                onSearch={handleSearch}
                loading={loading}
              />

              {error && <p className="text-danger">{error}</p>}

              <div className="search-results-region">
                {resultCount !== null && !error && (
                  <p className="search-result-count text-muted">
                    {resultCount} document{resultCount === 1 ? '' : 's'} found
                  </p>
                )}

                {selectedIds.size > 0 && (
                  <div className="bulk-actions-bar fade-in">
                    <span className="bulk-actions-count">
                      {selectedIds.size} selected
                    </span>
                    <div className="bulk-actions-buttons">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={handleBulkDownload}
                        disabled={bulkDownloading || bulkDeleting}
                      >
                        {bulkDownloading
                          ? 'Preparing ZIP…'
                          : `Download ZIP (${selectedIds.size})`}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={handleBulkDelete}
                        disabled={bulkDeleting || bulkDownloading}
                      >
                        {bulkDeleting
                          ? 'Deleting…'
                          : `Delete selected (${selectedIds.size})`}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => setSelectedIds(new Set())}
                        disabled={bulkDeleting || bulkDownloading}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}

                <FileList
                  files={files}
                  onView={setPreviewDocumentId}
                  onVersions={handleOpenVersions}
                  onDelete={handleDelete}
                  deletingId={deletingId}
                  selectedIds={selectedIds}
                  onToggleSelect={handleToggleSelect}
                  onToggleSelectAll={handleToggleSelectAll}
                />
              </div>
            </section>
          )}

          {/* {activeTab === 'ai-search' && (
            <section className="tab-panel fade-in">
              <AISearch onView={setPreviewDocumentId} />
            </section>
          )} */}
        </main>
      </div>

      <DocumentPreviewModal
        documentId={previewDocumentId}
        onClose={() => setPreviewDocumentId(null)}
      />

      <DocumentVersionsModal
        documentId={versionsDocument?.documentId || null}
        title={versionsDocument?.title}
        onClose={() => setVersionsDocument(null)}
      />
    </div>
  )
}