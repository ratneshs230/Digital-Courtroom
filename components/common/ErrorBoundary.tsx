/**
 * Error Boundary Component for NyayaSutra
 * Catches rendering errors and displays a fallback UI
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RefreshCw, Home, Bug } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to console
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Update state with error info
    this.setState({ errorInfo });

    // Call optional error handler
    this.props.onError?.(error, errorInfo);

    // You could also log to an error reporting service here
    // logErrorToService(error, errorInfo);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  handleGoHome = (): void => {
    // Clear error state and navigate to home
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
    // If using React Router, you'd use navigate here
    window.location.href = '/';
  };

  handleReportIssue = (): void => {
    const { error, errorInfo } = this.state;
    const errorDetails = encodeURIComponent(
      `Error: ${error?.message}\n\nStack: ${error?.stack}\n\nComponent Stack: ${errorInfo?.componentStack}`
    );
    window.open(
      `https://github.com/anthropics/claude-code/issues/new?title=NyayaSutra%20Error&body=${errorDetails}`,
      '_blank'
    );
  };

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback, showDetails = false, componentName } = this.props;

    if (hasError) {
      // Custom fallback provided
      if (fallback) {
        return fallback;
      }

      // Default error UI
      return (
        <div className="min-h-[200px] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-red-100 overflow-hidden">
            {/* Header */}
            <div className="bg-red-50 px-6 py-4 border-b border-red-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-full">
                  <AlertOctagon className="text-red-600" size={24} />
                </div>
                <div>
                  <h2 className="font-semibold text-red-900">Something went wrong</h2>
                  {componentName && (
                    <p className="text-sm text-red-600">Error in: {componentName}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                An unexpected error occurred. You can try reloading the page or going back to the dashboard.
              </p>

              {/* Error details (if enabled) */}
              {showDetails && error && (
                <div className="bg-gray-50 rounded-lg p-3 text-xs">
                  <p className="font-medium text-gray-700 mb-1">Error message:</p>
                  <p className="text-red-600 font-mono break-all">{error.message}</p>

                  {errorInfo?.componentStack && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                        Component stack
                      </summary>
                      <pre className="mt-2 text-gray-500 overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto">
                        {errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={this.handleReload}
                  className="flex items-center gap-2 px-4 py-2 bg-saffron text-white rounded-lg hover:bg-saffron/90 transition-colors text-sm font-medium"
                >
                  <RefreshCw size={16} />
                  Reload Page
                </button>

                <button
                  onClick={this.handleReset}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  Try Again
                </button>

                <button
                  onClick={this.handleGoHome}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  <Home size={16} />
                  Dashboard
                </button>
              </div>

              {/* Report issue link */}
              <div className="pt-2 border-t border-gray-100">
                <button
                  onClick={this.handleReportIssue}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  <Bug size={12} />
                  Report this issue
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}

// Functional wrapper for easier use with hooks
export const withErrorBoundary = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
): React.FC<P> => {
  const ComponentWithErrorBoundary: React.FC<P> = (props) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${
    WrappedComponent.displayName || WrappedComponent.name || 'Component'
  })`;

  return ComponentWithErrorBoundary;
};

// Simple inline error boundary component
export const InlineErrorBoundary: React.FC<{
  children: ReactNode;
  fallbackMessage?: string;
}> = ({ children, fallbackMessage = 'Something went wrong' }) => {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          <AlertOctagon size={16} />
          <span>{fallbackMessage}</span>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
};

export default ErrorBoundary;
