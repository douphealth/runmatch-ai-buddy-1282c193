import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "@/components/ErrorBoundary";
import Index from "./pages/Index.tsx";
import { captureUTM } from "@/lib/utm";

// Lazy-loaded secondary routes — keep the initial bundle lean.
// The landing Index page stays eager since it's the primary entry.
const RunMatchResult = lazy(() => import("./pages/RunMatchResult.tsx"));
const CategoryLanding = lazy(() => import("./pages/CategoryLanding.tsx"));
const BrandLanding = lazy(() => import("./pages/BrandLanding.tsx"));
const ShoeComparison = lazy(() => import("./pages/ShoeComparison.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

if (typeof window !== "undefined") captureUTM();

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div
    role="status"
    aria-live="polite"
    aria-label="Loading page"
    className="min-h-screen flex items-center justify-center bg-background"
  >
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      <span className="text-sm text-muted-foreground">Loading…</span>
    </div>
  </div>
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter basename={(() => {
          if (typeof document === "undefined") return "/";
          const href = document.querySelector("base")?.getAttribute("href") || "/";
          try {
            const path = new URL(href, window.location.origin).pathname;
            return path !== "/" && path.endsWith("/") ? path.slice(0, -1) : path;
          } catch {
            return "/";
          }
        })()}>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/app/runmatch/:slug" element={<RunMatchResult />} />
              <Route path="/best-running-shoes/brand/:brand" element={<BrandLanding />} />
              <Route path="/best-running-shoes/:slug" element={<CategoryLanding />} />
              <Route path="/compare/:slug" element={<ShoeComparison />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
