import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

/**
 * The entry bundle and stylesheet keep fixed file names (a cached page that still points at them must never
 * 404 after a publish), so a browser or CDN that cached an old copy would keep using it. Appending a build id
 * to their URLs in the HTML makes every build a new URL, without renaming the files on the host.
 */
const buildId = (process.env.GITHUB_SHA || process.env.COMMIT_SHA || Date.now().toString(36)).slice(0, 10);
const versionEntryFiles = (): Plugin => ({
  name: "version-entry-files",
  apply: "build",
  transformIndexHtml: {
    order: "post",
    handler: (html) => html.replace(/(["'])(\/assets\/index\.(?:js|css))\1/g, `$1$2?v=${buildId}$1`),
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
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
  plugins: [react(), versionEntryFiles(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));
