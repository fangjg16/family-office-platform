import { ALL_PROJECTS, type WorkspaceProject } from "./projects";

let apiProjects: WorkspaceProject[] = [];

export function setApiProjects(projects: WorkspaceProject[]): void {
  apiProjects = projects;
}

export function upsertApiProject(project: WorkspaceProject): void {
  const idx = apiProjects.findIndex((p) => p.id === project.id);
  if (idx >= 0) apiProjects[idx] = project;
  else apiProjects.push(project);
}

export function removeApiProject(projectId: string): void {
  apiProjects = apiProjects.filter((p) => p.id !== projectId);
}

/** 静态种子 + API 项目（同 id 时 API 覆盖） */
export function getMergedProjects(): WorkspaceProject[] {
  const byId = new Map<string, WorkspaceProject>();
  for (const p of ALL_PROJECTS) byId.set(p.id, p);
  for (const p of apiProjects) byId.set(p.id, p);
  return Array.from(byId.values());
}

export function getMergedProjectById(id: string): WorkspaceProject | undefined {
  const fromApi = apiProjects.find((p) => p.id === id);
  if (fromApi) return fromApi;
  return ALL_PROJECTS.find((p) => p.id === id);
}
