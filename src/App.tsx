import { lazy, Suspense, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "@/components/ErrorBoundary";
import Index from "./pages/Index.tsx";
import { captureUTM } from "@/lib/utm";
import { track } from "@/lib/analytics";

// Lazy-loaded secondary routes — keep the initial bundle lean.
// The landing Index page stays eager since it's the primary entry.
const RunMatchResult = lazy(() => import("./pages/RunMatchResult.tsx"));
const CategoryLanding = lazy(() => import("./pages/CategoryLanding.tsx"));
const BrandLanding = lazy(() => import("./pages/BrandLanding.tsx"));
const ShoeComparison = lazy(() => import("./pages/ShoeComparison.tsx"));
const ShoeDetail = lazy(() => import("./pages/ShoeDetail.tsx"));
const Methodology = lazy(() => import("./pages/Methodology.tsx"));
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

/**
 * Single-page apps change the URL without a page load, so GA4 never sees the
 * navigation on its own. Send one page_view per route change (the personalised
 * ?d= payload is stripped inside track.pageView / safePageLocation).
 */
const RouteTracker = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    // Let the page set its <title> first, then report.
    const id = window.setTimeout(() => track.pageView(pathname), 60);
    return () => window.clearTimeout(id);
  }, [pathname]);
  return null;
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter basename={typeof window !== "undefined" && window.location.pathname.startsWith("/shoe-finder") ? "/shoe-finder" : "/"}>
          <RouteTracker />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              {/* Canonical result URL (pre-rendered for ~25 profiles). */}
              <Route path="/results/:slug" element={<RunMatchResult />} />
              {/* Legacy alias kept so saved matches and old shared links keep working. */}
              <Route path="/app/runmatch/:slug" element={<RunMatchResult />} />
              <Route path="/methodology" element={<Methodology />} />
              <Route path="/best-running-shoes/brand/:brand" element={<BrandLanding />} />
              <Route path="/best-running-shoes/:slug" element={<CategoryLanding />} />
              <Route path="/compare/:slug" element={<ShoeComparison />} />
              <Route path="/shoes/:id" element={<ShoeDetail />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
