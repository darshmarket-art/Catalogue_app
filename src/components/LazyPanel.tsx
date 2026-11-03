import React, { Suspense } from 'react';

/** A lazy panel that renders nothing while it loads and nothing if its chunk cannot be fetched (offline): a failed import must never unmount the app and take the tab bar with it. */
export class LazyPanel extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : <Suspense fallback={null}>{this.props.children}</Suspense>;
  }
}
