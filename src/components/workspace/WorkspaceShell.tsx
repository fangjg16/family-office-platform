import type { ReactNode } from "react";
import { WorkspaceTopNav } from "@/components/workspace/WorkspaceTopNav";
import { cn } from "@/lib/utils";

export function WorkspaceShell({
  children,
  contentClassName,
  shellClassName,
}: {
  children: ReactNode;
  contentClassName?: string;
  shellClassName?: string;
}) {
  return (
    <div className={cn("workspace-paper-bg flex min-h-screen flex-col", shellClassName)}>
      <WorkspaceTopNav />
      <div
        className={cn(
          "workspace-paper-content flex min-h-0 flex-1 flex-col px-3 pb-10 pt-4 sm:px-5 md:px-8",
          contentClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}
