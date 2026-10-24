import { components } from "~/content/components";

export interface SearchEntry {
  kind: "component" | "doc";
  title: string;
  description: string;
  href: string;
  keywords: string[];
}

export const searchIndex: SearchEntry[] = [
  ...components.map((c) => ({
    kind: "component" as const,
    title: c.title,
    description: c.tagline,
    href: `/components/${c.slug}`,
    keywords: [...c.keywords, c.category, c.tier, c.status, ...c.props.map((p) => p.name)],
  })),
  { kind: "doc", title: "Introduction", description: "What Creative UI is and how it is built", href: "/docs", keywords: ["intro", "philosophy", "getting started"] },
  { kind: "doc", title: "Installation", description: "Install components with the shadcn CLI", href: "/docs#installation", keywords: ["install", "shadcn", "cli", "registry", "npx"] },
  { kind: "doc", title: "Theming", description: "CSS variables and tokens", href: "/docs#theming", keywords: ["theme", "css variables", "dark mode", "tokens"] },
  { kind: "doc", title: "Motion & accessibility", description: "Reduced motion, keyboard, touch", href: "/docs#motion", keywords: ["reduced motion", "a11y", "accessibility", "keyboard"] },
  { kind: "doc", title: "Roadmap", description: "Planned components and build order", href: "/docs/roadmap", keywords: ["roadmap", "planned", "catalog"] },
];
