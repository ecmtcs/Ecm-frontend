// import { useCallback, useEffect, useMemo, useState } from 'react'
// import { Link } from 'react-router-dom'
// import Sidebar from '../components/Sidebar'
// import StatusPieChart from '../components/StatusPieChart'
// import DateRangeFilter from '../components/DateRangeFilter'
// import { isAdmin } from '../utils/auth'
// import {
//   buildStatusChartData,
//   fetchAllDocumentStatusRecords,
// } from '../utils/statusReportApi'
// import './AdminStatusReport.css'

// const PAGE_SIZE = 100
// const DEFAULT_SORT = { key: 'timestamp', direction: 'desc' }
// const TODAY_ISO = new Date().toISOString().slice(0, 10)
// const SORTABLE_COLUMNS = [
//   { key: 'filename', label: 'Filename' },
//   { key: 'date', label: 'Date' },
//   { key: 'timestamp', label: 'Timestamp' },
//   { key: 'status', label: 'Status' },
// ]

// function normalizeSelectedDate(value) {
//   if (!value) return ''
//   return value > TODAY_ISO ? TODAY_ISO : value
// }

// function StatusBadge({ status }) {
//   const normalized = String(status || '').toUpperCase()
//   const className =
//     normalized === 'INDEXED' || normalized === 'COMPLETED'
//       ? 'status-badge status-badge--completed'
//       : normalized === 'FAILED'
//         ? 'status-badge status-badge--failed'
//         : 'status-badge status-badge--processing'

//   const label =
//     normalized === 'INDEXED'
//       ? 'Completed'
//       : normalized === 'UPLOADED' || normalized === 'PROCESSING'
//         ? 'Processing'
//         : status

//   return <span className={className}>{label}</span>
// }

// function extractRecordDate(row) {
//   const rawDate = String(row?.date || '').trim()
//   if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
//     return rawDate
//   }

//   const rawTimestamp = String(row?.timestamp || '').trim()
//   const timestampDateMatch = rawTimestamp.match(/^(\d{4}-\d{2}-\d{2})/)
//   if (timestampDateMatch) {
//     return timestampDateMatch[1]
//   }

//   return ''
// }

// function toSortableDateNumber(value) {
//   const rawValue = String(value || '').trim()
//   if (!rawValue || rawValue === '—') return null

//   const dateOnlyMatch = rawValue.match(/^(\d{4}-\d{2}-\d{2})$/)
//   if (dateOnlyMatch) {
//     const dateOnlyValue = Date.parse(`${dateOnlyMatch[1]}T00:00:00Z`)
//     return Number.isNaN(dateOnlyValue) ? null : dateOnlyValue
//   }

//   const normalizedFraction = rawValue.replace(/(\.\d{3})\d+/, '$1')
//   const withTimezone = /[zZ]|[+-]\d{2}:\d{2}$/.test(normalizedFraction)
//     ? normalizedFraction
//     : `${normalizedFraction}Z`
//   const parsed = Date.parse(withTimezone)

//   if (!Number.isNaN(parsed)) {
//     return parsed
//   }

//   const partialDateMatch = rawValue.match(/^(\d{4}-\d{2}-\d{2})/)
//   if (partialDateMatch) {
//     const fallback = Date.parse(`${partialDateMatch[1]}T00:00:00Z`)
//     return Number.isNaN(fallback) ? null : fallback
//   }

//   return null
// }

// function compareRows(a, b, { key, direction }) {
//   const modifier = direction === 'asc' ? 1 : -1

//   if (key === 'date') {
//     const left = toSortableDateNumber(a.date)
//     const right = toSortableDateNumber(b.date)
//     if (left !== null && right !== null && left !== right) {
//       return (left - right) * modifier
//     }
//     if (left === null && right !== null) return 1
//     if (left !== null && right === null) return -1
//   }

//   if (key === 'timestamp') {
//     const left = toSortableDateNumber(a.timestamp)
//     const right = toSortableDateNumber(b.timestamp)
//     if (left !== null && right !== null && left !== right) {
//       return (left - right) * modifier
//     }
//     if (left === null && right !== null) return 1
//     if (left !== null && right === null) return -1
//   }

