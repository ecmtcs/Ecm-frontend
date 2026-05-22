const USERS_KEY = 'ecm_users'
const SESSION_KEY = 'ecm_session'

export function getUsers() {
  return JSON.parse(localStorage.getItem(USERS_KEY) || '[]')
}

export function saveUser({ name, email, password }) {
  const users = getUsers()
  if (users.some((u) => u.email === email)) {
    return { ok: false, error: 'An account with this email already exists.' }
  }
  users.push({ name, email, password })
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
  return { ok: true }
}

export function login(email, password) {
  const user = getUsers().find((u) => u.email === email && u.password === password)
  if (!user) {
    return { ok: false, error: 'Invalid email or password.' }
  }
  const session = { name: user.name, email: user.email }
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

export function initializeDemoUser() {
  const users = getUsers()
  if (users.length === 0) {
    saveUser({
      name: 'Logged-in User',
      email: 'demo@example.com',
      password: 'demo123'
    })
  }
}
