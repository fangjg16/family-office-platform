import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class WorkspaceErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[workspace]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
          <h1 className="text-lg font-semibold text-foreground">页面渲染出错</h1>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            {this.state.error.message || "未知错误"}
          </p>
          <button
            type="button"
            onClick={() => window.location.assign(`${import.meta.env.BASE_URL}app/projects`)}
            className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            返回项目总览
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
