import { useMemo, useState } from 'react'

const CHART_COLORS = {
  INDEXED: '#10b981',
  PROCESSING: '#3b82f6',
  UPLOADED: '#f59e0b',
  FAILED: '#ef4444',
  OTHER: '#8b9cb3',
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

function FullCircle({ color }) {
  return (
    <circle
      cx="110"
      cy="110"
      r="90"
      fill={color}
      className="status-chart__slice"
    />
  )
}

/**
 * Lightweight SVG pie chart
 * Handles:
 * - Normal multi-slice charts
 * - 100% single-slice charts
 * - Empty datasets
 */
export default function StatusPieChart({ data, total }) {
  const [activeSegment, setActiveSegment] = useState(null)

  const { chartSegments, legendSegments, fullCircleSegment } = useMemo(() => {
    if (!Array.isArray(data) || total <= 0) {
      return {
        chartSegments: [],
        legendSegments: [],
        fullCircleSegment: null,
      }
    }

    const legendData = data.map((entry) => ({
      ...entry,
      color:
        CHART_COLORS[String(entry.label).toUpperCase()] ||
        CHART_COLORS.OTHER,
      percent: total
        ? ((entry.value / total) * 100).toFixed(1)
        : '0.0',
    }))

    const nonZeroSegments = legendData.filter(
      (entry) => Number(entry.value) > 0
    )

    if (nonZeroSegments.length === 1) {
      return {
        chartSegments: [],
        legendSegments: legendData,
        fullCircleSegment: {
          ...nonZeroSegments[0],
          percent: '100.0',
        },
      }
    }

    let cursor = 0

    const calculatedSegments = nonZeroSegments.map((entry) => {
      const fraction = entry.value / total

      const startAngle = cursor * 360
      const endAngle = (cursor + fraction) * 360

      cursor += fraction

      return {
        ...entry,
        startAngle,
        endAngle,
      }
    })

    return {
      chartSegments: calculatedSegments,
      legendSegments: legendData,
      fullCircleSegment: null,
    }
  }, [data, total])

  const tooltipSegment = activeSegment || fullCircleSegment

  if (!legendSegments.length) {
    return (
      <div
        className="status-chart status-chart--empty"
        role="img"
        aria-label="No status data"
      >
        <p className="text-muted">
          No status data available.
        </p>
      </div>
    )
  }

  return (
    <div className="status-chart">
      <div className="status-chart__figure">
        <svg
          viewBox="0 0 220 220"
          className="status-chart__svg"
          role="img"
          aria-label="Status distribution pie chart"
        >
          {fullCircleSegment ? (
            <FullCircle color={fullCircleSegment.color} />
          ) : (
            chartSegments.map((segment) => (
              <path
                key={segment.label}
                d={buildSlicePath(
                  110,
                  110,
                  90,
                  segment.startAngle,
                  segment.endAngle
                )}
                fill={segment.color}
                tabIndex="0"
                className="status-chart__slice"
                onBlur={() => setActiveSegment(null)}
                onFocus={() => setActiveSegment(segment)}
                onMouseEnter={() =>
                  setActiveSegment(segment)
                }
                onMouseLeave={() =>
                  setActiveSegment(null)
                }
              />
            ))
          )}
        </svg>

        {tooltipSegment && (
          <div
            className="status-chart__tooltip"
            role="status"
          >
            <strong>{tooltipSegment.label}</strong>
            <span>
              {tooltipSegment.value} (
              {tooltipSegment.percent}%)
            </span>
          </div>
        )}
      </div>

      <ul
        className="status-chart__legend"
        aria-label="Status legend"
      >
        {legendSegments.map((segment) => (
          <li key={segment.label}>
            <span
              className="status-chart__swatch"
              style={{
                backgroundColor: segment.color,
              }}
              aria-hidden="true"
            />
            <span>{segment.label}</span>

            <span className="status-chart__value">
              {segment.value} (
              {segment.percent}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}