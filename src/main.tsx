import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { initErrorMonitoring } from "./lib/error-monitoring";
import { initAnalytics } from "./lib/analytics";

initAnalytics();
initErrorMonitoring();

// No service worker. Earlier builds registered one that served the app's JavaScript from a
// cache first, so returning visitors kept seeing the previous build (or a mix of old and new
// files) after every publish. Remove any worker and cache an earlier visit left behind;
// public/sw.js is a retirement script for browsers that still hold the old registration.
if (typeof window !== "undefined" && "serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .getRegistrations?.()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .then(() => (typeof caches !== "undefined" ? caches.keys() : []))
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("runmatch-")).map((key) => caches.delete(key))))
      .catch(() => {
        /* cleanup is best-effort */
      });
  });
}

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
