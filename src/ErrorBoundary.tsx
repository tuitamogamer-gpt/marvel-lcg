import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { SAVE_KEY } from "./game/engine";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Keeps a rendering failure from turning into a blank page. The player can
 * retry the same state, or clear the saved mission and start again. Table
 * preferences and account sessions are left untouched.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Marvel Champions crashed while rendering.", error, info);
  }
  reload = () => {
    location.reload();
  };
  clearSave = () => {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      // Storage may be blocked; reloading is still the best recovery.
    }
    location.reload();
  };
  render() {
    if (!this.state.error) return this.props.children;
    const message = this.state.error.message || String(this.state.error);
    return (
      <main className="crash-screen" role="alert" aria-live="assertive">
        <div className="crash-panel">
          <span className="crash-eyebrow">SOMETHING WENT WRONG</span>
          <h1>The table could not be drawn.</h1>
          <p>
            The game hit an error while showing this screen. Your saved mission
            is still on this device. Reloading usually fixes a one-off problem;
            if it keeps happening, clear the saved mission and start a new one.
          </p>
          <pre className="crash-detail">{message}</pre>
          <div className="crash-actions">
            <button className="primary-button" onClick={this.reload}>
              Reload the game
            </button>
            <button className="secondary-button" onClick={this.clearSave}>
              Clear saved mission and reload
            </button>
          </div>
          <p className="crash-note">
            Unofficial fan project. If this keeps happening, report the message
            above together with the hero, villain and round you were playing.
          </p>
        </div>
      </main>
    );
  }
}
