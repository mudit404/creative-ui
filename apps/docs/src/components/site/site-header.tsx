import Link from "next/link";
import { ThemeToggle } from "~/components/site/theme-toggle";
import { CommandSearch } from "~/components/site/command-search";
import { Wordmark } from "~/components/site/wordmark";
import { NavLink } from "~/components/site/nav-link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-ink" aria-label="Creative UI home">
          <Wordmark />
        </Link>
        <nav className="hidden items-center gap-1 text-sm sm:flex" aria-label="Primary">
          <NavLink href="/components">Components</NavLink>
          <NavLink href="/docs">Docs</NavLink>
          <NavLink href="/docs/roadmap">Roadmap</NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <CommandSearch />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
