import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Beacons from "@/pages/Beacons";
import Paths from "@/pages/Paths";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/beacons" element={<Beacons />} />
        <Route path="/paths" element={<Paths />} />
      </Routes>
    </Router>
  );
}