//   const leftText = String(a[key] ?? '').toLowerCase()
//   const rightText = String(b[key] ?? '').toLowerCase()
//   const textCompare = leftText.localeCompare(rightText, undefined, {
//     numeric: true,
//     sensitivity: 'base',
//   })

//   if (textCompare !== 0) {
//     return textCompare * modifier
//   }

//   return String(a.documentId ?? '').localeCompare(String(b.documentId ?? ''))
// }

// export default function AdminStatusReport() {
//   const [sidebarOpen, setSidebarOpen] = useState(true)
//   const [items, setItems] = useState([])
//   const [summary, setSummary] = useState(null)
//   const [loading, setLoading] = useState(true)
//   const [error, setError] = useState('')
//   const [fromDate, setFromDate] = useState('')
//   const [toDate, setToDate] = useState('')
//   const [creatorFilter, setCreatorFilter] = useState('all')
//   const [searchInput, setSearchInput] = useState('')
//   const [searchQuery, setSearchQuery] = useState('')
//   const [sortConfig, setSortConfig] = useState(() => ({ ...DEFAULT_SORT }))

//   const loadReport = useCallback(async () => {
//     if (!isAdmin()) {
//       setError('Unauthorized access.')
//       setLoading(false)
//       return
//     }

//     setLoading(true)
//     setError('')

//     try {
//       console.info('[StatusReport] Fetching all records')
//       const data = await fetchAllDocumentStatusRecords({ pageSize: PAGE_SIZE })
//       setSummary(data.summary)
//       setItems(data.items)
//     } catch (err) {
//       console.error('[StatusReport] Load failed', err)
//       setItems([])
//       setSummary(null)
//       setError(err.message || 'Failed to load status report.')
//     } finally {
//       setLoading(false)
//     }
//   }, [])

//   useEffect(() => {
//     loadReport()
//   }, [loadReport])

//   const isDateRangeActive = Boolean(fromDate || toDate)

//   const selectedDateRange = useMemo(() => {
//     if (fromDate && toDate && fromDate > toDate) {
//       return { start: toDate, end: fromDate }
//     }

//     return { start: fromDate, end: toDate }
//   }, [fromDate, toDate])

//   const dateRangeFilteredItems = useMemo(
//     () =>
//       items.filter((row) => {
//         const recordDate = extractRecordDate(row)
//         if (selectedDateRange.start && (!recordDate || recordDate < selectedDateRange.start)) return false
//         if (selectedDateRange.end && (!recordDate || recordDate > selectedDateRange.end)) return false
//         return true
//       }),
//     [items, selectedDateRange]
//   )

//   const chartStatusDistribution = useMemo(() => {
//     const distribution = {}
//     dateRangeFilteredItems.forEach((row) => {
//       const statusKey = String(row.status || 'UNKNOWN').toUpperCase()
//       distribution[statusKey] = (distribution[statusKey] || 0) + 1
//     })
//     return distribution
//   }, [dateRangeFilteredItems])

//   const chartData = useMemo(
//     () => buildStatusChartData(chartStatusDistribution),
//     [chartStatusDistribution]
//   )

//   const chartTotal = useMemo(
//     () => chartData.reduce((sum, entry) => sum + entry.value, 0),
//     [chartData]
//   )

//   const creatorOptions = useMemo(() => {
//     const creators = new Set()
//     items.forEach((row) => {
//       const creator = String(row.creator || '').trim()
//       if (creator) creators.add(creator)
//     })
//     return Array.from(creators).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
//   }, [items])

//   const statusTableFilteredItems = useMemo(() => {
//     const query = searchQuery.trim().toLowerCase()

//     return dateRangeFilteredItems.filter((row) => {
//       if (creatorFilter !== 'all' && row.creator !== creatorFilter) {
//         return false
//       }

//       if (!query) return true

//       const searchable = [
//         row.documentId,
//         row.filename,
//         row.creator,
//         row.date,
//         row.timestamp,
//         row.status,
//       ]

//       return searchable.some((value) => String(value ?? '').toLowerCase().includes(query))
//     })
//   }, [dateRangeFilteredItems, creatorFilter, searchQuery])

