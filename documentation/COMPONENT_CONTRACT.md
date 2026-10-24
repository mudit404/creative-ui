# Component contract

Every component in `packages/ui/src/components/ui` satisfies this contract before it is listed as `experimental`, and the full definition of done before `stable`.

## API

- Strict TypeScript. Exported `Props` interface extends the native element's attributes (`ButtonHTMLAttributes`, …) so every native attribute and handler passes through.
- Predictable, documented props with sensible defaults. Expose a prop only for a real use case; everything else is a CSS variable or composition.
- `className` targets the control. If a wrapper exists, `wrapperClassName` targets it. `style` on the wrapper carries CSS variables.
- Colours and material through CSS variables with a short component prefix (`--mb-*`). A `colors` (or equivalent) prop maps onto the same variables; never two sources of truth.
- `asChild` (Radix Slot) when the control may need to be a link.
- Controlled/uncontrolled pattern for stateful inputs (`value`/`defaultValue`/`onValueChange`).
- `motion?: "auto" | "reduced" | "off"`. `auto` follows `prefers-reduced-motion`.
- `forwardRef` to the semantic element. `displayName` set.

## Semantics and accessibility

- Native element first (`button`, `a`, `input`, …). Motion layers are `aria-hidden` and `pointer-events: none`.
- Keyboard parity: focus, activation, and where the design allows, equivalent feedback (press burst on Enter/Space).
- Visible `:focus-visible` ring, themeable (`--*-ring`, `--*-ring-offset`).
- `disabled` and `loading` block activation; `loading` sets `aria-busy` and keeps the label in the accessible name.
- Touch: never depend on hover; minimum control height 36px, prefer 44px+.

## Motion and performance

- No animation frame scheduled while nothing is moving. Idle effects gated by visibility (IntersectionObserver), page visibility and user proximity.
- Shared global listeners (`pointer-field`) rather than per-instance window listeners.
- Transforms and opacity only on DOM; no layout-triggering animations.
- Canvas work capped at 2× DPR; fixed-step physics with a substep cap.
- Clean up every observer, listener, frame and timeout on unmount and when `enabled` flips.
- SSR safe: no `window`/`document` during render; hydration-safe media queries.

## Reduced motion

- `reduced`: no particles/strands/idle life; short, critically-damped transitions only.
- `off`: no motion at all, still a fully styled control.

## Files and distribution

- Imports only via `@/` (lib, hooks, components). Never import docs code.
- Each shared primitive is its own registry item; the component lists them in `registryDependencies`.
- Add the component to `registry/registry.json` with `dependencies`, `registryDependencies`, and `meta: { tier, status, version, docs }`.

## Docs

- `apps/docs/src/content/components/<slug>/meta.ts`: name, tagline, description, category, tier, status, version, keywords, props (every prop with type/default/description), cssVars, examples (with code), sections: anatomy, customization, accessibility, performance, browser, limitations; sourceFiles; provenance.
- `live.tsx`: `renderPlayground`, `cardPreview`, and one renderer per example id. Example code strings must match the renderers.
- Playground schema: `initial`, `defaults` (so generated code omits defaults), `controls`, `presets`.

## Tests (definition of done)

- Unit (Vitest): render, native attributes, click, keyboard activation, disabled, loading, ref forwarding, `asChild`, colour variables, motion modes, reduced-motion media, clean unmount.
- Primitive logic has its own tests (geometry, simulation state machine, determinism, no NaN under stress).
- E2E (Playwright): page sections present, live interaction produces output, keyboard operable, playground controls update the real component and the generated code, registry item served and installable.
- Visual: stable baselines for rest states under reduced motion in both tones.
- Install check: `npx shadcn add <url>` into `examples/vite-consumer` and `pnpm build` succeeds.
- Performance: a measured number (ms/frame or similar) in the docs' performance section; no unexplained console errors.

## Provenance

Every component states what it was inspired by, the licence of that reference, that no code or assets were copied, and the licences of its runtime dependencies.
