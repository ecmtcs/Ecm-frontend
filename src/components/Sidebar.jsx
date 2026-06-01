import { Link, useNavigate } from 'react-router-dom'
import { logout, getSession, isAdmin } from '../utils/auth'

export default function Sidebar({ collapsed, onToggle }) {
  const navigate = useNavigate()
  const session = getSession()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  if (collapsed) {
    return (
      <button type="button" className="sidebar-show-btn" onClick={onToggle}>
        Show
      </button>
    )
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-icon">TCS ECM</span>
        <span className="brand-text">Gu Gu AI</span>
      </div>

      <nav className="sidebar-nav">
        <span className="nav-item active">Dashboard</span>
        {isAdmin(session) && (
          <Link to="/admin/status-report" className="nav-item">
            Status Report
          </Link>
        )}
      </nav>

      <div className="sidebar-footer">
        <p className="user-name">{session?.name}</p>
        <p className="user-email">{session?.email}</p>
        <button type="button" className="btn btn-outline btn-sm" onClick={handleLogout}>
          Sign out
        </button>
      </div>

      <button type="button" className="sidebar-hide-btn" onClick={onToggle}>
        Hide
      </button>
    </aside>
  )
}
