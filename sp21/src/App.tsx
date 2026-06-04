import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import PrintPage from "@/pages/PrintPage";
import PrinterPage from "@/pages/PrinterPage";
import TemplatesPage from "@/pages/TemplatesPage";
import TemplateEditorPage from "@/pages/TemplateEditorPage";
import HistoryPage from "@/pages/HistoryPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<PrintPage />} />
          <Route path="printer" element={<PrinterPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="templates/:id/edit" element={<TemplateEditorPage />} />
          <Route path="templates/new" element={<TemplateEditorPage />} />
          <Route path="history" element={<HistoryPage />} />
        </Route>
      </Routes>
    </Router>
  );
}
