import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed left-0 right-0 top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-white/[0.06] bg-[hsl(240_43%_5%/0.88)] py-2.5 backdrop-blur-xl"
          : "bg-transparent py-3"
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 md:gap-6 md:px-10 lg:px-12">
        <Link
          to="/"
          className="font-display text-[1.05rem] font-semibold uppercase tracking-[0.12em] text-gradient-landing"
        >
          合域
        </Link>
        <div className="flex items-center gap-3">
          <Button
            variant="landingGhost"
            className="hidden h-9 rounded-full px-4 text-xs md:inline-flex"
            asChild
          >
            <a href="#contact">演示说明</a>
          </Button>
          <Button variant="landingCta" className="h-9 rounded-full px-5 text-xs" asChild>
            <Link to="/app">进入工作台</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
