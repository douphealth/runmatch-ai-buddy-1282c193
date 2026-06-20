import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { initErrorMonitoring } from "./lib/error-monitoring";

initErrorMonitoring();

// Register the PWA service worker for offline shell + asset caching.
// Production-only to avoid HMR interference in dev.
//
// Important: this app is mounted on gearuptofit.com under /shoe-finder/.
// Registering /sw.js points at the WordPress/root site and can leave mobile
// browsers controlled by an old root-scoped worker, causing perfectly valid
// /shoe-finder/* links to render the app 404 screen from stale JS. Always scope
// the worker to /shoe-finder/ and remove any accidental root registrations.
if (
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  import.meta.env.PROD
) {
  window.addEventListener("load", () => {
    const appScope = new URL("/shoe-finder/", window.location.origin).href;

    navigator.serviceWorker.getRegistrations?.()
      .then((registrations) => Promise.all(
        registrations
          .filter((registration) => registration.scope !== appScope)
          .map((registration) => registration.unregister())
      ))
      .catch(() => {
        /* SW cleanup failure is non-fatal */
      })
      .finally(() => {
        navigator.serviceWorker.register("/shoe-finder/sw.js", { scope: "/shoe-finder/" }).catch(() => {
          /* SW registration failure is non-fatal */
        });
      });
  });
}

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
