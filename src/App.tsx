import { BrowserRouter, Route, Routes } from "react-router-dom";
import Index from "@/pages/Index";
import WorkspaceRoutes from "@/pages/workspace/WorkspaceRoutes";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/app/*" element={<WorkspaceRoutes />} />
      </Routes>
    </BrowserRouter>
  );
}
