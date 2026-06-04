import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import Authenticate from "@/pages/Authenticate"
import AdminLayout from "@/pages/admin/AdminLayout"
import Keys from "@/pages/admin/Keys"
import Visitors from "@/pages/admin/Visitors"
import DoorManage from "@/pages/admin/DoorManage"
import Schedules from "@/pages/admin/Schedules"
import Logs from "@/pages/admin/Logs"
import Remote from "@/pages/admin/Remote"
import Events from "@/pages/admin/Events"

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Authenticate />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="keys" element={<Keys />} />
          <Route path="visitors" element={<Visitors />} />
          <Route path="doors" element={<DoorManage />} />
          <Route path="schedules" element={<Schedules />} />
          <Route path="logs" element={<Logs />} />
          <Route path="remote" element={<Remote />} />
          <Route path="events" element={<Events />} />
        </Route>
      </Routes>
    </Router>
  )
}
