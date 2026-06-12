import { useEffect } from "react";
import { ENABLE_LIVE_CHAT, fetchMyProjectRoles } from "@/lib/project-api";
import { clearMyProjectRoles, setMyProjectRoles } from "@/workspace/project-role-cache";

/** 登录后从 API 同步当前用户在各项目上的有效角色 */
export function useMyProjectRoles(userId: string | null): void {
  useEffect(() => {
    if (!userId) {
      clearMyProjectRoles();
      return;
    }
    if (!ENABLE_LIVE_CHAT) return;
    let cancelled = false;
    void fetchMyProjectRoles(userId)
      .then((roles) => {
        if (!cancelled) setMyProjectRoles(roles);
      })
      .catch(() => {
        if (!cancelled) clearMyProjectRoles();
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);
}
