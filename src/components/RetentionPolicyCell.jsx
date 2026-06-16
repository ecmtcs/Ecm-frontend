import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { RETENTION_POLICIES } from '../constants/retentionPolicies'
import './RetentionPolicyCell.css'

const VIEWPORT_PADDING = 12
const COMPACT_BREAKPOINT = 640

function IconPlus() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IconClock() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 5.5V8l2 1.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IconEdit() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M10.5 3.5l2 2L6 12H4v-2l6.5-6.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 12.5l2.5 2.5L16 9.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function useIsCompact() {
  const [isCompact, setIsCompact] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.innerWidth < COMPACT_BREAKPOINT
  )

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${COMPACT_BREAKPOINT - 1}px)`)
    const onChange = (event) => setIsCompact(event.matches)
    setIsCompact(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return isCompact
}

function RetentionPolicySuccessDialog({ policyLabel, onClose }) {
  useEffect(() => {
    const onKeyDown = (event) => event.key === 'Escape' && onClose()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  return createPortal(
    <div
      className="retention-policy-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="retention-policy-success-title"
      onClick={onClose}
    >
      <div
        className="retention-policy-dialog retention-policy-confirm fade-in"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="retention-policy-confirm-icon" aria-hidden="true">
          <IconCheck />
        </div>
        <h3 id="retention-policy-success-title">Policy applied</h3>
        <p>
          Retention policy set to <strong>{policyLabel}</strong> for this document.
        </p>
        <button type="button" className="btn btn-primary" onClick={onClose}>
          OK
        </button>
      </div>
    </div>,
    document.body
  )
}

function RetentionPolicyPicker({
  menuId,
  triggerRef,
  menuRef,
  isCompact,
  onSelect,
  onClose,
}) {
  const [coords, setCoords] = useState(null)

  const updatePosition = useCallback(() => {
    if (isCompact) {
      setCoords({})
      return
    }

    const trigger = triggerRef.current
    const menu = menuRef.current
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    const menuWidth = menu?.offsetWidth || 220
    const menuHeight = menu?.offsetHeight || 140
    const gap = 8

    let top = rect.bottom + gap
    let left = rect.left

    if (top + menuHeight > window.innerHeight - VIEWPORT_PADDING) {
      top = Math.max(VIEWPORT_PADDING, rect.top - menuHeight - gap)
    }

    if (left + menuWidth > window.innerWidth - VIEWPORT_PADDING) {
      left = window.innerWidth - menuWidth - VIEWPORT_PADDING
    }

    left = Math.max(VIEWPORT_PADDING, left)
    top = Math.max(VIEWPORT_PADDING, top)

    setCoords({ top, left })
  }, [isCompact, menuRef, triggerRef])

  useLayoutEffect(() => {
    updatePosition()
    const frame = requestAnimationFrame(updatePosition)
    return () => cancelAnimationFrame(frame)
  }, [updatePosition])

  useEffect(() => {
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [updatePosition])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    if (isCompact) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isCompact])

  const popoverStyle =
    !isCompact && coords
      ? { top: `${coords.top}px`, left: `${coords.left}px` }
      : undefined

  return createPortal(
    <>
      {isCompact && (
        <button
          type="button"
          className="retention-policy-backdrop retention-policy-backdrop--visible"
          aria-label="Close policy menu"
          onClick={onClose}
          tabIndex={-1}
        />
      )}
      <div
        id={menuId}
        ref={menuRef}
        className={`retention-policy-menu ${
          isCompact ? 'retention-policy-menu--sheet' : 'retention-policy-menu--popover'
        }`}
        style={popoverStyle}
        role="menu"
        aria-label="Select retention policy"
      >
        <div className="retention-policy-menu-header">
          <span className="retention-policy-menu-header-icon" aria-hidden="true">
            <IconClock />
          </span>
          <div>
            <p className="retention-policy-menu-title">Retention policy</p>
            <p className="retention-policy-menu-subtitle">Choose how long to retain</p>
          </div>
        </div>
        <div className="retention-policy-options">
          {RETENTION_POLICIES.map((policy) => (
            <button
              key={policy.id}
              type="button"
              className="retention-policy-option"
              role="menuitem"
              onClick={() => onSelect(policy)}
            >
              <span className="retention-policy-option-years">{policy.years}</span>
              <span className="retention-policy-option-meta">
                <span className="retention-policy-option-label">{policy.label}</span>
                <span className="retention-policy-option-hint">Standard retention</span>
              </span>
            </button>
          ))}
        </div>
        {isCompact && (
          <button type="button" className="retention-policy-cancel" onClick={onClose}>
            Cancel
          </button>
        )}
      </div>
    </>,
    document.body
  )
}

export default function RetentionPolicyCell({ policyId, onAssign }) {
  const menuId = useId()
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [successLabel, setSuccessLabel] = useState('')
  const isCompact = useIsCompact()

  const assignedPolicy = RETENTION_POLICIES.find((policy) => policy.id === policyId)

  const closeMenu = useCallback(() => setMenuOpen(false), [])

  useEffect(() => {
    if (!menuOpen) return undefined

    function handlePointerDown(event) {
      const target = event.target
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return
      }
      closeMenu()
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') closeMenu()
    }

    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen, closeMenu])

  function handleSelect(policy) {
    onAssign(policy.id)
    setMenuOpen(false)
    setSuccessLabel(policy.label)
  }

  return (
    <>
      <div className="retention-policy-cell">
        {assignedPolicy ? (
          <div
            className={`retention-policy-chip ${menuOpen ? 'retention-policy-chip--open' : ''}`}
          >
            <span className="retention-policy-chip-icon" aria-hidden="true">
              <IconClock />
            </span>
            <span className="retention-policy-chip-label">{assignedPolicy.label}</span>
            <button
              ref={triggerRef}
              type="button"
              className="retention-policy-chip-edit"
              onClick={() => setMenuOpen(true)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-controls={menuId}
              aria-label={`Change retention policy (currently ${assignedPolicy.label})`}
            >
              <IconEdit />
            </button>
          </div>
        ) : (
          <button
            ref={triggerRef}
            type="button"
            className={`retention-policy-trigger ${menuOpen ? 'retention-policy-trigger--open' : ''}`}
            onClick={() => setMenuOpen(true)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-controls={menuId}
          >
            <span className="retention-policy-trigger-icon" aria-hidden="true">
              <IconPlus />
            </span>
            <span>Add policy</span>
          </button>
        )}
      </div>

      {menuOpen && (
        <RetentionPolicyPicker
          menuId={menuId}
          triggerRef={triggerRef}
          menuRef={menuRef}
          isCompact={isCompact}
          onSelect={handleSelect}
          onClose={closeMenu}
        />
      )}

      {successLabel && (
        <RetentionPolicySuccessDialog
          policyLabel={successLabel}
          onClose={() => setSuccessLabel('')}
        />
      )}
    </>
  )
}
