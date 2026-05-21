// const FILTERS = [
//   { value: 'all', label: 'All fields' },
//   { value: 'name', label: 'Asset name' },
//   { value: 'owner', label: 'Owner name' },
//   { value: 'date', label: 'Created date' },
// ]

// export default function FileSearch({ query, filter, onQueryChange, onFilterChange }) {
//   return (
//     <div className="search-bar fade-in">
//       <div className="search-input-wrap">
//         <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//           <circle cx="11" cy="11" r="8" />
//           <path d="M21 21l-4.35-4.35" />
//         </svg>
//         <input
//           type="text"
//           placeholder="Search assets..."
//           value={query}
//           onChange={(e) => onQueryChange(e.target.value)}
//         />
//       </div>

//       <select value={filter} onChange={(e) => onFilterChange(e.target.value)}>
//         {FILTERS.map((f) => (
//           <option key={f.value} value={f.value}>
//             {f.label}
//           </option>
//         ))}
//       </select>
//     </div>
//   )
// }
const FILTERS = [
  {
    value: 'DocumentType',
    label: 'Document Type'
  },
  {
    value: 'AccountNumber',
    label: 'Account Number'
  },
  {
    value: 'AccountHolderName',
    label: 'Account Holder Name'
  },
  {
    value: 'Branch',
    label: 'Branch'
  }
]

export default function FileSearch({
  query,
  filter,
  onQueryChange,
  onFilterChange,
  onSearch,
  loading
}) {

  return (

    <div className="search-bar fade-in">

      <div className="search-input-wrap">

        <svg
          className="search-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle
            cx="11"
            cy="11"
            r="8"
          />

          <path d="M21 21l-4.35-4.35" />

        </svg>

        <input
          type="text"
          placeholder="Search documents..."
          value={query}
          onChange={(e) =>
            onQueryChange(
              e.target.value
            )
          }
        />

      </div>

      <select
        value={filter}
        onChange={(e) =>
          onFilterChange(
            e.target.value
          )
        }
      >

        {FILTERS.map((f) => (

          <option
            key={f.value}
            value={f.value}
          >
            {f.label}
          </option>

        ))}

      </select>

      <button
        className="btn btn-primary"
        onClick={onSearch}
        disabled={loading}
      >

        {loading
          ? 'Searching...'
          : 'Search'}

      </button>

    </div>
  )
}