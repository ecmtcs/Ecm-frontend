import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Home from './pages/Home'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import { getSession, initializeDemoUser } from './utils/auth'

const AdminStatusReport = lazy(() => import('./pages/AdminStatusReport'))

function PublicOnly({ children }) {
  if (getSession()) {
    return <Navigate to="/home" replace />
  }
  return children
}

export default function App() {
  useEffect(() => {
    initializeDemoUser()
  }, [])

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route
        path="/login"
        element={
          <PublicOnly>
            <Login />
          </PublicOnly>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicOnly>
            <Signup />
          </PublicOnly>
        }
      />
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/status-report"
        element={
          <AdminRoute>
            <Suspense
              fallback={
                <div className="admin-status-loading admin-status-loading--page">
                  <span className="doc-preview-spinner" aria-hidden="true" />
                  <span>Loading dashboard…</span>
                </div>
              }
            >
              <AdminStatusReport />
            </Suspense>
          </AdminRoute>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}