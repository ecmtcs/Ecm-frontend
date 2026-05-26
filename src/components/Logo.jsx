import { memo } from 'react'
import { Link } from 'react-router-dom'
import tcsLogo from '../assets/tcs-logo.png'

function Logo({ className = '', to = '/' }) {
  const classes = ['app-logo', className].filter(Boolean).join(' ')
  const img = (
    <img
      src={tcsLogo}
      alt="TCS — Enterprise Content Management"
      width={52}
      height={32}
      loading="eager"
      decoding="async"
      className="app-logo__img"
    />
  )

  if (to != null && to !== '') {
    return (
      <Link to={to} className={classes} aria-label="TCS ECM home">
        {img}
      </Link>
    )
  }

  return <div className={classes}>{img}</div>
}

export default memo(Logo)