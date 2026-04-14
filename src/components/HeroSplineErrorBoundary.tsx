import { Component, type ErrorInfo, type ReactNode } from "react";
import { HeroStaticBackdrop } from "@/components/HeroStaticBackdrop";

type Props = { children: ReactNode };

type State = { hasError: boolean };

/**
 * Spline 在部分显卡驱动下仍可能抛错，兜底避免白屏。
 */
export class HeroSplineErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.warn("[Hero] Spline / WebGL 降级:", error.message, info.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      return <HeroStaticBackdrop />;
    }
    return this.props.children;
  }
}