//   const sortedRows = useMemo(
//     () => [...statusTableFilteredItems].sort((left, right) => compareRows(left, right, sortConfig)),
//     [statusTableFilteredItems, sortConfig]
//   )

//   const dateRangeSummary = useMemo(() => {
//     if (selectedDateRange.start && selectedDateRange.end) {
//       return `${selectedDateRange.start} to ${selectedDateRange.end}`
//     }
//     if (selectedDateRange.start) {
//       return `from ${selectedDateRange.start}`
//     }
//     if (selectedDateRange.end) {
//       return `up to ${selectedDateRange.end}`
//     }
//     return 'all dates'
//   }, [selectedDateRange])

//   function handleDateRangeChange({ from, to }) {
//     setFromDate(normalizeSelectedDate(from))
//     setToDate(normalizeSelectedDate(to))
//   }

//   function handleDateRangeClear() {
//     setFromDate('')
//     setToDate('')
//   }

//   function handleSearchSubmit(event) {
//     event.preventDefault()
//     setSearchQuery(searchInput.trim())
//   }

//   function handleResetFilters() {
//     setFromDate('')
//     setToDate('')
//     setCreatorFilter('all')
//     setSearchInput('')
//     setSearchQuery('')
//     setSortConfig({ ...DEFAULT_SORT })
//   }

//   function handleSortKeyChange(event) {
//     const column = event.target.value
//     setSortConfig((prev) => {
//       const defaultDirection = column === 'date' || column === 'timestamp' ? 'desc' : 'asc'
//       return { key: column, direction: defaultDirection }
//     })
//   }

//   function handleSortDirectionChange(event) {
//     const direction = event.target.value
//     setSortConfig((prev) => ({ ...prev, direction }))
//   }

//   return (
//     <div className={`app-layout ${sidebarOpen ? '' : 'sidebar-hidden'}`}>
//       <Sidebar collapsed={!sidebarOpen} onToggle={() => setSidebarOpen((prev) => !prev)} />

//       <div className="main-wrapper">
//         <main className="main-content admin-status-page">
//           <header className="page-header fade-in">
//             <div>
//               <h1>Admin Status Dashboard</h1>
//               <p className="text-muted">Document processing status from DocumentTracker (DynamoDB)</p>
//             </div>
//             <Link to="/home" className="btn btn-outline btn-sm">
//               Back to home
//             </Link>
//           </header>

//           {error && (
//             <div className="admin-status-error" role="alert">
//               <p>{error}</p>
//               <button type="button" className="btn btn-outline btn-sm" onClick={loadReport}>
//                 Retry
//               </button>
//             </div>
//           )}

//           {!error && (
//             <>
//               <section className="status-overview fade-in" aria-label="Status overview">
//                 <article className="status-stat-card">
//                   <p className="status-stat-card__label">Total Files</p>
//                   <p className="status-stat-card__value">{summary?.totalFiles ?? '—'}</p>
//                 </article>
//                 <article className="status-stat-card">
//                   <p className="status-stat-card__label">Total Processing</p>
//                   <p className="status-stat-card__value">{summary?.totalProcessing ?? '—'}</p>
//                 </article>
//                 <article className="status-stat-card">
//                   <p className="status-stat-card__label">Total Completed</p>
//                   <p className="status-stat-card__value">{summary?.totalCompleted ?? '—'}</p>
//                 </article>
//                 <article className="status-stat-card">
//                   <p className="status-stat-card__label">Total Failed</p>
//                   <p className="status-stat-card__value">{summary?.totalFailed ?? '—'}</p>
//                 </article>
//               </section>

//               <DateRangeFilter
//                 fromDate={fromDate}
//                 toDate={toDate}
//                 maxDate={TODAY_ISO}
//                 onChange={handleDateRangeChange}
//                 onClear={handleDateRangeClear}
//               />

//               <section className="status-chart-panel fade-in" aria-label="Status distribution">
//                 <div className="status-chart-header">
//                   <div>
//                     <h2>Status Overview</h2>
//                     {isDateRangeActive && <p className="text-muted">Filtered by {dateRangeSummary}</p>}
//                   </div>
//                 </div>
//                 {loading && !summary ? (
//                   <p className="text-muted">Loading chart…</p>
//                 ) : (
//                   <div className="status-chart-content">
//                     <StatusPieChart data={chartData} total={chartTotal} />
//                   </div>
//                 )}
//               </section>

