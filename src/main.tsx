import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/source-sans-3/latin.css";
import "@fontsource/source-sans-3/latin-ext.css";
import "@fontsource/exo-2/latin-600.css";
import "@fontsource/exo-2/latin-700.css";
import "@fontsource/exo-2/latin-800.css";
import "@fontsource/exo-2/latin-800-italic.css";
import "@fontsource/exo-2/latin-ext-600.css";
import "@fontsource/exo-2/latin-ext-700.css";
import "@fontsource/exo-2/latin-ext-800.css";
import "@fontsource/exo-2/latin-ext-800-italic.css";
import "@fontsource/barlow-condensed/latin-800.css";
import App from "./App";
import { ErrorBoundary } from "./ErrorBoundary";
import "./styles.css";
import "./tabletop.css";
import "./action-ui.css";
import "./premium-tabletop.css";
import "./champions-theme.css";
import "./comic-effects.css";
import "./hero-table.css";
import "./defense-token.css";
import "./compact-table.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
// Offline card art and installability. Development keeps the plain network
// path so Vite's module graph is never served from a stale cache.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
