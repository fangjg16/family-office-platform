import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { WorkspaceErrorBoundary } from "@/components/workspace/WorkspaceErrorBoundary";
import { fetchProjectsFromApi, ENABLE_LIVE_CHAT } from "@/lib/project-api";
import { resolveChatEntryPathAsync } from "@/workspace/chat-entry";
import { setApiProjects } from "@/workspace/project-registry";
import { loadSessionUserId } from "@/workspace/session";
import AdminPortal from "@/pages/workspace/AdminPortal";
import ConversationCenter from "@/pages/workspace/ConversationCenter";
import Login from "@/pages/workspace/Login";
import ProjectOverview from "@/pages/workspace/ProjectOverview";
import RequireAuth from "@/pages/workspace/RequireAuth";

function WorkspaceChatRedirect() {
  const navigate = useNavigate();
  const userId = loadSessionUserId();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (ENABLE_LIVE_CHAT) {
        try {
          const rows = await fetchProjectsFromApi(userId);
          if (!cancelled) setApiProjects(rows);
        } catch {
          /* 无 API 时列表为空 */
        }
      }
      if (!cancelled) setReady(true);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void resolveChatEntryPathAsync(userId).then((path) => {
      if (!cancelled) navigate(path, { replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [ready, userId, navigate]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      正在进入对话中心…
    </div>
  );
}

export default function WorkspaceRoutes() {
  return (
    <div className="workspace-app min-h-screen bg-gradient-to-b from-background to-sky-50/35 text-foreground antialiased">
      <Routes>
        <Route path="login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route index element={<Navigate to="/app/projects" replace />} />
          <Route
            path="projects"
            element={
              <WorkspaceErrorBoundary>
                <ProjectOverview />
              </WorkspaceErrorBoundary>
            }
          />
          <Route path="admin" element={<AdminPortal />} />
          <Route path="chat" element={<WorkspaceChatRedirect />} />
          <Route
            path="chat/:projectId/:conversationId"
            element={
              <WorkspaceErrorBoundary>
                <ConversationCenter />
              </WorkspaceErrorBoundary>
            }
          />
          <Route
            path="chat/:projectId"
            element={
              <WorkspaceErrorBoundary>
                <ConversationCenter />
              </WorkspaceErrorBoundary>
            }
          />
        </Route>
      </Routes>
    </div>
  );
}
