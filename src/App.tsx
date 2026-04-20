import { useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import Index from "@/pages/Index";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import TermsOfService from "@/pages/TermsOfService";
import WorkspaceRoutes from "@/pages/workspace/WorkspaceRoutes";

/** 客户端路由切换时重置窗口滚动，避免从长页进入法律页仍停留在中间位置 */
function ScrollToTopOnRouteChange() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ScrollToTopOnRouteChange />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/app/*" element={<WorkspaceRoutes />} />
      </Routes>
    </BrowserRouter>
  );
}
