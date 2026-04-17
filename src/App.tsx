import { BrowserRouter, Route, Routes } from "react-router-dom";
import Index from "@/pages/Index";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import WorkspaceRoutes from "@/pages/workspace/WorkspaceRoutes";

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/app/*" element={<WorkspaceRoutes />} />
      </Routes>
    </BrowserRouter>
  );
}
