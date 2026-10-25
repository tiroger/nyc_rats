import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import "@fontsource/space-mono/latin-400.css";
import "@fontsource/space-mono/latin-700.css";
import App from "./App.jsx";
import { CityProvider } from "./components/CityPlay.jsx";
import "./style.css";
import "./insights.css";
import "./city-play.css";
import "./motion.css";
import "./wayfinding.css";
import "./night-shift.css";

// Apply a remembered Night shift before first paint, so it doesn't flash.
try {
  if (JSON.parse(localStorage.getItem("ratlas-night")) === true)
    document.documentElement.dataset.theme = "night";
} catch {
  /* Storage is optional. */
}

class ErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="load-screen">
        <h1>A little snag underground.</h1>
        <p>The atlas couldn’t render. Try reloading the page.</p>
        <button onClick={() => window.location.reload()}>
          Reload the atlas
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <CityProvider>
        <App />
      </CityProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