//               <section className="status-table-section fade-in" aria-label="Document status table">
//                 <div className="status-table-header">
//                   <h2>Status Report</h2>
//                   {!loading && (
//                     <p className="text-muted">
//                       {sortedRows.length} record{sortedRows.length === 1 ? '' : 's'} shown
//                       {' '}of {dateRangeFilteredItems.length} in {dateRangeSummary}
//                     </p>
//                   )}
//                 </div>

//                 <form className="status-report-toolbar" onSubmit={handleSearchSubmit}>
//                   <label className="status-filter-field status-toolbar-field--search">
//                     <span>Search records</span>
//                     <input
//                       type="search"
//                       value={searchInput}
//                       onChange={(event) => setSearchInput(event.target.value)}
//                       placeholder="Filename, status, timestamp..."
//                     />
//                   </label>
//                   <button type="submit" className="btn btn-outline">
//                     Search
//                   </button>
//                   <label className="status-filter-field status-toolbar-field">
//                     <span>Creator</span>
//                     <select value={creatorFilter} onChange={(event) => setCreatorFilter(event.target.value)}>
//                       <option value="all">All creators</option>
//                       {creatorOptions.map((creator) => (
//                         <option key={creator} value={creator}>
//                           {creator}
//                         </option>
//                       ))}
//                     </select>
//                   </label>
//                   <label className="status-filter-field status-toolbar-field">
//                     <span>Sort by</span>
//                     <select value={sortConfig.key} onChange={handleSortKeyChange}>
//                       {SORTABLE_COLUMNS.map((column) => (
//                         <option key={column.key} value={column.key}>
//                           {column.label}
//                         </option>
//                       ))}
//                     </select>
//                   </label>
//                   <label className="status-filter-field status-toolbar-field">
//                     <span>Order</span>
//                     <select value={sortConfig.direction} onChange={handleSortDirectionChange}>
//                       <option value="asc">Ascending</option>
//                       <option value="desc">Descending</option>
//                     </select>
//                   </label>
//                   <button type="button" className="btn btn-outline" onClick={handleResetFilters}>
//                     Reset
//                   </button>
//                 </form>

//                 {loading && items.length === 0 ? (
//                   <div className="admin-status-loading">
//                     <span className="doc-preview-spinner" aria-hidden="true" />
//                     <span>Loading status records…</span>
//                   </div>
//                 ) : sortedRows.length === 0 ? (
//                   <div className="empty-state fade-in">
//                     <p>No status records found.</p>
//                     <span className="text-muted">Try clearing filters or broadening your date range.</span>
//                   </div>
//                 ) : (
//                   <div className="file-table-wrap file-table-wrap--search">
//                     <table className="file-table file-table--search">
//                       <thead>
//                         <tr>
//                           <th>Filename</th>
//                           <th>Creator</th>
//                           <th>Date</th>
//                           <th>Timestamp</th>
//                           <th>Status</th>
//                         </tr>
//                       </thead>
//                       <tbody>
//                         {sortedRows.map((row) => (
//                           <tr key={`${row.documentId}-${row.timestamp}`} className="table-row">
//                             <td title={row.filename}>{row.filename}</td>
//                             <td>{row.creator}</td>
//                             <td>{row.date}</td>
//                             <td className="cell-mono">{row.timestamp}</td>
//                             <td>
//                               <StatusBadge status={row.status} />
//                             </td>
//                           </tr>
//                         ))}
//                       </tbody>
//                     </table>
//                   </div>
//                 )}
//               </section>
//             </>
//           )}
//         </main>
//       </div>
//     </div>
//   )
// }
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import StatusPieChart from '../components/StatusPieChart'
import DateRangeFilter from '../components/DateRangeFilter'
import { isAdmin } from '../utils/auth'
import { buildStatusChartData, fetchAllDocumentStatusRecords } from '../utils/statusReportApi'
import './AdminStatusReport.css'

