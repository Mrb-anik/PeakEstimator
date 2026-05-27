/**
 * ErrorBoundary.tsx
 * ─────────────────────────────────────────────────────────────────
 * React error boundary — catches unhandled render errors and shows
 * a graceful fallback UI instead of a white screen crash.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomeComponent />
 *   </ErrorBoundary>
 *
 *   <ErrorBoundary level="route" label="Admin Portal">
 *     <AdminPortal />
 *   </ErrorBoundary>
 * ─────────────────────────────────────────────────────────────────
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Scope label shown in the error UI and logged to console */
  label?: string;
  /** 'app' = full-screen fallback, 'route' = card fallback */
  level?: 'app' | 'route' | 'component';
  /** Custom fallback UI */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const label = this.props.label ?? 'Unknown';
    console.error(`[ErrorBoundary:${label}] Caught error:`, error, info);
    this.setState({ errorInfo: info });

    // TODO Phase 3: forward to Sentry
    // Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    const { level = 'route', label = 'This section' } = this.props;
    const errorMessage = this.state.error?.message ?? 'An unexpected error occurred.';

    if (level === 'app') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-navy-950 p-8">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white mb-2">Something went wrong</h1>
              <p className="text-slate-400 text-sm">
                {label} crashed unexpectedly. Your data is safe.
              </p>
            </div>
            {import.meta.env.DEV && (
              <pre className="text-left text-xs text-red-300 bg-red-950/40 border border-red-900/40 rounded-lg p-4 overflow-auto max-h-48">
                {errorMessage}
              </pre>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
              <a
                href="/dashboard"
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Home className="w-4 h-4" />
                Go to Dashboard
              </a>
            </div>
          </div>
        </div>
      );
    }

    // route / component level
    return (
      <div className="flex items-center justify-center p-8">
        <div className="max-w-sm w-full bg-slate-800/60 border border-red-900/30 rounded-xl p-6 text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
          </div>
          <div>
            <p className="text-white font-medium text-sm">{label} failed to load</p>
            {import.meta.env.DEV && (
              <p className="text-red-300 text-xs mt-1 font-mono">{errorMessage}</p>
            )}
          </div>
          <button
            onClick={this.handleReset}
            className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 mx-auto transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
