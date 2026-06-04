import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Lobby from '@/pages/Lobby'
import GameStream from '@/pages/GameStream'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Lobby />} />
        <Route path="/play/:gameId" element={<GameStream />} />
      </Routes>
    </Router>
  )
}
