# Agent guide: adding a component

For contributors and coding agents. Follow in order; each step has a verification command.

## 0. Prerequisites

```bash
nvm use && pnpm install
pnpm dev   # docs on http://localhost:3000
```

Read `COMPONENT_CONTRACT.md` and `components/material-button.md` (the worked example).

## 1. Inspect the reference

Open the reference in a real browser. Record, in `documentation/components/<slug>.md`:

- Anatomy, states (rest, hover, press, focus, disabled, loading), timings, easing, shapes, how input drives the effect.
- Verified behaviour vs. assumptions. If you cannot inspect something, say so and ask for a recording.
- Licence of the reference and of any assets. Do not copy code, shaders, fonts or artwork.

## 2. Scaffold

```bash
pnpm scaffold <slug> <ExportName> --category <buttons|inputs|navigation|text|layout|media|primitives> --tier <free|premium>
```

This creates the component, test, docs meta, live renderers and registry entry, and registers them. Routing, explorer, search, playground and registry build need no changes.

## 3. Implement

- Put framework-free logic in `packages/ui/src/lib/<name>.ts` with its own tests. Add it to `registry/registry.json` as `registry:lib` and list it in the component's `registryDependencies`.
- React glue in `hooks/`. Component in `components/ui/<slug>.tsx`.
- Imports only through `@/`. Run `pnpm check:registry` to catch boundary mistakes.

Verify: `pnpm --filter @creative-ui/ui test && pnpm --filter @creative-ui/ui typecheck && pnpm --filter @creative-ui/ui lint`

## 4. Document

Fill `apps/docs/src/content/components/<slug>/meta.ts` completely (every prop, CSS variables, examples with code, sections) and `live.tsx` (one renderer per example id, a card preview, the playground renderer). Define `defaults` so generated code omits default props.

Verify: open `/components/<slug>`; the page must show no "Example renderer missing". Check the playground updates the component and the code.

## 5. Test end to end

Add a spec in `tests/e2e/specs` covering: sections present, live interaction, keyboard, playground round-trip, registry item. Add visual baselines for rest states under reduced motion.

```bash
BASE_URL=http://localhost:3000 pnpm test:e2e
```

## 6. Prove installation

```bash
pnpm build:registry
cd examples/vite-consumer && pnpm install
pnpm dlx shadcn@latest add http://localhost:3000/r/<slug>.json --yes --overwrite
# use it in src/App.tsx, then
pnpm build
```

To review an animation frame by frame (the in-app browser pane cannot capture mid-animation reliably), adapt `tests/e2e/scripts/capture-frames.mjs`, which screenshots the playground at fixed offsets after an interaction:

```bash
cd tests/e2e && node scripts/capture-frames.mjs /tmp/frames http://localhost:3000
```

## 7. Measure

Record a frame-time number from the playground (Performance panel or `performance.now()` around the frame) in the docs performance section. Do not claim numbers you did not measure.

## 8. Ship

- `status: "experimental"` on first release; `stable` after the full definition of done.
- Bump `version` in `meta.ts` and `registry.json` together.
- Update `ROADMAP.md` and `STATUS.md`.

## Conventions

- Kebab-case file and registry names; PascalCase exports.
- CSS variable prefix: initials of the component (`--mb-` for MaterialButton).
- `data-slot="<slug>"` on the wrapper, `data-motion` for the resolved motion mode.
- Keep demo-only code in `apps/docs`.