const PAGE_SIZE = 100
const DEFAULT_SORT = { key: 'timestamp', direction: 'desc' }
const TODAY_ISO = new Date().toISOString().slice(0, 10)
const SORTABLE_COLUMNS = [
  { key: 'documentId', label: 'Document ID' },
  { key: 'date', label: 'Date' },
  { key: 'timestamp', label: 'Timestamp' },
  { key: 'status', label: 'Status' },
]

function normalizeSelectedDate(value) {
  if (!value) return ''
  return value > TODAY_ISO ? TODAY_ISO : value
}

// Display status exactly as in backend
// function StatusBadge({ status }) {
//   const normalized = String(status || 'UNKNOWN').toUpperCase()
//   const className =
//     normalized === 'INDEXED'
//       ? 'status-badge status-badge--completed'
//       : normalized === 'FAILED'
//         ? 'status-badge status-badge--failed'
//         : normalized === 'UPLOADED'
//           ? 'status-badge status-badge--uploaded'
//           : 'status-badge status-badge--processing'

//   return <span className={className}>{normalized}</span>
// }
function StatusBadge({ status }) {
  const normalized = String(status || 'UNKNOWN').toUpperCase()

  const className =
    normalized === 'INDEXED'
      ? 'status-badge status-badge--completed'
      : normalized === 'FAILED'
        ? 'status-badge status-badge--failed'
        : normalized === 'UPLOADED'
          ? 'status-badge status-badge--uploaded'
          : 'status-badge status-badge--processing'

  return <span className={className}>{normalized}</span>
}

function extractRecordDate(row) {
  const rawDate = String(row?.date || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) return rawDate
  const rawTimestamp = String(row?.timestamp || '').trim()
  const match = rawTimestamp.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : ''
}

function toSortableDateNumber(value) {
  const rawValue = String(value || '').trim()
  if (!rawValue || rawValue === '—') return null
  const dateOnlyMatch = rawValue.match(/^(\d{4}-\d{2}-\d{2})$/)
  if (dateOnlyMatch) return Date.parse(`${dateOnlyMatch[1]}T00:00:00Z`) || null
  const parsed = Date.parse(rawValue.replace(/(\.\d{3})\d+/, '$1') + (/[zZ]|[+-]\d{2}:\d{2}$/.test(rawValue) ? '' : 'Z'))
  return Number.isNaN(parsed) ? null : parsed
}

function compareRows(a, b, { key, direction }) {
  const modifier = direction === 'asc' ? 1 : -1
  if (key === 'date' || key === 'timestamp') {
    const left = toSortableDateNumber(a[key])
    const right = toSortableDateNumber(b[key])
    if (left !== null && right !== null && left !== right) return (left - right) * modifier
    if (left === null && right !== null) return 1
    if (left !== null && right === null) return -1
  }
  return String(a[key] ?? '').localeCompare(String(b[key] ?? ''), undefined, { numeric: true, sensitivity: 'base' }) * modifier
}

