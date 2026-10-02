import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// The entry bundle and stylesheet keep fixed file names, and their URLs must stay exactly "/assets/index.js" and
// "/assets/index.css": lazy chunks import the entry bundle by that URL, and the browser keys modules by full URL, so a
// "?v=" on the <script> tag loads the entry twice (two copies of React: "Invalid hook call" on every lazy route).
// Freshness after a publish is handled by the Worker (cloudflare/worker.js: revalidation headers and a per-minute
// origin cache key), and scripts/check-dist.mjs fails the build if the entry URLs ever get a query string.

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // The app is served at "/" on the Lovable host and at "/shoe-finder/" through the Worker. Preload URLs that
  // the build writes into the JavaScript (lazy chunks and their stylesheets) are therefore relative to the file that
  // asks for them; a root-absolute "/assets/..." would hit the WordPress site and 404 (this broke the PDF download).
  experimental: {
    renderBuiltUrl(_filename, { hostType }) {
      if (hostType === "js") return { relative: true };
      return undefined;
    },
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: "assets/index.js",
        chunkFileNames: "assets/chunks/[name]-[hash].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === "style.css" || assetInfo.name === "index.css") {
            return "assets/index.css";
          }

          return "assets/[name]-[hash][extname]";
        },
      },
    },
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));
