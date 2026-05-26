// import { useState } from 'react'
// import { Link, useNavigate } from 'react-router-dom'
// import { saveUser, login } from '../utils/auth'

// export default function Signup() {
//   const navigate = useNavigate()
//   const [name, setName] = useState('')
//   const [email, setEmail] = useState('')
//   const [password, setPassword] = useState('')
//   const [error, setError] = useState('')

//   function handleSubmit(e) {
//     e.preventDefault()
//     setError('')

//     const result = saveUser({ name, email, password })
//     if (!result.ok) {
//       setError(result.error)
//       return
//     }

//     login(email, password)
//     navigate('/home')
//   }

//   return (
//     <div className="auth-page">
//       <div className="auth-card slide-up">
//         <div className="auth-header">
//           <span className="brand-icon lg">ECM</span>
//           <h1>Create account</h1>
//           <p className="text-muted">Join your enterprise content workspace</p>
//         </div>

//         <form onSubmit={handleSubmit}>
//           {error && <p className="form-error">{error}</p>}

//           <div className="form-group">
//             <label htmlFor="name">Full name</label>
//             <input
//               id="name"
//               type="text"
//               required
//               value={name}
//               onChange={(e) => setName(e.target.value)}
//               placeholder="Jane Doe"
//             />
//           </div>

//           <div className="form-group">
//             <label htmlFor="email">Email</label>
//             <input
//               id="email"
//               type="email"
//               required
//               value={email}
//               onChange={(e) => setEmail(e.target.value)}
//               placeholder="you@company.com"
//             />
//           </div>

//           <div className="form-group">
//             <label htmlFor="password">Password</label>
//             <input
//               id="password"
//               type="password"
//               required
//               minLength={6}
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//               placeholder="At least 6 characters"
//             />
//           </div>

//           <button type="submit" className="btn btn-primary btn-block">
//             Sign up
//           </button>
//         </form>

//         <p className="auth-footer">
//           Already have an account? <Link to="/login">Sign in</Link>
//         </p>
//       </div>
//     </div>
//   )
// }
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { saveUser, login } from '../utils/auth'

export default function Signup() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const result = saveUser({ name, email, password })
    if (!result.ok) {
      setError(result.error)
      return
    }

    login(email, password)
    navigate('/home')
  }

  return (
    <div className="auth-page">
      <div className="auth-card slide-up">
        <Logo to={null} className="auth-card-logo" />
        <div className="auth-header">
          <span className="brand-icon lg">ECM</span>
          <h1>Create account</h1>
          <p className="text-muted">Join your enterprise content workspace</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <p className="form-error">{error}</p>}

          <div className="form-group">
            <label htmlFor="name">Full name</label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block">
            Sign up
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}