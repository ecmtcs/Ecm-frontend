import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import StatusPieChart from '../components/StatusPieChart'
import { isAdmin } from '../utils/auth'
import {
  buildStatusChartData,
  fetchDocumentStatusReport,
} from '../utils/statusReportApi'
import './AdminStatusReport.css'

const PAGE_SIZE = 25

function StatusBadge({ status }) {
  const normalized = String(status || '').toUpperCase()
  const className =
    normalized === 'INDEXED' || normalized === 'COMPLETED'
      ? 'status-badge status-badge--completed'
      : normalized === 'FAILED'
        ? 'status-badge status-badge--failed'
        : 'status-badge status-badge--processing'

  const label =
    normalized === 'INDEXED'
      ? 'Completed'
      : normalized === 'UPLOADED' || normalized === 'PROCESSING'
        ? 'Processing'
        : status

  return <span className={className}>{label}</span>
}

export default function AdminStatusReport() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [items, setItems] = useState([])
  const [summary, setSummary] = useState(null)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  const loadReport = useCallback(async (pageNumber, append = false) => {
    if (!isAdmin()) {
      setError('Unauthorized access.')
      setLoading(false)
      return
    }

    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }
    setError('')

    try {
      console.info('[StatusReport] Fetching page', pageNumber)
      const data = await fetchDocumentStatusReport({
        limit: PAGE_SIZE,
        page: pageNumber,
      })

      setSummary(data.summary)
      setHasMore(data.hasMore)
      setPage(data.page)
      setItems((prev) => (append ? [...prev, ...data.items] : data.items))
    } catch (err) {
      console.error('[StatusReport] Load failed', err)
      if (!append) {
        setItems([])
        setSummary(null)
      }
      setError(err.message || 'Failed to load status report.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    loadReport(0, false)
  }, [loadReport])

  const chartData = useMemo(
    () => buildStatusChartData(summary?.statusDistribution),
    [summary?.statusDistribution]
  )

  const chartTotal = useMemo(
    () => chartData.reduce((sum, entry) => sum + entry.value, 0),
    [chartData]
  )

  function handleLoadMore() {
    if (!hasMore || loadingMore) return
    loadReport(page + 1, true)
  }

  return (
    <div className={`app-layout ${sidebarOpen ? '' : 'sidebar-hidden'}`}>
      <Sidebar collapsed={!sidebarOpen} onToggle={() => setSidebarOpen((prev) => !prev)} />

      <div className="main-wrapper">
        <main className="main-content admin-status-page">
          <header className="page-header fade-in">
            <div>
              <h1>Admin Status Dashboard</h1>
              <p className="text-muted">Document processing status from DocumentTracker (DynamoDB)</p>
            </div>
            <Link to="/home" className="btn btn-outline btn-sm">
              Back to home
            </Link>
          </header>

          {error && (
            <div className="admin-status-error" role="alert">
              <p>{error}</p>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => loadReport(0, false)}>
                Retry
              </button>
            </div>
          )}

          {!error && (
            <>
              <section className="status-overview fade-in" aria-label="Status overview">
                <article className="status-stat-card">
                  <p className="status-stat-card__label">Total Files</p>
                  <p className="status-stat-card__value">{summary?.totalFiles ?? '—'}</p>
                </article>
                <article className="status-stat-card">
                  <p className="status-stat-card__label">Total Processing</p>
                  <p className="status-stat-card__value">{summary?.totalProcessing ?? '—'}</p>
                </article>
                <article className="status-stat-card">
                  <p className="status-stat-card__label">Total Completed</p>
                  <p className="status-stat-card__value">{summary?.totalCompleted ?? '—'}</p>
                </article>
                <article className="status-stat-card">
                  <p className="status-stat-card__label">Total Failed</p>
                  <p className="status-stat-card__value">{summary?.totalFailed ?? '—'}</p>
                </article>
              </section>

              <section className="status-chart-panel fade-in" aria-label="Status distribution">
                <h2>Status Overview</h2>
                {loading && !summary ? (
                  <p className="text-muted">Loading chart…</p>
                ) : (
                  <StatusPieChart data={chartData} total={chartTotal} />
                )}
              </section>

              <section className="status-table-section fade-in" aria-label="Document status table">
                <div className="status-table-header">
                  <h2>Status Report</h2>
                  {summary && (
                    <p className="text-muted">
                      {summary.totalFiles} record{summary.totalFiles === 1 ? '' : 's'} · sorted by latest timestamp
                    </p>
                  )}
                </div>

                {loading && items.length === 0 ? (
                  <div className="admin-status-loading">
                    <span className="doc-preview-spinner" aria-hidden="true" />
                    <span>Loading status records…</span>
                  </div>
                ) : items.length === 0 ? (
                  <div className="empty-state fade-in">
                    <p>No status records found.</p>
                    <span className="text-muted">DocumentTracker is empty or unreachable.</span>
                  </div>
                ) : (
                  <>
                    <div className="file-table-wrap file-table-wrap--search">
                      <table className="file-table file-table--search">
                        <thead>
                          <tr>
                            <th>Filename</th>
                            <th>Creator</th>
                            <th>Date</th>
                            <th>Timestamp</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((row) => (
                            <tr key={`${row.documentId}-${row.timestamp}`} className="table-row">
                              <td title={row.filename}>{row.filename}</td>
                              <td>{row.creator}</td>
                              <td>{row.date}</td>
                              <td className="cell-mono">{row.timestamp}</td>
                              <td>
                                <StatusBadge status={row.status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {hasMore && (
                      <div className="status-table-actions">
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={handleLoadMore}
                          disabled={loadingMore}
                        >
                          {loadingMore ? 'Loading…' : 'Load more'}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
