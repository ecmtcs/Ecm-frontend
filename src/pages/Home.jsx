// import { useState } from 'react'

// import Sidebar from '../components/Sidebar'
// import Navbar from '../components/Navbar'
// import FileUpload from '../components/FileUpload'
// import FileSearch from '../components/FileSearch'
// import FileList from '../components/FileList'
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

//   function handleToggleSidebar() {
//     setSidebarOpen((prev) => !prev)
//   }

//   return (
//     <div className={`app-layout ${sidebarOpen ? '' : 'sidebar-hidden'}`}>
//       <Sidebar collapsed={!sidebarOpen} onToggle={handleToggleSidebar} />

//       <div className="main-wrapper">
//         <Navbar activeTab={activeTab} onTabChange={setActiveTab} />

//         <main className="main-content">
//           <header className="page-header fade-in">
//             <h1>Asset library</h1>
//             <p className="text-muted">
//               Manage and search your enterprise content
//             </p>
//           </header>

//           {activeTab === 'upload' && (
//             <section className="tab-panel fade-in">
//               <FileUpload />
//             </section>
//           )}

//           {activeTab === 'search' && (
//             <section className="tab-panel fade-in">
//               <FileSearch
//                 query={query}
//                 filter={filter}
//                 onQueryChange={setQuery}
//                 onFilterChange={setFilter}
//                 onSearch={handleSearch}
//                 loading={loading}
//               />

//               {/* <p className="text-muted search-api-hint">
//                 Search API: {SEARCH_LAMBDA_URL}
//                 {' '}
      
//                 (via /api/search proxy)
//               </p> */}

//               {error && <p className="text-danger">{error}</p>}

//               {resultCount !== null && !error && (
//                 <p className="search-result-count text-muted">
//                   {resultCount} document{resultCount === 1 ? '' : 's'} found
//                 </p>
//               )}

//               <FileList files={files} />
//             </section>
//           )}
//         </main>
//       </div>
//     </div>
//   )
// }
import { useState } from 'react'

import Sidebar from '../components/Sidebar'
import Navbar from '../components/Navbar'
import FileUpload from '../components/FileUpload'
import FileSearch from '../components/FileSearch'
import FileList from '../components/FileList'
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

  function handleToggleSidebar() {
    setSidebarOpen((prev) => !prev)
  }

  return (
    <div className={`app-layout ${sidebarOpen ? '' : 'sidebar-hidden'}`}>
      <Sidebar collapsed={!sidebarOpen} onToggle={handleToggleSidebar} />

      <div className="main-wrapper">
        <Navbar activeTab={activeTab} onTabChange={setActiveTab} />

        <main className="main-content">
          <header className="page-header fade-in">
            <h1>Asset library</h1>
            <p className="text-muted">
              Manage and search your enterprise content
            </p>
          </header>

          {activeTab === 'upload' && (
            <section className="tab-panel fade-in">
              <FileUpload />
            </section>
          )}

          {activeTab === 'search' && (
            <section className="tab-panel fade-in">
              <FileSearch
                query={query}
                filter={filter}
                onQueryChange={setQuery}
                onFilterChange={setFilter}
                onSearch={handleSearch}
                loading={loading}
              />

              {/* <p className="text-muted search-api-hint">
                Search API: {SEARCH_LAMBDA_URL}
                {' '}
      
                (via /api/search proxy)
              </p> */}

              {error && <p className="text-danger">{error}</p>}

              {resultCount !== null && !error && (
                <p className="search-result-count text-muted">
                  {resultCount} document{resultCount === 1 ? '' : 's'} found
                </p>
              )}

              <FileList files={files} />
            </section>
          )}
        </main>
      </div>
    </div>
  )
}