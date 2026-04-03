import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class GlobalErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[GlobalErrorBoundary]', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <h1 className="text-xl font-semibold text-foreground">
            Something went wrong
          </h1>
          <p className="text-sm text-muted-foreground">
            {this.state.error.message || 'An unexpected error occurred.'}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={this.handleRetry}>
              Try again
            </Button>
            <Button variant="default" onClick={this.handleReload}>
              <RefreshCw className="mr-1.5 h-4 w-4" />
              Reload page
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
