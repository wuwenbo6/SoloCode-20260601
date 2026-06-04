import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import Notes from '@/pages/Notes'
import NoteEditor from '@/pages/NoteEditor'
import ShareView from '@/pages/ShareView'
import Unlock from '@/pages/Unlock'
import TwoFactorSetup from '@/pages/TwoFactorSetup'
import TwoFactorVerify from '@/pages/TwoFactorVerify'

function ProtectedRoute() {
  const token = useAuthStore((s) => s.token)
  const cryptoKey = useAuthStore((s) => s.cryptoKey)
  if (!token) return <Navigate to="/login" replace />
  if (!cryptoKey) return <Navigate to="/unlock" replace />
  return <Outlet />
}

function PublicRoute() {
  const token = useAuthStore((s) => s.token)
  const cryptoKey = useAuthStore((s) => s.cryptoKey)
  if (token && cryptoKey) return <Navigate to="/notes" replace />
  return <Outlet />
}

function UnlockRoute() {
  const token = useAuthStore((s) => s.token)
  const cryptoKey = useAuthStore((s) => s.cryptoKey)
  if (!token) return <Navigate to="/login" replace />
  if (cryptoKey) return <Navigate to="/notes" replace />
  return <Outlet />
}

export default function App() {
  const initFromStorage = useAuthStore((s) => s.initFromStorage)

  useEffect(() => {
    initFromStorage()
  }, [initFromStorage])

  return (
    <Router>
      <Routes>
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/two-factor-verify" element={<TwoFactorVerify />} />
        </Route>
        <Route element={<UnlockRoute />}>
          <Route path="/unlock" element={<Unlock />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route path="/notes" element={<Notes />} />
          <Route path="/notes/:id" element={<NoteEditor />} />
          <Route path="/two-factor-setup" element={<TwoFactorSetup />} />
        </Route>
        <Route path="/share/:shareId" element={<ShareView />} />
        <Route path="/" element={<Navigate to="/notes" replace />} />
        <Route path="*" element={<Navigate to="/notes" replace />} />
      </Routes>
    </Router>
  )
}
