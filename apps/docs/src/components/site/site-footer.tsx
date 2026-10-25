import Link from "next/link";
import { Wordmark } from "~/components/site/wordmark";

export function SiteFooter() {
  return (
    <footer className="relative z-[1] mt-24 border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <Wordmark className="text-ink" />
            <span className="hidden sm:inline">·</span>
            <span>Source-first creative components. Working name, replace before publishing.</span>
          </div>
          <p className="m-0 text-xs">© 2026 Mudit Gupta. All rights reserved.</p>
        </div>
        <nav className="flex gap-5" aria-label="Footer">
          <Link href="/components" className="hover:text-ink">
            Components
          </Link>
          <Link href="/docs" className="hover:text-ink">
            Docs
          </Link>
          <Link href="/docs/roadmap" className="hover:text-ink">
            Roadmap
          </Link>
          <a href="/r/registry.json" className="hover:text-ink">
            Registry
          </a>
        </nav>
      </div>
    </footer>
  );
}
