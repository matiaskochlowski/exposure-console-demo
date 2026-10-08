import { Component, type ReactNode } from 'react';
import { Button } from '../ui/index.ts';

interface State {
  error?: Error;
}

/** Catches render/load failures (e.g. the dataset request) and offers a retry. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = {};

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="m-6 rounded-lg border border-line bg-surface p-6">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-1 text-sm text-muted">{this.state.error.message}</p>
        <Button className="mt-4" onClick={() => this.setState({ error: undefined })}>
          Try again
        </Button>
      </div>
    );
  }
}
