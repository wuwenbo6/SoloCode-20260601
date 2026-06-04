import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ConsolePage from "@/pages/ConsolePage";
import FPVPage from "@/pages/FPVPage";
import HeadTrackPage from "@/pages/HeadTrackPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ConsolePage />} />
        <Route path="/fpv" element={<FPVPage />} />
        <Route path="/headtrack" element={<HeadTrackPage />} />
      </Routes>
    </Router>
  );
}
