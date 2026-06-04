import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import ProcessDetail from './pages/ProcessDetail';
import Config from './pages/Config';
import { useWebSocket } from './hooks/useWebSocket';

function AppContent() {
  useWebSocket();

  return (
    <div className="flex min-h-screen bg-[#0A1929]">
      <Sidebar />
      <div className="flex-1 ml-64">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/process/:id" element={<ProcessDetail />} />
          <Route path="/config" element={<Config />} />
        </Routes>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
