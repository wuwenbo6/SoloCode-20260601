import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Lobby from "@/pages/Lobby";
import Room from "@/pages/Room";
import Recordings from "@/pages/Recordings";
import Playback from "@/pages/Playback";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Lobby />} />
        <Route path="/room/:roomId" element={<Room />} />
        <Route path="/recordings" element={<Recordings />} />
        <Route path="/playback/:recordingId" element={<Playback />} />
      </Routes>
    </Router>
  );
}
