// import { useState, useMemo } from 'react'
// import Sidebar from '../components/Sidebar'
// import Navbar from '../components/Navbar'
// import FileUpload from '../components/FileUpload'
// import FileSearch from '../components/FileSearch'
// import FileList from '../components/FileList'
// import { getFiles, searchFiles } from '../utils/files'

// export default function Home() {
//   const [files, setFiles] = useState(getFiles)
//   const [query, setQuery] = useState('')
//   const [filter, setFilter] = useState('all')
//   const [sidebarOpen, setSidebarOpen] = useState(true)
//   const [activeTab, setActiveTab] = useState('upload')

//   const filteredFiles = useMemo(
//     () => searchFiles(files, { query, filter }),
//     [files, query, filter]
//   )

//   function handleUploaded() {
//     setFiles(getFiles())
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
//             <p className="text-muted">Manage and search your enterprise content</p>
//           </header>

//           {activeTab === 'upload' && (
//             <section className="tab-panel fade-in">
//               <FileUpload onUploaded={handleUploaded} />
//             </section>
//           )}

//           {activeTab === 'search' && (
//             <section className="tab-panel fade-in">
//               <FileSearch
//                 query={query}
//                 filter={filter}
//                 onQueryChange={setQuery}
//                 onFilterChange={setFilter}
//               />
//               <FileList files={filteredFiles} />
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

const SEARCH_LAMBDA_URL =
  'YOUR_SEARCH_LAMBDA_FUNCTION_URL'

export default function Home() {

  const [query, setQuery] = useState('')

  const [filter, setFilter] = useState('all')

  const [sidebarOpen, setSidebarOpen] = useState(true)

  const [activeTab, setActiveTab] = useState('upload')

  const [files, setFiles] = useState([])

  const [loading, setLoading] = useState(false)

  const [error, setError] = useState('')

  async function handleSearch() {

    setLoading(true)

    setError('')

    try {

      const response = await fetch(
        SEARCH_LAMBDA_URL,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query,
            filter
          })
        }
      )

      if (!response.ok) {
        throw new Error('Search failed')
      }

      const data = await response.json()

      setFiles(data.results || [])

    } catch (err) {

      setError(
        err.message ||
        'Search failed'
      )

    } finally {

      setLoading(false)

    }
  }

  function handleToggleSidebar() {

    setSidebarOpen(
      (prev) => !prev
    )

  }

  return (

    <div
      className={`app-layout ${
        sidebarOpen
          ? ''
          : 'sidebar-hidden'
      }`}
    >

      <Sidebar
        collapsed={!sidebarOpen}
        onToggle={handleToggleSidebar}
      />

      <div className="main-wrapper">

        <Navbar
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

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

              {error && (
                <p className="text-danger">
                  {error}
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