import { useState, useMemo } from 'react'
import Sidebar from '../components/Sidebar'
import Navbar from '../components/Navbar'
import FileUpload from '../components/FileUpload'
import FileSearch from '../components/FileSearch'
import FileList from '../components/FileList'
import { getFiles, searchFiles } from '../utils/files'

export default function Home() {
  const [files, setFiles] = useState(getFiles)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeTab, setActiveTab] = useState('upload')

  const filteredFiles = useMemo(
    () => searchFiles(files, { query, filter }),
    [files, query, filter]
  )

  function handleUploaded() {
    setFiles(getFiles())
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
            <p className="text-muted">Manage and search your enterprise content</p>
          </header>

          {activeTab === 'upload' && (
            <section className="tab-panel fade-in">
              <FileUpload onUploaded={handleUploaded} />
            </section>
          )}

          {activeTab === 'search' && (
            <section className="tab-panel fade-in">
              <FileSearch
                query={query}
                filter={filter}
                onQueryChange={setQuery}
                onFilterChange={setFilter}
              />
              <FileList files={filteredFiles} />
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
