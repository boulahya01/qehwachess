import { Component, ReactNode } from 'react';
import { ErrorState } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';

export class PageErrorBoundary extends Component<{ children: ReactNode; message: string; reloadLabel: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? (
      <div className="pt-24 pb-12 text-center" role="alert">
        <ErrorState message={this.props.message} />
        <Button onClick={() => window.location.reload()}>{this.props.reloadLabel}</Button>
      </div>
    ) : this.props.children;
  }
}
