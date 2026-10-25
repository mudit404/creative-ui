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

## 013 — Collection 02 keeps the existing motion API and scopes new tokens as `--cui-*`

The Collection 02 spec writes `motion="auto|full|reduced|none"` and `--cui-*` tokens. Ten shipped components already use `motion="auto|reduced|off"` and per-component prefixes (`--mb-*`, `--ls-*`, …). Collection 02 components keep `off` (one vocabulary across the library; a `full` override that ignores a system preference is deliberately not offered, which the spec itself allows: "full must not silently defeat a system preference") and use the spec's `--cui-<component>-*` token names, since nothing consumes the old prefixes outside each component. `durationScale` is adopted where a component has a shape transition (ActivityCapsule). The spec's "controller" boundaries (`bounded-value-controller`, `task-snapshot-controller`) are shipped as pure libs (`bounded-value`, `task-snapshots`, `compare-schema`) and registered as `registry:lib` items rather than hooks, because they have no React dependency and are unit-tested in isolation.

Development diagnostics (`console.warn` for invalid domains, log-scale fallback and rejected snapshots) are not gated on `process.env.NODE_ENV`: registry files must compile in non-Node consumers (the Vite install check failed on `process`), and each warning fires at most once per module or per diagnostics batch.

## 014 — Batch two ships without node-vibrant or dnd-kit

Brief #48 proposes node-vibrant and #44 proposes dnd-kit. Both are left as adapter points rather than dependencies: PaletteComposer takes `decoder` and `extractor` functions (its built-in extractor is a deterministic bucket quantiser with alpha threshold, distance de-duplication and real sample coordinates, unit-tested on pixel fixtures), and TransferBoard implements the single-item Pointer Events drag it needs (intent threshold, capture, `elementFromPoint` targeting, placeholder preview, bounded autoscroll) behind the click-only Move menu that the brief says must come first. Reasons: the spec forbids adding runtime dependencies without verification, a shadcn-style registry install should not pull a drag engine or an extraction library into every consumer, and the briefs' acceptance tests are about state authority, not engine features. Hosts that need those libraries can plug them in through the adapters; dnd-kit's multi-select and cross-window features are explicitly deferred in the brief anyway.

Also from this batch: previews must never mutate controlled collections, and a dragged row must stay mounted (collapsed) so its captured handle keeps receiving events — moving it between lists remounts it and loses the pointer. Motion values driving a gesture call `.stop()` on pointer down, because a still-running return animation would otherwise overwrite the new drag each frame (found by Playwright, invisible in jsdom).

## 015 — Batch three keeps its math in-house and its SVG honest

Briefs #45, #46, #56 and #57 point at React Flow, d3-scale, react-force-graph and d3-force. None is a dependency: `patch-graph`, `time-scale`, `chart-layout` and `graph-model` are small pure libs with unit tests (a linear time scale with a nice-step table, a greedy lane allocator, a zero-inclusive linear value scale, a Fruchterman–Reingold-style force layout with a seeded RNG and an iteration cap). The briefs' acceptance tests are about determinism, validation and semantic equivalents, which pure code satisfies better than an engine behind an adapter; hosts that need pan/zoom node editors or very large graphs can wrap these components' semantic cores with those engines (deferred, documented in each component's limitations).

Rendering rules learned here: outside full motion, SVG marks and camera are plain elements (`rect`, `line`, `g`, `viewBox` attribute), because Motion applies even zero-duration updates asynchronously and tests and screen readers need synchronous geometry; under full motion, SVG attributes animate through Motion's `attrX`/`attrY` (plain `x`/`y` become transforms); and opt-in wheel zoom needs a native non-passive listener because React registers `wheel` as passive. A fixed-aspect board must not be used where modules can outgrow it; the patchbay board grows with content so the cable overlay always covers the sockets.

## 016 — Three.js is a dependency, isolated to the 3D items; no React Three Fiber, model-viewer or GSAP