export default function AdminStatusReport() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [creatorFilter, setCreatorFilter] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortConfig, setSortConfig] = useState({ ...DEFAULT_SORT })

  const loadReport = useCallback(async () => {
    if (!isAdmin()) {
      setError('Unauthorized access.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await fetchAllDocumentStatusRecords({ pageSize: PAGE_SIZE })
      setItems(data.items)
    } catch (err) {
      console.error('[StatusReport] Load failed', err)
      setItems([])
      setError(err.message || 'Failed to load status report.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadReport() }, [loadReport])

  const selectedDateRange = useMemo(() => {
    if (fromDate && toDate && fromDate > toDate) return { start: toDate, end: fromDate }
    return { start: fromDate, end: toDate }
  }, [fromDate, toDate])

  // Date filter applied first
  const dateRangeFilteredItems = useMemo(() => items.filter(row => {
    const recordDate = extractRecordDate(row)
    if (selectedDateRange.start && (!recordDate || recordDate < selectedDateRange.start)) return false
    if (selectedDateRange.end && (!recordDate || recordDate > selectedDateRange.end)) return false
    return true
  }), [items, selectedDateRange])

  // Deduplicate by DocumentId and pick latest timestamp per document
  const latestFileRecords = useMemo(() => {
    const docMap = new Map()
    dateRangeFilteredItems.forEach(row => {
      const key = row.documentId
      if (!key) return
      const existing = docMap.get(key)
      if (!existing || new Date(row.timestamp).getTime() > new Date(existing.timestamp).getTime()) {
        docMap.set(key, row)
      }
    })
    return Array.from(docMap.values())
  }, [dateRangeFilteredItems])

  // KPI / summary with raw backend states
  const latestSummary = useMemo(() => {
    const result = { totalFiles: latestFileRecords.length, INDEXED: 0, PROCESSING: 0, UPLOADED: 0, FAILED: 0 }
    latestFileRecords.forEach(row => {
      const status = String(row.status || '').toUpperCase()
      if (result.hasOwnProperty(status)) result[status]++
    })
    return result
  }, [latestFileRecords])

  // Pie chart data
  const chartStatusDistribution = useMemo(() => {
    const distribution = {}
    latestFileRecords.forEach(row => {
      const statusKey = String(row.status || 'UNKNOWN').toUpperCase()
      distribution[statusKey] = (distribution[statusKey] || 0) + 1
    })
    return distribution
  }, [latestFileRecords])

  const chartData = useMemo(() => buildStatusChartData(chartStatusDistribution), [chartStatusDistribution])
  const chartTotal = useMemo(() => chartData.reduce((sum, e) => sum + e.value, 0), [chartData])

  // Creator options
  const creatorOptions = useMemo(() => {
    const creators = new Set()
    latestFileRecords.forEach(row => { if (row.creator) creators.add(row.creator) })
    return Array.from(creators).sort()
  }, [latestFileRecords])

  // Search + creator filter
  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return latestFileRecords.filter(row => {
      if (creatorFilter !== 'all' && row.creator !== creatorFilter) return false
      if (!query) return true
      return [row.documentId, row.creator, row.date, row.timestamp, row.status]
        .some(val => String(val ?? '').toLowerCase().includes(query))
    })
  }, [latestFileRecords, creatorFilter, searchQuery])

  const sortedRows = useMemo(() => [...filteredRows].sort((a, b) => compareRows(a, b, sortConfig)), [filteredRows, sortConfig])

  const dateRangeSummary = useMemo(() => {
    if (selectedDateRange.start && selectedDateRange.end) return `${selectedDateRange.start} to ${selectedDateRange.end}`
    if (selectedDateRange.start) return `from ${selectedDateRange.start}`
    if (selectedDateRange.end) return `up to ${selectedDateRange.end}`
    return 'all dates'
  }, [selectedDateRange])

  function handleDateRangeChange({ from, to }) { setFromDate(normalizeSelectedDate(from)); setToDate(normalizeSelectedDate(to)) }
  function handleDateRangeClear() { setFromDate(''); setToDate('') }
  function handleSearchSubmit(event) { event.preventDefault(); setSearchQuery(searchInput.trim()) }
  function handleResetFilters() { setFromDate(''); setToDate(''); setCreatorFilter('all'); setSearchInput(''); setSearchQuery(''); setSortConfig({ ...DEFAULT_SORT }) }
  function handleSortKeyChange(event) { const column = event.target.value; setSortConfig(prev => ({ key: column, direction: column === 'date' || column === 'timestamp' ? 'desc' : 'asc' })) }
  function handleSortDirectionChange(event) { setSortConfig(prev => ({ ...prev, direction: event.target.value })) }

  return (
    <div className={`app-layout ${sidebarOpen ? '' : 'sidebar-hidden'}`}>
      <Sidebar collapsed={!sidebarOpen} onToggle={() => setSidebarOpen(prev => !prev)} />
      <div className="main-wrapper">
        <main className="main-content admin-status-page">
          <header className="page-header fade-in">
            <div>
              <h1>Admin Status Dashboard</h1>
              <p className="text-muted">Document processing status from DocumentTracker (DynamoDB)</p>
            </div>
            <Link to="/home" className="btn btn-outline btn-sm">Back to home</Link>
          </header>

          {error && (
            <div className="admin-status-error" role="alert">
              <p>{error}</p>
              <button type="button" className="btn btn-outline btn-sm" onClick={loadReport}>Retry</button>
            </div>
          )}

          {!error && (
            <>
              <section className="status-overview fade-in" aria-label="Status overview">
                <article className="status-stat-card">
                  <p className="status-stat-card__label">Total Files</p>
                  <p className="status-stat-card__value">{latestSummary.totalFiles ?? '—'}</p>
                </article>
                <article className="status-stat-card">
                  <p className="status-stat-card__label">INDEXED</p>
                  <p className="status-stat-card__value">{latestSummary.INDEXED ?? 0}</p>
                </article>
                <article className="status-stat-card">
                  <p className="status-stat-card__label">PROCESSING</p>
                  <p className="status-stat-card__value">{latestSummary.PROCESSING ?? 0}</p>
                </article>
                <article className="status-stat-card">
                  <p className="status-stat-card__label">UPLOADED</p>
                  <p className="status-stat-card__value">{latestSummary.UPLOADED ?? 0}</p>
                </article>
                <article className="status-stat-card">
                  <p className="status-stat-card__label">FAILED</p>
                  <p className="status-stat-card__value">{latestSummary.FAILED ?? 0}</p>
                </article>
              </section>

              <DateRangeFilter fromDate={fromDate} toDate={toDate} maxDate={TODAY_ISO} onChange={handleDateRangeChange} onClear={handleDateRangeClear} />

              <section className="status-chart-panel fade-in" aria-label="Status distribution">
                <div className="status-chart-header">
                  <div>
                    <h2>Status Overview</h2>
                    {(fromDate || toDate) && <p className="text-muted">Filtered by {dateRangeSummary}</p>}
                  </div>
                </div>
                {loading && latestFileRecords.length === 0 ? <p className="text-muted">Loading chart…</p> : <div className="status-chart-content"><StatusPieChart data={chartData} total={chartTotal} /></div>}
              </section>

              <section className="status-table-section fade-in" aria-label="Document status table">
                <div className="status-table-header">
                  <h2>Status Report</h2>
                  {!loading && <p className="text-muted">{sortedRows.length} record{sortedRows.length === 1 ? '' : 's'} shown of {latestFileRecords.length} in {dateRangeSummary}</p>}
                </div>

                <form className="status-report-toolbar" onSubmit={handleSearchSubmit}>
                  <label className="status-filter-field status-toolbar-field--search"><span>Search records</span><input type="search" value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Document ID, status, timestamp..." /></label>
                  <button type="submit" className="btn btn-outline">Search</button>
                  <label className="status-filter-field status-toolbar-field"><span>Creator</span><select value={creatorFilter} onChange={e => setCreatorFilter(e.target.value)}><option value="all">All creators</option>{creatorOptions.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
                  <label className="status-filter-field status-toolbar-field"><span>Sort by</span><select value={sortConfig.key} onChange={handleSortKeyChange}>{SORTABLE_COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label>
                  <label className="status-filter-field status-toolbar-field"><span>Order</span><select value={sortConfig.direction} onChange={handleSortDirectionChange}><option value="asc">Ascending</option><option value="desc">Descending</option></select></label>
                  <button type="button" className="btn btn-outline" onClick={handleResetFilters}>Reset</button>
                </form>

                {loading && latestFileRecords.length === 0 ? (
                  <div className="admin-status-loading"><span className="doc-preview-spinner" aria-hidden="true" /><span>Loading status records…</span></div>
                ) : sortedRows.length === 0 ? (
                  <div className="empty-state fade-in"><p>No status records found.</p><span className="text-muted">Try clearing filters or broadening your date range.</span></div>
                ) : (
                  <div className="file-table-wrap file-table-wrap--search">
                    <table className="file-table file-table--search">
                      <thead>
                        <tr>
                          <th>Document ID</th>
                          <th>Creator</th>
                          <th>Date</th>
                          <th>Timestamp</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedRows.map(row => (
                          <tr key={`${row.documentId}-${row.timestamp}`} className="table-row">
                            <td title={row.documentId}>{row.documentId}</td>
                            <td>{row.creator}</td>
                            <td>{row.date}</td>
                            <td className="cell-mono">{row.timestamp}</td>
                            <td><StatusBadge status={row.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  )
}