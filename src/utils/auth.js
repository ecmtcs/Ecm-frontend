const USERS_KEY = 'ecm_users'
const SESSION_KEY = 'ecm_session'

/** Static admin account — not stored in ecm_users to avoid accidental overwrite. */
export const ADMIN_USER = {
  username: 'admin',
  name: 'Admin',
  email: 'admin@example.com',
  password: 'admin123',
  role: 'admin',
}

export function getUsers() {
  return JSON.parse(localStorage.getItem(USERS_KEY) || '[]')
}

export function saveUser({ name, email, password }) {
  const users = getUsers()
  if (users.some((u) => u.email === email)) {
    return { ok: false, error: 'An account with this email already exists.' }
  }
  users.push({ name, email, password, role: 'user' })
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
  return { ok: true }
}

function matchesAdminCredentials(emailOrUsername, password) {
  const normalized = String(emailOrUsername || '').trim().toLowerCase()
  return (
    (normalized === ADMIN_USER.username.toLowerCase() ||
      normalized === ADMIN_USER.email.toLowerCase()) &&
    password === ADMIN_USER.password
  )
}

function buildSession(user) {
  return {
    name: user.name,
    email: user.email,
    username: user.username || user.email,
    role: user.role || 'user',
  }
}

export function login(emailOrUsername, password) {
  if (matchesAdminCredentials(emailOrUsername, password)) {
    const session = buildSession(ADMIN_USER)
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    return { ok: true, user: session }
  }

  const user = getUsers().find(
    (u) => u.email === emailOrUsername && u.password === password
  )

  if (!user) {
    return { ok: false, error: 'Invalid email or password.' }
  }

  const session = buildSession(user)
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return { ok: true, user: session }
}

export function logout() {
  localStorage.removeItem(SESSION_KEY)
}

export function getSession() {
  const data = localStorage.getItem(SESSION_KEY)
  return data ? JSON.parse(data) : null
}

export function isAdmin(session = getSession()) {
  return session?.role === 'admin'
}

export function initializeDemoUser() {
  const users = getUsers()
  if (users.length === 0) {
    saveUser({
      name: 'Logged-in User',
      email: 'demo@example.com',
      password: 'demo123',
    })
  }
}
