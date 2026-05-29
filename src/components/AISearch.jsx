import { useState, useCallback } from 'react'
import './AISearch.css'


const AI_SEARCH_ENDPOINT =
  'https://ypq6aalk4lulj23yfgxd34vx3q0ohqhp.lambda-url.us-east-1.on.aws/'
/**
 * Normalize a single AI search hit for display.
 */
function normalizeResult(item) {
  if (!item || typeof item !== 'object') return null

  const score = Number(item.Score ?? item.score ?? 0)

  return {
    documentId: String(item.DocumentId ?? item.documentId ?? '—'),
    fileName: String(item.FileName ?? item.fileName ?? 'Untitled document'),
    chunkText: String(item.ChunkText ?? item.chunkText ?? ''),
    score: Number.isFinite(score) ? score : 0,
  }
}


async function fetchAiSearchResults(query) {

  let response

  try {

    response = await fetch(
      AI_SEARCH_ENDPOINT,
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify({
          query
        })
      }
    )

  } catch (error) {

    console.error(error)

    throw new Error(
      'Unable to connect to AI Search service.'
    )
  }

  // ==========================================
  // HANDLE HTTP ERRORS
  // ==========================================

  if (!response.ok) {

    const errorText =
      await response.text()

    console.error(errorText)

    throw new Error(
      `Backend Error (${response.status})`
    )
  }

  // ==========================================
  // PARSE RESPONSE
  // ==========================================

  const data = await response.json()

  if (data?.error) {

    throw new Error(data.error)
  }

  // ==========================================
  // NORMALIZE RESULTS
  // ==========================================

  const rawResults =
    Array.isArray(data?.results)
      ? data.results
      : []

  return rawResults
    .map(normalizeResult)
    .filter(Boolean)
}

function formatScore(score) {
  if (score <= 1) {
    return `${(score * 100).toFixed(1)}%`
  }
  return score.toFixed(2)
}

export default function AISearch({ onView }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [resultCount, setResultCount] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasSearched, setHasSearched] = useState(false)

  const runSearch = useCallback(async () => {
    const trimmed = query.trim()

    if (!trimmed) {
      setError('Please enter a search query.')
      setResults([])
      setResultCount(null)
      setHasSearched(false)
      return
    }

    setLoading(true)
    setError('')
    setHasSearched(true)

    try {
      const hits = await fetchAiSearchResults(trimmed)
      setResults(hits)
      setResultCount(hits.length)
    } catch (err) {
      setResults([])
      setResultCount(null)
      setError(err.message || 'AI search failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [query])

  function handleSubmit(e) {
    e.preventDefault()
    if (!loading) {
      runSearch()
    }
  }

  return (
    <section className="ai-search" aria-label="AI document search">
      <form className="ai-search__form" onSubmit={handleSubmit} noValidate>
        <label htmlFor="ai-search-input" className="ai-search__label">
          Search query
        </label>
        <div className="ai-search__controls">
          <div className="ai-search__input-wrap">
            <svg
              className="ai-search__input-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              id="ai-search-input"
              type="text"
              className="ai-search__input"
              placeholder="e.g. loan agreement for commercial property..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={loading}
              autoComplete="off"
              aria-describedby={error ? 'ai-search-error' : undefined}
            />
          </div>
          <button
            type="submit"
            className="ai-search__button"
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? 'Searching…' : 'AI Search'}
          </button>
        </div>
      </form>

      {error && (
        <p id="ai-search-error" className="ai-search__error" role="alert">
          {error}
        </p>
      )}

      {resultCount !== null && !error && (
        <p className="ai-search__count" aria-live="polite">
          {resultCount} result{resultCount === 1 ? '' : 's'} found
        </p>
      )}

      {loading && (
        <div className="ai-search__loading" aria-live="polite">
          <span className="ai-search__spinner" aria-hidden="true" />
          <span>Analyzing documents with AI…</span>
        </div>
      )}

      {!loading && hasSearched && resultCount === 0 && !error && (
        <div className="ai-search__empty" role="status">
          <p className="ai-search__empty-title">No results found</p>
          <p className="ai-search__empty-text">
            Try rephrasing your query or using different terms related to your
            document content.
          </p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <ul className="ai-search__results" aria-label="AI search results">
          {results.map((item, index) => (
            <li
              key={`${item.documentId}-${index}`}
              className="ai-search__card"
            >
              <div className="ai-search__card-header">
                <h3 className="ai-search__card-title">{item.fileName}</h3>
                <div className="ai-search__card-actions">
                  <span className="ai-search__score" title="Similarity score">
                    {formatScore(item.score)}
                  </span>
                  {item.documentId && item.documentId !== '—' && (
                    <button
                      type="button"
                      className="btn-link btn-view"
                      onClick={() => onView?.(item.documentId)}
                    >
                      View
                    </button>
                  )}
                </div>
              </div>
              <dl className="ai-search__meta">
                <div className="ai-search__meta-row">
                  <dt>Document ID</dt>
                  <dd className="ai-search__mono">{item.documentId}</dd>
                </div>
              </dl>
              {item.chunkText && (
                <blockquote className="ai-search__chunk">
                  <span className="ai-search__chunk-label">Matched excerpt</span>
                  <p>{item.chunkText}</p>
                </blockquote>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}