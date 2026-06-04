import { useState, useRef, useCallback, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import axios from 'axios'

const LANGUAGES = [
  'javascript', 'typescript', 'python', 'java', 'cpp', 'csharp', 'go', 'rust',
  'html', 'css', 'sql', 'bash', 'ruby', 'php', 'swift', 'kotlin', 'other'
]

const EXPIRATION_OPTIONS = [
  { value: null, label: 'Never' },
  { value: '1h', label: '1 Hour' },
  { value: '24h', label: '24 Hours' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' }
]

const MAX_RETRIES = 3

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function useQuery() {
  return new URLSearchParams(useLocation().search)
}

function CreateSnippet() {
  const query = useQuery()
  const navigate = useNavigate()
  const forkCid = query.get('fork')
  
  const [title, setTitle] = useState('')
  const [language, setLanguage] = useState('javascript')
  const [content, setContent] = useState('')
  const [expiresIn, setExpiresIn] = useState(null)
  const [parentCid, setParentCid] = useState(null)
  const [parentTitle, setParentTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [uploadProgress, setUploadProgress] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const abortControllerRef = useRef(null)

  useEffect(() => {
    if (forkCid) {
      loadForkSource(forkCid)
    }
  }, [forkCid])

  const loadForkSource = async (cid) => {
    try {
      setLoading(true)
      const response = await axios.get(`/api/snippets/${cid}`, { timeout: 30000 })
      const snippet = response.data.snippet
      
      setTitle(`${snippet.title} (fork)`)
      setLanguage(snippet.language)
      setContent(snippet.content || '')
      setParentCid(cid)
      setParentTitle(snippet.title)
      setLoading(false)
    } catch (err) {
      setError('Failed to load source snippet for forking')
      setLoading(false)
    }
  }

  const contentSize = new TextEncoder().encode(content).byteLength
  const isLargeFile = contentSize > 256 * 1024

  const trackProgress = useCallback((uploadId) => {
    if (!uploadId) return

    const eventSource = new EventSource(`/api/snippets/progress/${uploadId}`)
    
    eventSource.onmessage = (event) => {
      try {
        const progress = JSON.parse(event.data)
        setUploadProgress(progress)
        if (progress.phase === 'complete') {
          eventSource.close()
        }
      } catch (e) {
        console.log('Progress parse error:', e)
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
    }

    return eventSource
  }, [])

  const handleSubmit = async (e, isRetry = false) => {
    e.preventDefault()
    if (!isRetry) {
      setRetryCount(0)
    }
    setLoading(true)
    setError('')
    setResult(null)
    setUploadProgress({ phase: 'started', percent: 0 })

    abortControllerRef.current = new AbortController()

    let attempts = isRetry ? retryCount : 0
    
    while (attempts < MAX_RETRIES) {
      try {
        const response = await axios.post('/api/snippets', {
          title,
          language,
          content,
          parentCid,
          expiresIn
        }, {
          signal: abortControllerRef.current.signal,
          timeout: 5 * 60 * 1000
        })

        if (response.data.uploadId) {
          trackProgress(response.data.uploadId)
        }

        setResult(response.data)
        setUploadProgress({ phase: 'complete', percent: 100 })
        setLoading(false)
        return
      } catch (err) {
        attempts++
        setRetryCount(attempts)

        if (err.code === 'ERR_CANCELED' || axios.isCancel(err)) {
          setLoading(false)
          setUploadProgress(null)
          return
        }

        if (attempts >= MAX_RETRIES) {
          setError(
            err.response?.data?.error || 
            err.message || 
            `Failed to create snippet after ${MAX_RETRIES} attempts`
          )
          setLoading(false)
          setUploadProgress(null)
          return
        }

        const delay = Math.pow(2, attempts) * 1000
        setUploadProgress({ 
          phase: 'retrying', 
          percent: 0, 
          attempt: attempts, 
          maxAttempts: MAX_RETRIES,
          nextRetryIn: delay / 1000
        })
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  const handleRetry = (e) => {
    handleSubmit(e, true)
  }

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setLoading(false)
    setUploadProgress(null)
    setError('Upload cancelled')
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
  }

  const getPhaseLabel = (phase) => {
    const labels = {
      'started': 'Initializing...',
      'chunking': 'Uploading chunks...',
      'merging': 'Merging chunks...',
      'uploading': 'Uploading to IPFS...',
      'pinning': 'Pinning locally...',
      'creating-metadata': 'Creating metadata...',
      'indexing': 'Indexing in DHT...',
      'complete': 'Complete!',
      'retrying': 'Retrying...'
    }
    return labels[phase] || phase
  }

  const formatExpirationDisplay = (expiresAt) => {
    if (!expiresAt) return 'Never'
    const date = new Date(expiresAt)
    return date.toLocaleString()
  }

  return (
    <div className="form-container">
      <h2 style={{ marginBottom: '12px' }}>
        {parentCid ? 'Fork Snippet' : 'Create New Snippet'}
      </h2>
      
      {parentCid && (
        <div style={{ marginBottom: '24px', padding: '12px', background: 'rgba(88, 166, 255, 0.1)', borderRadius: '6px', fontSize: '14px' }}>
          <span style={{ color: '#58a6ff' }}>Forked from:</span>{' '}
          <Link to={`/${parentCid}`} style={{ color: '#c9d1d9' }}>
            {parentTitle || parentCid}
          </Link>
        </div>
      )}
      
      <form onSubmit={(e) => handleSubmit(e)}>
        <div className="form-group">
          <label>Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter snippet title..."
            required
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label>Language</label>
          <select 
            value={language} 
            onChange={(e) => setLanguage(e.target.value)}
            disabled={loading}
          >
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {lang.charAt(0).toUpperCase() + lang.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Expiration</label>
          <select 
            value={expiresIn || ''} 
            onChange={(e) => setExpiresIn(e.target.value || null)}
            disabled={loading}
          >
            {EXPIRATION_OPTIONS.map((opt) => (
              <option key={opt.value || 'never'} value={opt.value || ''}>
                {opt.label}
              </option>
            ))}
          </select>
          {expiresIn && (
            <div style={{ marginTop: '6px', fontSize: '12px', color: '#f0883e' }}>
              ⚠ Snippet will be unpinned and become unavailable after this period
            </div>
          )}
        </div>

        <div className="form-group">
          <label>
            Code
            {contentSize > 0 && (
              <span style={{ marginLeft: '12px', fontSize: '12px', color: isLargeFile ? '#f0883e' : '#6e7681' }}>
                {formatBytes(contentSize)}
                {isLargeFile && ' (will be chunked)'}
              </span>
            )}
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste your code here..."
            required
            disabled={loading}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Uploading to IPFS...' : 'Submit to IPFS'}
          </button>
          {loading && (
            <button type="button" className="btn btn-secondary" onClick={handleCancel}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {uploadProgress && loading && (
        <div className="progress-container">
          <div className="progress-header">
            <span>{getPhaseLabel(uploadProgress.phase)}</span>
            <span>{uploadProgress.percent || 0}%</span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${uploadProgress.percent || 0}%` }}
            />
          </div>
          {uploadProgress.phase === 'chunking' && uploadProgress.totalChunks > 1 && (
            <div className="progress-detail">
              Chunk {uploadProgress.chunk} of {uploadProgress.totalChunks}
            </div>
          )}
          {uploadProgress.phase === 'retrying' && (
            <div className="progress-detail retry-detail">
              Attempt {uploadProgress.attempt} of {uploadProgress.maxAttempts}...
              {uploadProgress.nextRetryIn && ` Retrying in ${uploadProgress.nextRetryIn}s`}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="error" style={{ marginTop: '20px' }}>
          <div>{error}</div>
          {retryCount >= MAX_RETRIES && (
            <button 
              className="btn btn-secondary retry-btn"
              onClick={handleRetry}
              style={{ marginTop: '10px' }}
            >
              Retry Upload
            </button>
          )}
        </div>
      )}

      {result && (
        <div className="result-box">
          <h3>Snippet Created Successfully!</h3>
          {result.parentCid && (
            <p style={{ marginBottom: '8px', color: '#58a6ff', fontSize: '13px' }}>
              🔀 Fork created from: {result.parentTitle || result.parentCid}
            </p>
          )}
          {result.isChunked && (
            <p style={{ marginBottom: '8px', color: '#f0883e', fontSize: '13px' }}>
              Large file was split into chunks and uploaded separately
            </p>
          )}
          {result.expiresAt && (
            <p style={{ marginBottom: '8px', color: '#f0883e', fontSize: '13px' }}>
              ⏰ Expires on: {formatExpirationDisplay(result.expiresAt)}
            </p>
          )}
          <p style={{ marginBottom: '10px', color: '#8b949e' }}>
            Your code has been stored on IPFS and pinned locally. Share this link:
          </p>
          <div className="cid-display">
            <code>{window.location.origin}/{result.cid}</code>
            <button 
              className="copy-btn"
              onClick={() => copyToClipboard(`${window.location.origin}/${result.cid}`)}
            >
              Copy
            </button>
          </div>
          <div style={{ marginTop: '10px', fontSize: '13px', color: '#3fb950' }}>
            ✓ Pinned locally (protected from garbage collection)
          </div>
          <p style={{ marginTop: '15px' }}>
            <Link to={`/${result.cid}`}>View Snippet →</Link>
          </p>
        </div>
      )}
    </div>
  )
}

export default CreateSnippet
