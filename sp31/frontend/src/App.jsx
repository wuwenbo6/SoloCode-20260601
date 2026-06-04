import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.jsx';
import Navbar from './components/Navbar.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import GamepadMonitor from './pages/GamepadMonitor.jsx';
import MappingConfig from './pages/MappingConfig.jsx';
import MacroEditor from './pages/MacroEditor.jsx';
import SyncSettings from './pages/SyncSettings.jsx';
import TurboSettings from './pages/TurboSettings.jsx';
import ProfileManager from './pages/ProfileManager.jsx';
import CommunityHub from './pages/CommunityHub.jsx';

const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen">加载中...</div>;
  return isAuthenticated ? children : <Navigate to="/login" />;
};

function App() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">加载中...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {isAuthenticated && <Navbar />}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/monitor" element={<PrivateRoute><GamepadMonitor /></PrivateRoute>} />
        <Route path="/mapping" element={<PrivateRoute><MappingConfig /></PrivateRoute>} />
        <Route path="/macros" element={<PrivateRoute><MacroEditor /></PrivateRoute>} />
        <Route path="/sync" element={<PrivateRoute><SyncSettings /></PrivateRoute>} />
        <Route path="/turbo" element={<PrivateRoute><TurboSettings /></PrivateRoute>} />
        <Route path="/profiles" element={<PrivateRoute><ProfileManager /></PrivateRoute>} />
        <Route path="/community" element={<PrivateRoute><CommunityHub /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  );
}

export default App;