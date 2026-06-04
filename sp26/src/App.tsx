import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from '@/components/Layout/MainLayout';
import Home from '@/pages/Home';
import InventoryPage from '@/pages/InventoryPage';
import WriteTagPage from '@/pages/WriteTagPage';
import LocationPage from '@/pages/LocationPage';
import AssetsPage from '@/pages/AssetsPage';
import AssetDetailPage from '@/pages/AssetDetailPage';
import OfflineSyncPage from '@/pages/OfflineSyncPage';
import LifecycleLogsPage from '@/pages/LifecycleLogsPage';
import CSVPage from '@/pages/CSVPage';
import LoginPage from '@/pages/LoginPage';
import { useAuthStore } from '@/store/authStore';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/inventory" element={<InventoryPage />} />
                  <Route path="/write-tag" element={<WriteTagPage />} />
                  <Route path="/location" element={<LocationPage />} />
                  <Route path="/assets" element={<AssetsPage />} />
                  <Route path="/assets/:uid" element={<AssetDetailPage />} />
                  <Route path="/offline" element={<OfflineSyncPage />} />
                  <Route path="/lifecycle" element={<LifecycleLogsPage />} />
                  <Route path="/csv" element={<CSVPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </MainLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}
