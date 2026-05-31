import { useMemo } from 'react'

const CHART_COLORS = {
  Completed: '#22c55e',
  Processing: '#3b82f6',
  Failed: '#ef4444',
  Other: '#8b9cb3',
}

function polarToCartesian(cx, cy, radius, angleDeg) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  }
}

function buildSlicePath(cx, cy, radius, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, radius, endAngle)
  const end = polarToCartesian(cx, cy, radius, startAngle)
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1

  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y}`,
    'Z',
  ].join(' ')
}

/**
 * Lightweight SVG pie chart — no external chart library required.
 */
export default function StatusPieChart({ data, total }) {
  const segments = useMemo(() => {
    if (!data?.length || total <= 0) return []

    let cursor = 0
    return data.map((entry) => {
      const fraction = entry.value / total
      const startAngle = cursor * 360
      const endAngle = (cursor + fraction) * 360
      cursor += fraction

      return {
        ...entry,
        startAngle,
        endAngle,
        color: CHART_COLORS[entry.label] || CHART_COLORS.Other,
        percent: ((entry.value / total) * 100).toFixed(1),
      }
    })
  }, [data, total])

  if (!segments.length) {
    return (
      <div className="status-chart status-chart--empty" role="img" aria-label="No status data">
        <p className="text-muted">No status data available.</p>
      </div>
    )
  }

  return (
    <div className="status-chart">
      <svg viewBox="0 0 220 220" className="status-chart__svg" role="img" aria-label="Status distribution pie chart">
        {segments.map((segment) => (
          <path
            key={segment.label}
            d={buildSlicePath(110, 110, 90, segment.startAngle, segment.endAngle)}
            fill={segment.color}
          />
        ))}
      </svg>

      <ul className="status-chart__legend" aria-label="Status legend">
        {segments.map((segment) => (
          <li key={segment.label}>
            <span className="status-chart__swatch" style={{ backgroundColor: segment.color }} aria-hidden="true" />
            <span>{segment.label}</span>
            <span className="status-chart__value">
              {segment.value} ({segment.percent}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
