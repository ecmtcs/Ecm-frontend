import { Navigate } from 'react-router-dom'
import { getSession } from '../utils/auth'

export default function ProtectedRoute({ children }) {
  const session = getSession()
  if (!session) {
    return <Navigate to="/login" replace />
  }
  return children
}
