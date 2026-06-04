import { Outlet } from 'react-router-dom'
import Sidebar from '@/components/Sidebar'

export default function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-primary">
      <Sidebar />
      <main className="flex-1 lg:ml-0 overflow-auto">
        <div className="p-6 lg:p-8 pt-16 lg:pt-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
