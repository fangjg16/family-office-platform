import { useCallback, useEffect, useState } from "react";
import { Loader2, Shield, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ENABLE_LIVE_CHAT,
  fetchProjectPermissions,
  updateProjectPermissions,
  type ProjectPermissionMember,
} from "@/lib/project-api";
import type { WorkspaceProject } from "@/workspace/projects";
import { patchMyProjectRole } from "@/workspace/project-role-cache";
import { roleLabelForProject } from "@/workspace/workspace-users";
import type { WorkspaceRole } from "@/workspace/types";

const ASSIGNABLE: WorkspaceRole[] = ["guest", "low", "mid", "core"];

type ProjectPermissionsSectionProps = {
  project: WorkspaceProject;
  userId: string;
};

function prettyName(displayName: string): string {
  return displayName.replace(/([a-z])([A-Z])/g, "$1 $2").trim();
}

export function ProjectPermissionsSection({
  project,
  userId,
}: ProjectPermissionsSectionProps) {
  const [members, setMembers] = useState<ProjectPermissionMember[] | null>(null);
  const [draft, setDraft] = useState<Record<string, WorkspaceRole>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedHint, setSavedHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ENABLE_LIVE_CHAT) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProjectPermissions(project.id, userId);
      setMembers(data.members);
      const next: Record<string, WorkspaceRole> = {};
      for (const m of data.members) {
        if (m.isPlatformAdmin) continue;
        next[m.userId] = m.overrideRole ?? m.defaultRole;
        if (m.isCreator) {
          next[m.userId] = "core";
        }
      }
      setDraft(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMembers(null);
    } finally {
      setLoading(false);
    }
  }, [project.id, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSave = async () => {
    if (!members) return;
    setSaving(true);
    setError(null);
    setSavedHint(null);
    try {
      const updates = members
        .filter((m) => !m.isPlatformAdmin)
        .map((m) => ({
          userId: m.userId,
          role: m.isCreator ? "core" : (draft[m.userId] ?? m.defaultRole),
        }));
      const next = await updateProjectPermissions(project.id, userId, updates);
      setMembers(next);
      const self = next.find((m) => m.userId === userId);
      if (self) {
        patchMyProjectRole(project.id, self.effectiveRole);
      }
      setSavedHint("权限已保存");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const dirty =
    members?.some((m) => {
      if (m.isPlatformAdmin || m.isCreator) return false;
      const picked = draft[m.userId] ?? m.defaultRole;
      const current = m.overrideRole ?? m.defaultRole;
      return picked !== current;
    }) ?? false;

  return (
    <section
      className="mt-5 rounded-2xl border border-[hsl(var(--wine-deep)/0.18)] bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.04)]"
      aria-labelledby="project-permissions-heading"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--wine-deep)/0.08)] text-[hsl(var(--wine-deep))]">
            <Shield className="h-4 w-4" strokeWidth={2} aria-hidden />
          </div>
          <div>
            <h3
              id="project-permissions-heading"
              className="text-xs font-bold uppercase tracking-wide text-foreground"
            >
              权限管理
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              为各成员设置本项目内的角色。创建人固定为 Core 核心级；平台 Admin 不可在此修改。
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={!dirty || saving || loading}
          onClick={() => void onSave()}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[hsl(var(--wine-deep)/0.32)] bg-[hsl(var(--wine-deep)/0.06)] px-3 py-1.5 text-[11px] font-semibold text-[hsl(var(--wine-deep))] transition-colors hover:bg-[hsl(var(--wine-deep)/0.1)]",
            (!dirty || saving || loading) && "pointer-events-none opacity-50",
          )}
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : null}
          保存
        </button>
      </div>

      {loading ? (
        <p className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          加载成员权限…
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-lg border border-rose-200/80 bg-rose-50/80 px-3 py-2 text-[11px] text-rose-700">
          {error}
        </p>
      ) : null}

      {savedHint ? (
        <p className="mt-3 text-[11px] font-medium text-emerald-700">{savedHint}</p>
      ) : null}

      {members && !loading ? (
        <ul className="mt-4 space-y-2">
          {members.map((m) => {
            const locked = m.isPlatformAdmin || m.isCreator;
            const value = m.isCreator
              ? "core"
              : m.isPlatformAdmin
                ? "admin"
                : (draft[m.userId] ?? m.defaultRole);
            return (
              <li
                key={m.userId}
                className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {prettyName(m.displayName)}
                      {m.isCreator ? (
                        <span className="ml-1.5 text-[10px] font-semibold text-[hsl(var(--wine-deep))]">
                          创建人
                        </span>
                      ) : null}
                    </p>
                  </div>
                </div>
                <select
                  value={value}
                  disabled={locked || saving}
                  onChange={(e) => {
                    const role = e.target.value as WorkspaceRole;
                    setDraft((prev) => ({ ...prev, [m.userId]: role }));
                    setSavedHint(null);
                  }}
                  className={cn(
                    "rounded-lg border border-border/80 bg-white px-2.5 py-1.5 text-[11px] font-medium text-foreground",
                    locked && "cursor-not-allowed opacity-70",
                  )}
                  aria-label={`${m.displayName} 的项目角色`}
                >
                  {m.isPlatformAdmin ? (
                    <option value="admin">Admin</option>
                  ) : m.isCreator ? (
                    <option value="core">Core 核心级（创建人）</option>
                  ) : (
                    ASSIGNABLE.map((r) => (
                      <option key={r} value={r}>
                        {roleLabelForProject(r)}
                      </option>
                    ))
                  )}
                </select>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
