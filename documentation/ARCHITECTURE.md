# Architecture

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Components | React 19, TypeScript 5.9, Tailwind v4 utilities + CSS custom properties | shadcn ecosystem conventions; utilities for layout, variables for theming |
| Primary animation | Motion for React (`motion`) | Springs and transforms on DOM elements with proper interruption and cleanup; ~30 kB gz and tree-shakeable |
| Specialised animation | Framework-free TypeScript simulation + Canvas 2D | Verlet physics and goo rendering need a per-frame canvas; Canvas 2D has no context limit and no shader compile, so dozens of instances work |
| Accessibility primitives | Radix `Slot` for `asChild`; other Radix primitives when a component needs them | Composable, well-tested, already a shadcn dependency |
| Distribution | shadcn registry schema, static JSON | Official format; works with `npx shadcn add <url>` in Next.js and Vite |
| Docs | Next.js 16 App Router, `cacheComponents` on | Static pages, route types, one template per component driven by typed data |
| Monorepo | pnpm 12 workspaces + Turborepo 2 | Task graph (registry build before docs build), caching |
| Tests | Vitest 5 + Testing Library (jsdom); Playwright 1.64 | Fast unit loop; real browser for interaction, touch and visual tests |
| Node | 24 LTS (`.nvmrc`) | Required by Vitest 5, Vite 8, ESLint 10, shadcn CLI |

## Repository layout

```
creative-ui/
├── apps/docs/                      Next.js docs + registry host
│   ├── public/r/                   built registry JSON (generated, git-ignored)
│   └── src/
│       ├── app/                    routes: /, /components, /components/[slug], /docs, /docs/roadmap
│       ├── components/             site chrome, catalog, playground, docs widgets
│       ├── content/                component meta (data) + live modules (renderers)
│       └── lib/                    codegen, highlighter, source reader, registry URL
├── packages/ui/src/                DISTRIBUTABLE SOURCE (mirrors consumer layout)
│   ├── components/ui/              signature components
│   ├── hooks/                      React hooks (use-reduced-motion, use-strand-field)
│   └── lib/                        framework-free primitives (springs, outline, strand-field, renderer, pointer-field, utils)
├── registry/registry.json          registry definition
├── scripts/                        build-registry.ts, scaffold-component.ts
├── tests/e2e/                      Playwright specs + snapshots
├── examples/vite-consumer/         clean app for the install check (own pnpm workspace)
└── documentation/
```

## Boundaries

1. **Distributed to consumers**: everything under `packages/ui/src`. Files import each other only through `@/` (the consumer alias). They never import docs code (`~/`); `check:registry` fails the build if they do.
2. **Internal primitives**: `lib/*` and `hooks/*` are themselves registry items (`registry:lib`, `registry:hook`) so a component can depend on them by name and the CLI installs them transitively.
3. **Registry artifacts**: `registry/registry.json` is the single definition; `public/r` is generated.
4. **Docs and playground**: `apps/docs`. The docs app resolves `@/*` to `packages/ui/src/*` (tsconfig paths), so it runs the exact distributed files. Its own code uses the `~/` alias.
5. **Demo-only code**: lives in `apps/docs/src/content/**/live.tsx` and site components. Nothing there is distributed.
6. **Tooling**: `scripts/`, `tests/`, `.github/`.

## How a component flows

```
packages/ui/src/components/ui/<slug>.tsx     ← source of truth (+ .test.tsx)
        │
        ├─ registry/registry.json ── scripts/build-registry.ts ──▶ apps/docs/public/r/<slug>.json
        │                                                            │
        │                                                            └─▶ npx shadcn add <url>  (consumer)
        │
        └─ apps/docs/src/content/components/<slug>/meta.ts  (props, examples, sections, playground schema)
                                              /live.tsx (playground renderer, card preview, example renderers)
                 │
                 └─▶ /components/<slug>  (page template: playground, examples, install, API, source view)
                 └─▶ /components (explorer), search index, roadmap
```

`pnpm scaffold` creates all of those files and registrations.

## Runtime model of an animated component

- Server render: static markup, no `window`. `useReducedMotion` returns `false` on the server and during hydration, then the real value.
- Mount: measure, create the canvas, subscribe to the shared pointer store, observe visibility.
- Idle: no animation frame. Pointer movement triggers at most one proximity check per frame per visible instance.
- Active: a `requestAnimationFrame` loop runs only while the simulation reports activity, then stops and clears.
- Unmount: every observer, listener, frame and timer is released; the shared pointer listener detaches with its last subscriber.

## Registry design

- Item names are kebab-case and match file basenames so the CLI's default targets (`components/ui`, `hooks`, `lib`) apply without `target` overrides.
- Internal dependencies are emitted as absolute URLs (`<REGISTRY_URL>/r/<name>.json`); shadcn/ui names (`utils`) are left bare so the CLI fetches them from ui.shadcn.com.
- Versioning: each item carries `meta.version`; the docs page shows it. Breaking changes bump the major and get a migration note in the component's docs section.
- Premium: `meta.tier` today. Authenticated delivery later by serving the same JSON from a protected route; the consumer command stays `npx shadcn add <url>` with a token in the URL or headers, as the shadcn CLI supports.

## Docs rendering model

Component docs are **data**, not prose files. `meta.ts` is plain, serialisable and server-safe, so server components render the API tables, install snippets and sections, and the search index is built from it. The only client parts are the playground, the example gallery and card previews, which look up a `live.tsx` module by slug. This keeps React elements and functions out of server→client props and makes the content testable.