Briefs #51–#53 need real WebGL (clipping, stencils, materials); Three.js r180 (MIT) is the renderer, declared only on the three 3D components and their libs (`three-stage`, `exploded-parts`, `clip-plane`), with `@types/three` as a registry devDependency so a TypeScript consumer compiles. React Three Fiber, model-viewer and GSAP are not used: R3F would add a second render loop and a large peer surface for three components that need one demand-rendered stage; model-viewer is a different DOM contract; GSAP ScrollTrigger is unnecessary for a scroll-to-time mapping. The 3D controllers (part transforms, planes, option rules) run on plain Object3D trees without a renderer, which is how they are unit-tested in jsdom; WebGL is verified in Chromium e2e (screenshots differ across states). Demo models are procedural (no licensed assets); a real product loads a prepared GLB through `model={{ kind: "url" }}`.

Lessons: MediaRecorder WebM has no duration header, so the demo film is remuxed with Playwright's bundled ffmpeg; a browser may never fire `seeked` for a seek to the current time, so the scheduler seeds the presented time from metadata and releases a stuck seek after a timeout without inventing a presented time; with `<source>` children the video element itself never fires `error`, so single sources use the `src` attribute and multi-source sets listen on the last `<source>`; and only a reduced-motion preference forces native playback, because `motion="off"` removes decoration, not function.

## 017 — Batch five: independent SplitFlap, Points-based ParticleMorph, Canvas ASCII, Web Audio keybed, limited dock (no Dockview)

Briefs #47, #54, #55, #58 and #59 close Collection 02. No new runtime dependency was added: `three` (already isolated to the 3D items) is reused by `ParticleMorph` through `three-stage`; everything else is DOM, Canvas 2D and Web Audio.

- **SplitFlapBoard** is an independent CSS 3D implementation (react-split-flap was studied, not used). The accessible content is one string; flaps are aria-hidden; a value change mid-flip re-routes already-moving cells to the newest glyph instead of finishing a stale one. Shaped scripts and glyphs outside the character set switch the whole board to whole-content swaps rather than attempting shaping.
- **ParticleMorph** renders Three `Points` from preallocated buffers sized once per `pointCount`; targets are decoded (≤256 px), alpha-thresholded, sampled with a seeded mulberry32 generator and Morton-ordered, then cached per `id|count|seed` behind AbortControllers. Interrupting a morph snapshots the live positions as the new start. The fallback image and label are the identity; the cloud is decoration (`renderer="none"` keeps everything but the canvas). StringTune-3D was a reference only.
- **AsciiMedia** keeps the native `<img>`/`<video>` as the accessible representation and timeline authority and draws glyphs on one aria-hidden canvas from a per-font/size/ramp atlas; video sampling follows `requestVideoFrameCallback` (rAF fallback) capped by `maxFps` and gated by `paused`/`ended`/`document.hidden`. Cross-origin reads are detected by the thrown `SecurityError` name (duck-typed: `DOMException` is not an `Error` subclass in every realm). Only a reduced-motion preference or `motion="reduced"` forces the native player for video; `motion="off"` removes decoration, not the conversion.
- **GlassKeybed** has no Three.js renderer (the Codrops reference used one; keys here are CSS). Web Audio is created or resumed only inside the Enable-sound click; a context that stays suspended is reported as `blocked` and the instrument stays visual-only. The built-in mallet voice (sine + one inharmonic triangle partial, `malletEnvelope`) is an adapter the host can replace. A borrowed `audioContext` is never closed; an owned one is. `setPointerCapture` is wrapped in try/catch because Chromium throws for pointer ids it does not know (synthetic events from tests and some assistive input).
- **DockWorkspace** is a *limited independent* split/tab implementation, explicitly not a docking engine. Dockview was the brief's adapter candidate; its enterprise feature tier and redistribution terms were not cleared for a source-first registry, so nothing from it ships (C59-T10 is satisfied by not having an adapter at all). Panels render once in a flat list and are positioned from the layout tree's ratios alone (`layoutGeometry`), so content stays mounted across tab switches, resizes, moves and the compact mode; the host removes closed panels from `panels` when they should stop existing (documented mounting policy, C59-T09). Drag and resize previews live in local state only and `onLayoutChange` fires once per accepted operation; controlled hosts remain authoritative.

Lessons: jsdom's `DOMException` fails `instanceof Error`; Playwright's mouse is pointer id 1 and any other id throws in `setPointerCapture`; a status line that reports *why* a mode is active (breakpoint vs. minimum sizes) needs the breakpoint check to come second when both apply, or the example must set the breakpoint low.

