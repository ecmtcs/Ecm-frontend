import { useMemo } from 'react'

function toIsoDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function shiftDays(base, days) {
  const next = new Date(base)
  next.setDate(next.getDate() + days)
  return next
}

/**
 * Build preset ranges relative to "today" (history-only, never future).
 */
function buildPresets(todayIso) {
  const today = new Date(`${todayIso}T00:00:00`)
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

  return [
    { id: 'all', label: 'All time', from: '', to: '' },
    { id: '7d', label: 'Last 7 days', from: toIsoDate(shiftDays(today, -6)), to: todayIso },
    { id: '30d', label: 'Last 30 days', from: toIsoDate(shiftDays(today, -29)), to: todayIso },
    { id: 'month', label: 'This month', from: toIsoDate(startOfMonth), to: todayIso },
  ]
}

/**
 * Fluent, accessible date-range control: quick presets + custom From/To inputs.
 */
export default function DateRangeFilter({ fromDate, toDate, maxDate, onChange, onClear }) {
  const presets = useMemo(() => buildPresets(maxDate), [maxDate])

  const activePresetId = useMemo(() => {
    const match = presets.find((preset) => preset.from === fromDate && preset.to === toDate)
    return match ? match.id : 'custom'
  }, [presets, fromDate, toDate])

  const isActive = Boolean(fromDate || toDate)

  return (
    <div className="date-range" role="group" aria-label="Filter by date range">
      <div className="date-range__head">
        <span className="date-range__title">Date range</span>
        {isActive && (
          <button type="button" className="date-range__clear" onClick={onClear}>
            Clear
          </button>
        )}
      </div>

      <div className="date-range__presets" role="tablist" aria-label="Quick ranges">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            role="tab"
            aria-selected={activePresetId === preset.id}
            className={`date-range__chip ${activePresetId === preset.id ? 'is-active' : ''}`}
            onClick={() => onChange({ from: preset.from, to: preset.to })}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="date-range__inputs">
        <label className="date-range__field">
          <span>From</span>
          <input
            type="date"
            value={fromDate}
            max={toDate || maxDate}
            onChange={(event) => onChange({ from: event.target.value, to: toDate })}
          />
        </label>
        <span className="date-range__arrow" aria-hidden="true">
          &rarr;
        </span>
        <label className="date-range__field">
          <span>To</span>
          <input
            type="date"
            value={toDate}
            min={fromDate || undefined}
            max={maxDate}
            onChange={(event) => onChange({ from: fromDate, to: event.target.value })}
          />
        </label>
      </div>
    </div>
  )
}
