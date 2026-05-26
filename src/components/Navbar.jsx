// export default function Navbar({ activeTab, onTabChange }) {
//   return (
//     <nav className="top-navbar">
//       <div className="navbar-tabs">
//         <button
//           type="button"
//           className={activeTab === 'upload' ? 'tab active' : 'tab'}
//           onClick={() => onTabChange('upload')}
//         >
//           Upload
//         </button>
//         <button
//           type="button"
//           className={activeTab === 'search' ? 'tab active' : 'tab'}
//           onClick={() => onTabChange('search')}
//         >
//           Search
//         </button>
//          <button
//           type="button"
//           className={activeTab === 'ai-search' ? 'tab active' : 'tab'}
//           onClick={() => onTabChange('ai-search')}
//         >
//           AI Search
//         </button>
//       </div>
//     </nav>
//   )
// }
import Logo from './Logo'

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
         <button
          type="button"
          className={activeTab === 'ai-search' ? 'tab active' : 'tab'}
          onClick={() => onTabChange('ai-search')}
        >
          AI Search
        </button>
      </div>
      <Logo to="/home" className="app-logo--nav" />
    </nav>
  )
}