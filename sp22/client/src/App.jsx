import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import Home from './pages/Home.jsx'
import CreateSnippet from './pages/CreateSnippet.jsx'
import SnippetView from './pages/SnippetView.jsx'
import Search from './pages/Search.jsx'
import EmbeddedDemo from './pages/EmbeddedDemo.jsx'

function NavLinks() {
  const location = useLocation()
  
  return (
    <nav className="nav-links">
      <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
        Home
      </Link>
      <Link to="/create" className={location.pathname === '/create' ? 'active' : ''}>
        New Snippet
      </Link>
      <Link to="/search" className={location.pathname === '/search' ? 'active' : ''}>
        Search
      </Link>
    </nav>
  )
}

function MainLayout({ children }) {
  return (
    <div className="app">
      <header className="header">
        <h1>
          <Link to="/">IPFS Code Snippets</Link>
        </h1>
        <NavLinks />
      </header>
      {children}
    </div>
  )
}

function EmbedLayout({ children }) {
  return (
    <div className="embed-page">
      {children}
    </div>
  )
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/embed/:cid" element={
          <EmbedLayout>
            <EmbeddedDemo />
          </EmbedLayout>
        } />
        <Route path="*" element={
          <MainLayout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/create" element={<CreateSnippet />} />
              <Route path="/:cid" element={<SnippetView />} />
              <Route path="/search" element={<Search />} />
            </Routes>
          </MainLayout>
        } />
      </Routes>
    </Router>
  )
}

export default App
