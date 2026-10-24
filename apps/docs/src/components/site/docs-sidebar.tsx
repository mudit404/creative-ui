import { NavLink } from "~/components/site/nav-link";
import { components } from "~/content/components";

export function DocsSidebar() {
  const implemented = components.filter((c) => c.status !== "planned");
  const planned = components.filter((c) => c.status === "planned");
  return (
    <nav aria-label="Documentation" className="flex flex-col gap-6 text-sm">
      <div>
        <div className="mb-2 px-2.5 font-mono text-[11px] uppercase tracking-wider text-muted">Getting started</div>
        <div className="flex flex-col">
          <NavLink href="/docs" exact>
            Introduction
          </NavLink>
          <NavLink href="/docs#installation" exact>
            Installation
          </NavLink>
          <NavLink href="/docs#theming" exact>
            Theming
          </NavLink>
          <NavLink href="/docs/roadmap">Roadmap</NavLink>
        </div>
      </div>
      <div>
        <div className="mb-2 px-2.5 font-mono text-[11px] uppercase tracking-wider text-muted">Components</div>
        <div className="flex flex-col">
          {implemented.map((c) => (
            <NavLink key={c.slug} href={`/components/${c.slug}`}>
              {c.title}
            </NavLink>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 px-2.5 font-mono text-[11px] uppercase tracking-wider text-muted">Planned</div>
        <ul className="flex flex-col gap-1 px-2.5 text-muted">
          {planned.map((c) => (
            <li key={c.slug}>{c.title}</li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
