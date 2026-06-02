import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed left-0 right-0 top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-white/10 bg-[hsl(var(--hero-bg)/0.92)] py-2.5 backdrop-blur-xl"
          : "bg-transparent py-3.5"
      )}
    >
      <div className="landing-content-shell flex items-center justify-between gap-4 px-5 sm:px-8 md:px-12 lg:px-16">
        <Link
          to="/"
          className="font-display text-[1.05rem] font-semibold tracking-[0.08em] text-[hsl(var(--hero-foreground))] transition-colors hover:text-white"
        >
          合域
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="landingGlass"
            className="h-9 rounded-sm px-4 text-xs sm:px-5"
            asChild
          >
            <Link to="/app">进入工作台</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
