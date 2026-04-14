import { BrowserRouter, Route, Routes } from "react-router-dom";
import Index from "@/pages/Index";
import WorkspaceRoutes from "@/pages/workspace/WorkspaceRoutes";

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/app/*" element={<WorkspaceRoutes />} />
      </Routes>
    </BrowserRouter>
  );
}
