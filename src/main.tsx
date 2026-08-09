import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";
import { ComposeWindowRoot } from "@/components/mail/ComposeWindowRoot";
import "@/index.css";

// Detached "New message" windows load this same index.html with
// `?window=compose` (see src/lib/composeWindow.ts) — everything else is
// the regular main-window app.
const isComposeWindow = new URLSearchParams(window.location.search).get("window") === "compose";

createRoot(document.getElementById("root")!).render(
  <StrictMode>{isComposeWindow ? <ComposeWindowRoot /> : <App />}</StrictMode>,
);
