# Status

**As of 24 October 2026.** Everything under "Implemented and verified" was run on this machine (Apple Silicon, Node 24.22, pnpm 12.15) with the commands shown. "Proposed" is not built.

## Implemented and verified

### Foundation
- pnpm + Turborepo monorepo; strict TypeScript; ESLint (React Compiler rules) on the component package; Prettier config; `.nvmrc`; CI workflow (`.github/workflows/ci.yml`, not yet run on GitHub).
- Task graph: `docs#build` depends on `docs#build:registry` (verified with `turbo run build --dry`).

### Component package (`packages/ui`)
- `FieldMagnet` (free primitive, built via `pnpm scaffold`): sprung pull toward a nearby pointer with radius/strength/maxOffset/innerStrength/axis/scale/spring presets, `asChild`, reduced-motion and touch opt-out, `data-active` state. Primitives `magnetic-field` (pure math) and `use-magnetic-field` (hook).
- `MosaicMenu` (premium): full-screen route menu in a portal; modal dialog with focus trap, Escape, backdrop click, body scroll lock and focus return; nav of link tiles with spans, accents, media and aria-current; centre-out staggered springs with scatter vectors; 2D arrow-key navigation; magnetic tiles; router link component; CSS variables.
- `FlowStackGallery` (premium): thumbnail tablist + stacked tabpanel viewer; thumbnails fly into the deck (measured FLIP), next/previous, arrow keys and drag shuffle the deck, loop/edges, captions, lazy thumbnails, live position announcement, controlled/uncontrolled, CSS variables.
- `ExpandingProductGrid` (premium): product cards (`ul` > `li` > `article`) that expand in place to the full row with layout animation and media morph, one open at a time, controlled/uncontrolled, aria-expanded title buttons, labelled detail region with Close, Escape and focus return, side/stack detail layouts, CSS variables.
- `ElasticGrid` (premium): responsive `ul`/`li` catalog grid with pointer- and focus-weighted elastic `fr` columns on springs, derived or fixed column count, layout animation and enter/exit for filtering and sorting, CSS variables.
- `OrbitalMenu` (premium): radial menu with menu-button semantics, roving arrows, Escape/outside/Tab close with focus return, controlled/uncontrolled open, radius/sweep/startAngle layout, staggered swing-in springs, magnetic items, labels, CSS variables.
- `GhostTraceText` (free, hybrid): SVG-traced headline with a ghost stroke that settles into fill; semantic heading kept for AT; in-view/mount/manual triggers; multi-line stagger; measured viewBox; plain text under reduced motion.
- `AdaptiveRail` (free): `role="toolbar"` floating rail with scroll-aware collapse/hide, context-scoped items, roving arrow-key focus, hover/focus/forced expansion, magnetic items, CSS variables; new `use-scroll-direction` hook.
- `LiquidSwitch` (free): native `role="switch"`, controlled/uncontrolled, hidden checkbox for forms, sizes, colour variables, `viscosity`, gooey SVG pour with Motion springs, reduced/off fallbacks.
- `MaterialButton` with: tone/size/shape/finish, colour props + CSS variables, reach/tendrils/intensity/speed/idle/lift, `motion` modes, loading, disabled, `asChild`, ref forwarding, native attributes.
- Primitives: `springs`, `rounded-outline`, `pointer-field`, `strand-field` (Verlet goo simulation), `strand-renderer` (Canvas 2D), hooks `use-reduced-motion`, `use-strand-field`.
- `pnpm --filter @creative-ui/ui test`: **108 tests passing** (geometry, simulation lifecycle, determinism, NaN stress, renderer, magnetic field math, both components' behaviour, frame-cost benchmark).
- `typecheck` and `lint` clean.

### Docs site (`apps/docs`)
- Landing page with live hero, featured cards, principles.
- Component explorer with search, category chips, tier and status filters; planned components shown honestly as "planned" without fake previews.
- Component page: live playground (schema-driven controls, light/dark stage, grid, simulated reduced motion, presets, reset, generated TSX with copy), eight live examples with code, installation, API reference, CSS variables, anatomy/customisation/accessibility/performance/browser/limitations sections, source view of the exact distributed files, provenance.
- Docs page (introduction, installation, ownership policy, theming, motion, stack) and roadmap page.
- ⌘K search, dark/light theme, responsive layout.
- `next build`: all routes prerendered static. `typecheck` and `lint` clean.

### Registry
- `registry/registry.json` → `pnpm build:registry` → `apps/docs/public/r/*.json` (20 items) validated against the official schema shape, with import-boundary checks.
- Served with CORS at `/r/<name>.json`; internal dependencies as absolute URLs.
- **Install proven:** `npx shadcn@latest add http://localhost:3000/r/material-button.json` into `examples/vite-consumer` (clean Vite + Tailwind v4 app) wrote 9 files and 4 npm deps; adding `field-magnet.json` wrote 3 more `liquid-switch.json` 1 more, `adaptive-rail.json` 2 more `ghost-trace-text.json` 1 more, `orbital-menu.json` 1 more, `elastic-grid.json` 1 more, `expanding-product-grid.json` 1 more, `flow-stack-gallery.json` 1 more and `mosaic-menu.json` 1 more. `pnpm build` of the consumer succeeds with both components in use (default, loading, link, CSS-variable theme, magnetic button, magnetic link).

### End-to-end (Playwright, Chromium desktop + Pixel 7 emulation)
- `pnpm test:e2e` against the production build: **49 passed** (15 Material Button/site tests, 3 FieldMagnet, 4 LiquidSwitch, 4 AdaptiveRail, 4 GhostTraceText, 4 OrbitalMenu, 4 ElasticGrid, 4 ExpandingProductGrid, 4 FlowStackGallery, 3 MosaicMenu: modal open with focus on the current route, measured tile spans, 2D arrows, focus trap, Escape with focus return and scroll unlock, backdrop and tile close, playground controls, registry item) — landing, no console errors, explorer search/filters, ⌘K navigation, page completeness, strands drawn on approach and cleared on pull-away (canvas pixel counts), keyboard activation with focus ring, playground round-trip (label, size, tone, loading, colours, reduced motion, dark surface, reset), presets + clipboard code, registry item validity and dependency resolution, touch press burst and no horizontal overflow on mobile, three visual baselines (ink rest, bone on dark, bone loading) plus two title-block baselines.

### Performance
- Simulation + draw-call generation for six held strands: ≈0.09 ms/frame (benchmark test, raster excluded).
- No animation frame when idle; visibility- and tab-gated; one shared pointer listener.

### Docs CSS fix (24 Oct, during OrbitalMenu)
- Tailwind only scanned `apps/docs`, so utilities used solely inside `packages/ui` were missing from the docs CSS (component sizes, variable-backed colours, data-state styles). Fixed with `@source "../../../../packages/ui/src"` in `globals.css`; visual baselines regenerated. Consumers were never affected. See DECISIONS 011.
- Galleries must never scroll the page on mount: an early FlowStackGallery build called `scrollIntoView` for the active thumbnail on mount, which dragged the docs page to the last example. The scroll now runs only on later index changes (and survives StrictMode's double effects).
- The playground stage wrapper now has a definite width (`w-full` flex), so grid components get real column counts in previews; before, percentage widths resolved against a shrink-to-fit box and grids collapsed to one column.
- Smooth scrolling was removed from the docs: it made Playwright's scroll-into-view retry loop never settle, and reduced-motion users get instant jumps anyway.

## Known gaps (honest list)
- Visual baselines are macOS/Chromium only; CI on Linux will need its own baselines (`pnpm test:e2e:update` on that platform).
- Browser frame-time under raster load was observed, not benchmarked; no automated fps assertion.
- The goo reads as stringy strands but is less organic than the WebGL reference: no true 3D shading, beads are radius modulation only, strands never cross the face.
- Prop tables are hand-written in `meta.ts`; drift from the TypeScript types is not yet checked automatically.
- `AGENTS.md` in `apps/docs` is generated by Next.js; keep it.
- Nothing is committed yet; the repository is initialised with no commits.

## Proposed (not built)
- The initial collection of ten is complete. The specification's further 30 catalog ideas were not attached.
- MDX guides; premium registry authentication; WebGL renderer tier; prop-table extraction; shared token package.
