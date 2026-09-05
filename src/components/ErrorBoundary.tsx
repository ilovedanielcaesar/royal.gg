import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Catches render-time crashes so a single broken component shows a message
 * instead of unmounting the whole app and leaving a white screen.
 *
 * This is a class component on purpose — React has no hook equivalent of
 * componentDidCatch, so error boundaries can only be written this way.
 *
 * The fallback deliberately uses plain markup rather than <Card>/<Button>: if
 * the crash came from a shared component, rendering it again here would throw
 * a second time and defeat the whole point.
 */

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Render error:", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="mx-auto mt-8 max-w-xl">
        <div className="relative overflow-hidden rounded-xl bg-card-50 p-6 text-ink-900 ring-1 ring-card-100">
          <div className="absolute inset-x-0 top-0 h-1 bg-crimson-600" />
          <h2 className="font-display text-2xl text-ink-900">
            Something went wrong
          </h2>
          <p className="mt-2 text-sm text-ink-700">
            The page hit an unexpected error and stopped. Reloading usually
            clears it.
          </p>
          <p className="mt-3 rounded-md bg-crimson-500/10 px-3 py-2 font-mono text-xs text-crimson-700">
            {error.message || String(error)}
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center rounded-md bg-card-50 px-4 py-2 text-sm font-medium text-ink-900 shadow-[0_2px_0_0_rgba(0,0,0,0.25)] ring-1 ring-card-200 transition hover:bg-card-100 active:translate-y-px"
            >
              Reload
            </button>
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-ink-500 transition hover:text-ink-900"
            >
              Back to dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }
}
