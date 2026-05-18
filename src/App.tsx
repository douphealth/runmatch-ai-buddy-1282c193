import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "@/components/ErrorBoundary";
import Index from "./pages/Index.tsx";
import RunMatchResult from "./pages/RunMatchResult.tsx";
import CategoryLanding from "./pages/CategoryLanding.tsx";
import ShoeComparison from "./pages/ShoeComparison.tsx";
import NotFound from "./pages/NotFound.tsx";
import { captureUTM } from "@/lib/utm";

if (typeof window !== "undefined") captureUTM();

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter basename={(() => {
          if (typeof document === "undefined") return "/";
          const href = document.querySelector("base")?.getAttribute("href") || "/";
          // Strip protocol/host if present, drop trailing slash (except root)
          try {
            const path = new URL(href, window.location.origin).pathname;
            return path !== "/" && path.endsWith("/") ? path.slice(0, -1) : path;
          } catch {
            return "/";
          }
        })()}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/app/runmatch/:slug" element={<RunMatchResult />} />
            <Route path="/best-running-shoes/:slug" element={<CategoryLanding />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
