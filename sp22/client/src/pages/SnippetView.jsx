import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import hljs from 'highlight.js'

const MAX_COMMENT_RETRIES = 3
const RETRY_DELAY = 2000

function SnippetView() {
  const { cid } = useParams()
  const navigate = useNavigate()
  const [snippet, setSnippet] = useState(null)
  const [comments, setComments] = useState([])
  const [forks, setForks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [author, setAuthor] = useState('')
  const [commentContent, setCommentContent] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentError, setCommentError] = useState('')
  const [showEmbed, setShowEmbed] = useState(false)
  const [extraData, setExtraData] = useState(null)
  const codeRef = useRef(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    fetchSnippet()
  }, [cid])

  useEffect(() => {
    if (snippet && codeRef.current) {
      codeRef.current.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block)
      })
    }
  }, [snippet])

  const fetchWithRetry = useCallback(async (url, maxRetries = MAX_COMMENT_RETRIES) => {
    let lastError
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.get(url, { timeout: 30000 })
        return response.data
      } catch (err) {
        lastError = err
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt))
        }
      }
    }
    throw lastError
  }, [])

  const fetchSnippet = async () => {
    try {
      setLoading(true)
      setError('')
      const data = await fetchWithRetry(`/api/snippets/${cid}`)
      if (!mountedRef.current) return
      setSnippet(data.snippet)
      setExtraData({
        pinned: data.pinned,
        isExpired: data.isExpired,
        expiresInMs: data.expiresInMs,
        forkCount: data.forkCount,
        hasParent: data.hasParent
      })
      fetchComments()
      fetchForks()
    } catch (err) {
      if (!mountedRef.current) return
      setError(err.response?.data?.error || 'Failed to load snippet')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }

  const fetchComments = async () => {
    setCommentsLoading(true)
    setCommentError('')
    try {
      const data = await fetchWithRetry(`/api/comments/snippet/${cid}`)
      if (!mountedRef.current) return
      setComments(data.comments || [])
    } catch (err) {
      if (!mountedRef.current) return
      console.log('No comments found or failed to load')
      setComments([])
      setCommentError('Failed to load comments')
    } finally {
      if (mountedRef.current) setCommentsLoading(false)
    }
  }

  const fetchForks = async () => {
    try {
      const data = await fetchWithRetry(`/api/snippets/${cid}/forks`, 2)
      if (!mountedRef.current) return
      setForks(data.forks || [])
    } catch (err) {
      console.log('Could not load forks:', err.message)
    }
  }

  const handleCommentSubmit = async (e) => {
    e.preventDefault()
    if (!commentContent.trim()) return

    setSubmittingComment(true)
    setCommentError('')
    try {
      const response = await axios.post('/api/comments', {
        snippetCid: cid,
        author: author || 'Anonymous',
        content: commentContent
      }, { timeout: 30000 })

      setCommentContent('')
      setAuthor('')

      await fetchComments()
    } catch (err) {
      setCommentError(err.response?.data?.error || 'Failed to submit comment')
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleFork = () => {
    navigate(`/create?fork=${cid}`)
  }

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString()
  }

  const formatDuration = (ms) => {
    if (ms <= 0) return 'Expired'
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days} day${days > 1 ? 's' : ''}`
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`
    if (minutes > 0) return `${minutes} min${minutes > 1 ? 's' : ''}`
    return `${seconds} sec${seconds > 1 ? 's' : ''}`
  }

  const getEmbedCode = () => {
    const baseUrl = window.location.origin
    return `<script src="${baseUrl}/api/embed/${cid}"></script>`
  }

  const copyEmbedCode = () => {
    navigator.clipboard.writeText(getEmbedCode())
  }

  if (loading) {
    return <div className="loading">Loading snippet from IPFS...</div>
  }

  if (error) {
    return (
      <div>
        <div className="error">{error}</div>
        <button 
          className="btn btn-secondary" 
          onClick={fetchSnippet}
          style={{ marginTop: '12px' }}
        >
          Retry
        </button>
      </div>
    )
  }

  if (!snippet) {
    return <div className="error">Snippet not found</div>
  }

  return (
    <div>
      <div className="snippet-page">
        <div className="snippet-header">
          <div>
            <h2>{snippet.title}</h2>
            <div className="snippet-meta">
              <span>{formatDate(snippet.createdAt)}</span>
              <span className="language-tag">{snippet.language}</span>
              {snippet.size && (
                <span>{(snippet.size / 1024).toFixed(1)} KB</span>
              )}
              {snippet.forkedFrom && (
                <span>
                  🔀 Forked from{' '}
                  <Link to={`/${snippet.forkedFrom}`} style={{ color: '#58a6ff' }}>
                    {snippet.forkedFrom.substring(0, 12)}...
                  </Link>
                </span>
              )}
              {extraData?.isExpired ? (
                <span style={{ color: '#f85149' }}>
                  ⚠ Expired
                </span>
              ) : extraData?.expiresInMs ? (
                <span style={{ color: '#f0883e' }}>
                  ⏰ Expires in {formatDuration(extraData.expiresInMs)}
                </span>
              ) : null}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
            <div className="cid-display" style={{ marginTop: 0 }}>
              <code>{cid}</code>
              <button 
                className="copy-btn"
                onClick={() => navigator.clipboard.writeText(cid)}
              >
                Copy CID
              </button>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="copy-btn" onClick={handleFork}>
                🔀 Fork
              </button>
              <button 
                className="copy-btn"
                onClick={() => setShowEmbed(!showEmbed)}
              >
                {'</>'} Embed
              </button>
            </div>
          </div>
        </div>

        {showEmbed && (
          <div className="embed-section">
            <div style={{ padding: '16px 30px', borderBottom: '1px solid #30363d', background: '#0d1117' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#8b949e', fontSize: '13px' }}>
                Embed this snippet on your website:
              </label>
              <div className="cid-display" style={{ margin: 0 }}>
                <code>{getEmbedCode()}</code>
                <button className="copy-btn" onClick={copyEmbedCode}>
                  Copy
                </button>
              </div>
              <div style={{ marginTop: '10px' }}>
                <Link 
                  to={`/embed/${cid}`}
                  target="_blank"
                  style={{ color: '#58a6ff', fontSize: '13px', textDecoration: 'none' }}
                >
                  Preview embed →
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="snippet-content" ref={codeRef}>
          <pre>
            <code className={`language-${snippet.language}`}>
              {snippet.content}
            </code>
          </pre>
        </div>

        <div style={{ padding: '12px 30px', borderTop: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
          <div style={{ color: '#6e7681' }}>
            {extraData?.pinned ? (
              <span style={{ color: '#3fb950' }}>✓ Pinned locally</span>
            ) : (
              <span style={{ color: '#f0883e' }}>⚠ Not pinned</span>
            )}
            {extraData?.forkCount > 0 && (
              <span style={{ marginLeft: '20px' }}>
                🔀 {extraData.forkCount} fork{extraData.forkCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div>
            <Link to="/create" style={{ color: '#58a6ff', textDecoration: 'none', marginRight: '20px' }}>
              Create New
            </Link>
          </div>
        </div>
      </div>

      {forks.length > 0 && (
        <div className="forks-section" style={{ marginTop: '20px', background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px 30px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>Forks ({forks.length})</h3>
          <div className="search-results">
            {forks.map((fork) => (
              <div
                key={fork.cid}
                className="search-result-item"
                onClick={() => navigate(`/${fork.cid}`)}
              >
                <h4>{fork.title}</h4>
                <p>{fork.preview}...</p>
                <div className="search-result-meta">
                  <span>{fork.language}</span>
                  <span>{formatDate(fork.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="comments-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>
            Comments ({comments.length})
            {commentsLoading && <span style={{ marginLeft: '8px', fontSize: '13px', color: '#8b949e' }}>Loading...</span>}
          </h3>
          {!commentsLoading && (
            <button 
              className="copy-btn"
              onClick={fetchComments}
              title="Refresh comments"
            >
              Refresh
            </button>
          )}
        </div>
        
        <form onSubmit={handleCommentSubmit} className="comment-form">
          <input
            type="text"
            placeholder="Your name (optional)"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            disabled={submittingComment}
          />
          <textarea
            placeholder="Write a comment..."
            value={commentContent}
            onChange={(e) => setCommentContent(e.target.value)}
            required
            disabled={submittingComment}
          />
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={submittingComment}
            >
              {submittingComment ? 'Posting...' : 'Post Comment'}
            </button>
            {commentError && (
              <span style={{ color: '#f85149', fontSize: '13px' }}>{commentError}</span>
            )}
          </div>
        </form>

        <div className="comment-list">
          {commentsLoading && comments.length === 0 ? (
            <div className="loading">Loading comments...</div>
          ) : comments.length === 0 ? (
            <p style={{ color: '#8b949e' }}>No comments yet. Be the first to comment!</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.cid} className="comment">
                <div className="comment-header">
                  <span className="comment-author">{comment.author}</span>
                  <span className="comment-date">{formatDate(comment.createdAt)}</span>
                </div>
                <div className="comment-content">{comment.content}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default SnippetView
