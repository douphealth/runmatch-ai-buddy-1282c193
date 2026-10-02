import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { CATEGORIES } from "@/lib/categories";
import { clearPrerenderedHead } from "@/lib/head-handoff";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
    // The SPA fallback serves the landing page's HTML, including its indexable
    // head tags. Drop them so this page is never mistaken for the landing page.
    clearPrerenderedHead();
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-muted px-4 py-16">
      <Helmet>
        <title>Page Not Found | GearUpToFit Shoe Finder</title>
        <meta name="robots" content="noindex,follow" />
      </Helmet>
      <main id="main-content" className="mx-auto max-w-xl rounded-2xl bg-background p-8 text-center shadow-sm">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-6 text-xl text-muted-foreground">This shoe-finder page was not found.</p>
        <div className="grid gap-3 text-primary underline">
          <Link to="/">Take the running shoe finder quiz</Link>
          <Link to="/methodology">How RunMatch scores shoes</Link>
          {CATEGORIES.slice(0, 3).map((c) => (
            <Link key={c.slug} to={`/best-running-shoes/${c.slug}`}>{c.h1}</Link>
          ))}
          <a href="https://gearuptofit.com/">Visit GearUpToFit home</a>
          <a href="https://gearuptofit.com/review/best-running-shoes/">Read the best running shoes guide</a>
        </div>
      </main>
    </div>
  );
};

export default NotFound;
