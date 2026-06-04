import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'

function EmbeddedDemo() {
  const { cid } = useParams()
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (cid) {
      const script = document.createElement('script')
      script.src = `/api/embed/${cid}`
      script.onload = () => setLoaded(true)
      script.onerror = () => setLoaded(true)
      
      const container = document.getElementById('embed-container')
      if (container) {
        container.innerHTML = ''
        container.appendChild(script)
      }
    }
  }, [cid])

  if (!cid) {
    return (
      <div className="form-container">
        <h2 style={{ marginBottom: '20px' }}>Embed Preview</h2>
        <p style={{ color: '#8b949e', marginBottom: '20px' }}>
          Visit <code>/embed/&lt;CID&gt;</code> to preview an embedded snippet.
        </p>
        <Link to="/" className="btn btn-primary">
          Go Home
        </Link>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px', padding: '16px', background: '#161b22', border: '1px solid #30363d', borderRadius: '6px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '8px' }}>Embed Preview</h2>
        <p style={{ color: '#8b949e', fontSize: '14px', marginBottom: '12px' }}>
          This is how your snippet will appear when embedded on other websites.
        </p>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '6px', color: '#8b949e', fontSize: '13px' }}>
            Use this code to embed:
          </label>
          <div className="cid-display" style={{ margin: 0 }}>
            <code>{`<script src="${window.location.origin}/api/embed/${cid}"></script>`}</code>
            <button 
              className="copy-btn"
              onClick={() => navigator.clipboard.writeText(`<script src="${window.location.origin}/api/embed/${cid}"></script>`)}
            >
              Copy
            </button>
          </div>
        </div>
        <Link to={`/${cid}`} style={{ color: '#58a6ff', textDecoration: 'none', fontSize: '14px' }}>
          ← Back to snippet
        </Link>
      </div>

      <div id="embed-container">
        {!loaded && (
          <div className="loading">Loading embed...</div>
        )}
      </div>
    </div>
  )
}

export default EmbeddedDemo
