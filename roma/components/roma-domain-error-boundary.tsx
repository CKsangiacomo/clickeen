'use client';

import { Component, type ReactNode } from 'react';
import ROMA_DIALOGS_UI_COPY from '../l10n/dialogs/en.json';

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

    return (
      <section className="rd-canvas-module" role="alert">
        <div className="rd-canvas-module__actions">
          <button
            className="diet-button"
            data-size="medium"
            data-type="primary"
            type="button"
            onClick={() => this.setState({ error: null })}
          >
            <span className="diet-button__label">{ROMA_DIALOGS_UI_COPY.retry}</span>
          </button>
        </div>
      </section>
    );
  }
}