## 018 — Dark-mode contrast: `light-dark()` defaults inside components, `color-scheme` on the docs stages

Every component carried light-only fallbacks (`var(--cui-range-text, #141311)`, muted `rgba(20,19,17,…)`, accent `#1f7a4f`, error `#c8360d`) and nothing redefined them for dark surfaces, so on the docs' dark stage and on the dark site text and controls fell to about 1:1 (ink on near-black). The light fallbacks had failures of their own: 0.5-alpha muted text is 3.4:1 on the stage, `#1f7a4f` and `#c8360d` are 4.2:1 on the `#e9e5dc` face tint, and 0.25-alpha borders are 1.7:1 where they are the only thing outlining an input or a thumb.

Mechanism: the fallback inside each `var()` becomes `light-dark(<light>, <dark>)`. Token names and the one-default-per-token rule are unchanged, so a consumer still owns the file and overrides any token on any selector; the dark side ships inside the source (nothing to install, no CSS block to paste, no `.dark` selector baked into registry files); and the browser picks the side from the element's `color-scheme`, the signal native controls and scrollbars already use. A host that never sets `color-scheme` keeps today's light rendering (`light-dark()` returns its first argument under `color-scheme: normal`); a dark host adds `color-scheme: dark` to its dark selector, as the theming page now says. Colours that reach Canvas 2D or Three.js cannot carry `light-dark()` or `var()`, so those components resolve the CSS value through a probe element's computed `color` before drawing.

Rejected: a `.dark { --cui-*: … }` sheet in `globals.css` (fixes the docs only, ~230 tokens for every consumer to copy, and because stages are theme-independent (008) a light stage inside the dark site would inherit the dark values and have to re-declare every light token); shadcn `cssVars.light`/`cssVars.dark` on each registry item (the CLI would write ~230 variables into each consumer's `globals.css` on install, against the ownership policy). Tailwind `dark:` variants are not used in components or in demo code because `.dark *` matches everything under `html.dark`, including a light stage.

Palette (light / dark; WCAG 2.x ratios against the stage colours `#f1efe9` / `#121210`): ink `#141311` / `#ecebe6` (16:1 / 15.7:1); paper `#faf9f6` / `#1f1f1c`; face tint `#e9e5dc` / `#2a2a27`; muted text `rgba(20,19,17,0.65)` / `rgba(236,235,230,0.65)` (5.5:1 / 7.1:1 — text alphas below 0.62 were raised); decorative lines keep their alpha on the opposite ink; essential boundaries `rgba(20,19,17,0.5)` / `rgba(236,235,230,0.45)` (3.4:1 / 3.8:1); focus rings solid ink; accent `#1a6b45` / `#5fcf8f` (5.7:1 / 9.7:1) with white / `#121210` text on it; error `#b8310c` / `#ff8a65` (5.2:1 / 8.1:1). Data-series palettes and the designed-dark overlays (MosaicMenu backdrop, ScrollFilm captions, the ASCII canvas) are unchanged. The docs stages declare `color-scheme` (`.stage` light, `.stage-dark` dark) so stage content follows the stage, not the site. MaterialButton's focus ring no longer follows the slab colour by default (a black slab on a dark floor had no visible ring); it is the theme ink unless `colors.surface` is given.

Verification: `tests/e2e/specs/contrast.spec.ts` runs axe-core's `color-contrast` rule on every component page in both site themes with every example and the playground switched to the dark surface (the stages' decorative gradient is flattened first, because axe reports text over a gradient as unmeasurable rather than failing); `tests/e2e/scripts/contrast-sweep.mjs` prints the measured ratios for a report; `packages/ui/src/theme-defaults.test.ts` fails the unit suite if a component ships a single-scheme colour default again. The sweep also exposed a docs bug: the Examples section sat inside `prose-docs`, whose `th`/`a`/`h3 { color: var(--ink) }` rules painted the site's ink onto component text inside the theme-independent stages; the gallery now sits outside that class. Measurements are in STATUS.

## 012 — Deferred

- MDX guides.
- Premium registry authentication.
- Automated prop-table extraction from TypeScript (currently hand-written in `meta.ts`; a test could diff them).
- A WebGL renderer tier.
- A GitHub Action that publishes visual baselines per platform.
