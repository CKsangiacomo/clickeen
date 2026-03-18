'use client';

import { Component, type ReactNode } from 'react';

type RomaDomainErrorBoundaryProps = {
  domainLabel: string;
  resetKey: string;
  children: ReactNode;
};

type RomaDomainErrorBoundaryState = {
  error: Error | null;
};

export class RomaDomainErrorBoundary extends Component<
  RomaDomainErrorBoundaryProps,
  RomaDomainErrorBoundaryState
> {
  state: RomaDomainErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): RomaDomainErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack?: string }): void {
    console.error(
      JSON.stringify({
        event: 'roma.domain.render_failed',
        service: 'roma',
        domain: this.props.resetKey,
        domainLabel: this.props.domainLabel,
        message: error.message,
        stack: error.stack ?? null,
        componentStack: errorInfo.componentStack ?? null,
      }),
    );
  }

  componentDidUpdate(prevProps: RomaDomainErrorBoundaryProps): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const label = this.props.domainLabel || 'This page';
    return (
      <section className="rd-canvas-module">
        <p className="body-m">{label} hit a rendering error.</p>
        <p className="body-s">
          Retry the view first. If it fails again, reload the page.
        </p>
        <div className="rd-canvas-module__actions">
          <button
            className="diet-btn-txt"
            data-size="md"
            data-variant="primary"
            type="button"
            onClick={() => this.setState({ error: null })}
          >
            <span className="diet-btn-txt__label body-m">Retry view</span>
          </button>
          <button
            className="diet-btn-txt"
            data-size="md"
            data-variant="line2"
            type="button"
            onClick={() => window.location.reload()}
          >
            <span className="diet-btn-txt__label body-m">Reload page</span>
          </button>
        </div>
      </section>
    );
  }
}
