# Decisions

Short ADRs. Status is Accepted unless noted.

## 001 — Canvas 2D instead of WebGL for the goo

The reference is a full-page WebGL2 ray marcher that also draws the cursor. For a drop-in component that is wrong on three counts: WebGL contexts are limited per page (≈16), a component cannot take over the cursor, and a page-level canvas cannot be installed as a file. The goo is therefore a 2D Verlet simulation rendered to a per-instance Canvas 2D overlay that bleeds around the button. Trade-off: no true 3D shading or smooth-min blending; fillets, highlights and shadows are drawn geometrically. Reversible: `StrandField` is renderer-agnostic, so a WebGL renderer could be added for a "cinematic" tier.

## 002 — One distributable source tree mirroring the consumer layout

`packages/ui/src/{components/ui,hooks,lib}` uses `@/` imports exactly as the installed files will. The docs app maps `@/*` to that tree and uses `~/*` for its own code. Alternatives considered: separate `components`/`motion-primitives`/`shared` packages (import rewriting needed, drift between served and run files), or the shadcn-www pattern of keeping the registry inside the docs app (couples components to the docs). Trade-off: docs can't use `@/` for itself; acceptable.

## 003 — Primitives are registry items, not an npm runtime

`strand-field`, `pointer-field`, `springs` etc. are `registry:lib`/`registry:hook` items. A component declares them as `registryDependencies` and the CLI installs them transitively. This keeps the "you own the code" promise for the physics too. Trade-off: updates need `add --overwrite`; versioning is documented per component.

## 004 — Motion for React for springs, not for the physics

Lift, press, shadows and the pointer sheen use `useSpring`/`useTransform` on `motion` elements (interruptible, GPU-friendly transforms). The strand physics runs in plain TypeScript at fixed 120 Hz substeps because it needs arrays, constraints and a canvas, which Motion does not model.

## 005 — Typed docs data over MDX for component pages

Each component has `meta.ts` (serialisable data) and `live.tsx` (renderers). One page template renders every component. The playground schema, API table, search index, roadmap and registry metadata all derive from `meta.ts`, and the scaffold can generate it. MDX remains an option for guides; it was not needed for the MVP and would have added a compile pipeline and a second source of truth.

## 006 — Registry build is a custom script validated against the official schema

`shadcn build` expects sources relative to the docs app. A 150-line script reads `registry/registry.json`, inlines files from `packages/ui/src`, rewrites internal dependencies to absolute URLs, validates shapes with zod and enforces import boundaries (no `~/` imports; every `@/` import must be a declared dependency). Output is plain static JSON, verified by `npx shadcn add` into `examples/vite-consumer`.

## 007 — Node 24 and pnpm 12

Vitest 5, Vite 8, ESLint 10 and the shadcn CLI require Node ≥ 20.19/22; Node 24 LTS was installed via nvm and pinned in `.nvmrc`. Corepack's pnpm shim failed on this machine (stale signing keys), so pnpm is installed with npm. CI uses `pnpm/action-setup`.

## 008 — Preview stages are theme-independent

Component previews sit on a "studio floor" (`.stage` light, `.stage-dark` dark) whose colour does not follow the site theme. A black slab vanished on the dark site otherwise, and product shots should look identical for every visitor. The playground and examples have explicit surface toggles.

## 009 — Keyboard and touch get a press burst instead of hover strands

There is no hover on touch and no pointer for keyboard users. Enter/Space and touch presses trigger a ring burst of strands so both get equivalent feedback. Lift is skipped for touch.

## 010 — Idle life is on by default, gated hard

The reference's "stays alive" trait is part of the signature, so `idle` defaults to true. It is gated by IntersectionObserver, page visibility and pointer proximity, and runs ~1 s of animation every ~2 s. Consumers can switch it off per instance.

## 011 — Tailwind must scan the component sources in the docs app

Tailwind v4 auto-detects content from the app directory only. Utilities that appear solely inside `packages/ui/src` (component sizes, variable-backed colours, `data-[state]` variants) were missing from the docs CSS until `@source "../../../../packages/ui/src"` was added to `globals.css`. Consumers were never affected (Tailwind scans their installed files), which is why the install check passed while docs previews were under-styled. Visual baselines were regenerated after the fix. Any future app that previews the package directly needs the same directive.

## 012 — Deferred

- MDX guides.
- Premium registry authentication.
- Automated prop-table extraction from TypeScript (currently hand-written in `meta.ts`; a test could diff them).
- A WebGL renderer tier.
- A GitHub Action that publishes visual baselines per platform.
