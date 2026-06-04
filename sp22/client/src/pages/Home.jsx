import { Link } from 'react-router-dom'

function Home() {
  return (
    <div className="home-container">
      <h2>Decentralized Code Snippet Sharing</h2>
      <p>
        Share code snippets stored on IPFS. No login required, fully decentralized.
      </p>
      <div className="home-actions">
        <Link to="/create">
          <button className="btn btn-primary">Create Snippet</button>
        </Link>
        <Link to="/search">
          <button className="btn btn-secondary">Search Snippets</button>
        </Link>
      </div>
    </div>
  )
}

export default Home
