import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import ObserverDetail from '@/pages/ObserverDetail';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useDataLoader } from '@/hooks/useDataLoader';

function AppContent() {
  useWebSocket();
  useDataLoader();

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/observer/:sourceId" element={<ObserverDetail />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
