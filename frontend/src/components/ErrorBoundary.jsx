import React from 'react';

export default class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="fatal-error">
          <span className="eyebrow">Something went wrong</span>
          <h1>The workspace could not load.</h1>
          <p>Reload the page to try again. Your saved account data is not affected.</p>
          <button className="button button-primary" onClick={() => window.location.reload()}>Reload workspace</button>
        </main>
      );
    }
    return this.props.children;
  }
}
