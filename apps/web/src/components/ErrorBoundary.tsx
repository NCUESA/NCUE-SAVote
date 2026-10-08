import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './m3/Button';
import { Card } from './m3/Card';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex justify-center items-center min-h-screen p-4 bg-[var(--color-background)]">
          <Card className="max-w-md w-full p-8 text-center">
            <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-2xl bg-[var(--color-error-container)] mb-5">
                <AlertCircle className="h-7 w-7 text-[var(--color-on-error-container)]" />
            </div>
            
            <h2 className="type-headline-small mb-2 text-[var(--color-on-surface)]">
              Something went wrong
            </h2>
            <p className="text-[var(--color-on-surface-variant)] mb-6">
              An unexpected error occurred. Please try reloading the page.
            </p>
            
            {this.state.error && (
              <pre className="text-left bg-[var(--color-surface-container)] p-4 rounded-xl text-xs overflow-auto mb-6 max-h-48 font-mono text-[var(--color-on-surface-variant)]">
                {this.state.error.message}
              </pre>
            )}
            
            <Button onClick={this.handleReset} className="w-full" icon={<RefreshCw className="w-4 h-4" />}>
              Reload Page
            </Button>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
