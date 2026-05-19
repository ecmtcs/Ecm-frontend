export default function Navbar({ activeTab, onTabChange }) {
  return (
    <nav className="top-navbar">
      <div className="navbar-tabs">
        <button
          type="button"
          className={activeTab === 'upload' ? 'tab active' : 'tab'}
          onClick={() => onTabChange('upload')}
        >
          Upload
        </button>
        <button
          type="button"
          className={activeTab === 'search' ? 'tab active' : 'tab'}
          onClick={() => onTabChange('search')}
        >
          Search
        </button>
      </div>
    </nav>
  )
}
