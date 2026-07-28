import { Component } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';

import { Button } from '@components/ui/Button/Button';
import { env } from '@config/env';

import styles from './ErrorBoundary.module.css';

/**
 * Catches render-time errors in its subtree and shows a recoverable fallback
 * instead of unmounting the whole application.
 *
 * One instance wraps the router (last resort) and one wraps the routed outlet, so
 * a broken page can be dismissed without losing the shell.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.handleReset = this.handleReset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    // Replace with the project's telemetry sink when one exists.
    console.error('[ErrorBoundary]', error, errorInfo?.componentStack);
  }

  componentDidUpdate(previousProps) {
    // A new resetKey (e.g. a route change) clears a previously caught error.
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  handleReset() {
    this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    const { children, fallback, title, description } = this.props;

    if (!error) return children;

    if (fallback) {
      return typeof fallback === 'function'
        ? fallback({ error, reset: this.handleReset })
        : fallback;
    }

    return (
      <div className={styles.boundary} role="alert">
        <span className={styles.iconWrapper} aria-hidden="true">
          <AlertOctagon className={styles.icon} />
        </span>

        <h2 className={styles.title}>{title ?? 'This section could not be displayed'}</h2>
        <p className={styles.description}>
          {description ??
            'An unexpected error interrupted rendering. You can retry, or navigate elsewhere and come back.'}
        </p>

        {env.isDevelopment ? (
          <pre className={styles.details}>{String(error?.stack ?? error)}</pre>
        ) : null}

        <Button variant="outline" size="sm" onClick={this.handleReset} leadingIcon={RotateCcw}>
          Try again
        </Button>
      </div>
    );
  }
}

export default ErrorBoundary;
