import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const LANGUAGES = [
  'all', 'javascript', 'typescript', 'python', 'java', 'cpp', 'csharp', 'go', 'rust',
  'html', 'css', 'sql', 'bash', 'ruby', 'php', 'swift', 'kotlin', 'other'
]

function Search() {
  const [query, setQuery] = useState('')
  const [language, setLanguage] = useState('all')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!query.trim() && language === 'all') return

    setLoading(true)
    setError('')
    setSearched(true)

    try {
      const params = {}
      if (query.trim()) params.q = query
      if (language !== 'all') params.language = language

      const response = await axios.get('/api/search', { params })
      setResults(response.data.results)
    } catch (err) {
      setError(err.response?.data?.error || 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString()
  }

  return (
    <div className="search-container">
      <h2 style={{ marginBottom: '24px' }}>Search Snippets</h2>
      
      <form onSubmit={handleSearch} className="search-form">
        <input
          type="text"
          placeholder="Search by title or content..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={language} onChange={(e) => setLanguage(e.target.value)}>
          {LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {lang === 'all' ? 'All Languages' : lang.charAt(0).toUpperCase() + lang.slice(1)}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="error">{error}</div>
      )}

      {searched && !loading && (
        <div>
          <p style={{ marginBottom: '20px', color: '#8b949e' }}>
            Found {results.length} result{results.length !== 1 ? 's' : ''}
          </p>

          {results.length === 0 ? (
            <div className="error" style={{ background: 'transparent', border: 'none', color: '#8b949e' }}>
              No snippets found. Try a different search term.
            </div>
          ) : (
            <div className="search-results">
              {results.map((result) => (
                <div
                  key={result.cid}
                  className="search-result-item"
                  onClick={() => navigate(`/${result.cid}`)}
                >
                  <h4>{result.title}</h4>
                  <p>{result.preview}...</p>
                  <div className="search-result-meta">
                    <span>{result.language}</span>
                    <span>{formatDate(result.createdAt)}</span>
                    <span>CID: {result.cid.substring(0, 16)}...</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Search
