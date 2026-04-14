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
    <div
      className={cn(
        "flex min-h-screen flex-col bg-gradient-to-b from-background via-sky-50/[0.35] to-background",
        shellClassName
      )}
    >
      <WorkspaceTopNav />
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col px-3 pb-8 pt-2 sm:px-5 md:px-8",
          contentClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}
