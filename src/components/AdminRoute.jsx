import { Navigate } from 'react-router-dom'
import { getSession, isAdmin } from '../utils/auth'

export default function AdminRoute({ children }) {
  const session = getSession()

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (!isAdmin(session)) {
    return <Navigate to="/home" replace />
  }

  return children
}
