import { Navigate, Route, Routes } from "react-router-dom";
import { loadLastProjectId } from "@/workspace/session";
import AdminPortal from "@/pages/workspace/AdminPortal";
import ConversationCenter from "@/pages/workspace/ConversationCenter";
import Login from "@/pages/workspace/Login";
import ProjectOverview from "@/pages/workspace/ProjectOverview";
import RequireAuth from "@/pages/workspace/RequireAuth";

function WorkspaceChatRedirect() {
  return (
    <Navigate to={`/app/chat/${loadLastProjectId() ?? "shrimp"}`} replace />
  );
}

export default function WorkspaceRoutes() {
  return (
    <div className="workspace-app min-h-screen bg-gradient-to-b from-background to-sky-50/35 text-foreground antialiased">
      <Routes>
        <Route path="login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route index element={<Navigate to="/app/projects" replace />} />
          <Route path="projects" element={<ProjectOverview />} />
          <Route path="admin" element={<AdminPortal />} />
          <Route path="chat" element={<WorkspaceChatRedirect />} />
          <Route path="chat/:projectId" element={<ConversationCenter />} />
        </Route>
      </Routes>
    </div>
  );
}
