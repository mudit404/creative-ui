# Specification gaps and assumptions

**Baseline:** 24 October 2026.

## What was actually attached

Only `README.md` of the specification pack was present in the input folder. It references 13 documents (`01_PRODUCT_BRIEF.md` … `13_AGENT_EXECUTION.md`), a `components/` folder with ten implementation briefs, and `templates/COMPONENT_BRIEF_TEMPLATE.md`. **None of those files were available.** They were not invented; everything below marks where an assumption stands in for a missing document.

What the README did provide, and what was used verbatim:

- Mission and implementation principle (real semantics first, motion second, every effect optional).
- The initial collection and its order (FieldMagnet → … → MaterialButton), with tiers.
- The naming `MaterialShift Action / MaterialButton` for the flagship.
- Terminology (observed vs. specified, primitive vs. signature component).
- The licensing caution about reference code and assets.

## Assumptions made in place of missing documents

| Missing document | Assumption used | Needs validation |
| --- | --- | --- |
| 01 Product brief | Audience: product teams on React/Tailwind. Launch bar: one flagship fully documented, playground, registry install proven. | Pricing, audiences, non-goals |
| 02 Architecture | pnpm + Turborepo monorepo; one distributable source tree (`packages/ui/src`) mirroring the consumer layout; Next.js 16 docs app hosting the registry. See `ARCHITECTURE.md`. | Hosting target, package naming |
| 03 Component contract | Written fresh as `COMPONENT_CONTRACT.md` from the prompt's engineering standards. | Any mandated prop names/state model |
| 04 Motion & design system | Per-component CSS variables with a short prefix (`--mb-*`); Motion springs for transforms; Canvas 2D for physics. No global token package yet. | Shared token set, quality tiers |
| 05 Distribution & registry | Official shadcn registry schema; static JSON at `/r/<name>.json`; registry dependencies by absolute URL; premium auth deferred. | Premium delivery mechanism |
| 06 Testing & quality | Vitest + Testing Library unit tests; Playwright journey, touch and visual tests; registry validation; clean-app install check. | Coverage thresholds, perf budgets |
| 07 Roadmap | Order taken from the README's initial collection; dependency map written in `ROADMAP.md`. | MVP briefs for FieldMagnet/OrbitalMenu |
| 08 Catalog | Only the ten named components are listed, as "planned" cards with no invented previews. | The other 30 ideas |
| 09 Docs & playground | Data-driven component pages; schema-driven playground; codegen; presets; surface and reduced-motion toggles. | Any required page structure |
| 10 Commercial & licensing | `tier` metadata on every component; provenance note per component; dependency licences listed. No paywall. | Licence text for premium items |
| 11 Decisions & risks | Written fresh as `DECISIONS.md`. | — |
| 12 Sources | Reference list kept in the component brief. | — |
| 13 Agent execution | Written fresh as `AGENT_GUIDE.md` with the scaffold script. | — |
| Component briefs A–J | Only the MaterialButton brief exists (`components/material-button.md`), derived from inspecting the reference. | All others |

## Conflicts noticed

- The prompt's proposed layout has separate `packages/components`, `packages/motion-primitives`, `packages/shared` and a top-level `registry/components` + `registry/examples`. A single `packages/ui/src` tree was chosen instead so that the files the registry serves are byte-identical to the files the docs run, and so that `@/` imports work unchanged after installation. See DECISIONS 002.
- The prompt prefers MDX for docs content. Component docs are typed data (`meta.ts`) rendered by one page template, because the playground, API table, search index and registry all derive from that data. Long-form prose uses a tiny markdown-lite. MDX can be layered on later for guides. See DECISIONS 005.
- The README lists MaterialButton last in delivery order but the prompt asks for it first as the vertical slice. The prompt wins for the first milestone; the README order is kept for the rest of the roadmap.

## Questions for the product owner

1. Public name and npm/registry scope to replace `creative-ui`.
2. Hosting origin for the docs and registry (needed for absolute item URLs).
3. Whether premium items should be gated at MVP (currently metadata only).
4. Whether the remaining nine briefs exist elsewhere; each needs a reference and acceptance criteria before implementation.

## Update, 24 October 2026: Collection 02

The user supplied `CREATIVE_UI_COLLECTION_02_MASTER_SPEC.md` (briefs #41–#60 with A–J sections, architecture additions, quality gates and a source ledger). It does not replace the missing 13 documents of the original pack, but each Collection 02 brief carries its own acceptance tests (Cxx-Txx), which the unit and e2e tests reference by id. The spec's `planning/components.json` and `docs/collections/02/` folder were not attached; registry items are built from the briefs directly.

## Update, 25 October 2026: Collection 02 complete

All twenty Collection 02 briefs (#41–#60) are implemented, tested and documented across five batches. Gaps that remain from the briefs themselves: no license was cleared for Dockview, so DockWorkspace is a limited independent implementation and is documented as such (brief #59 section G permits this); the briefs' `planning/components.json` was never supplied, so registry metadata is derived from each brief; and no device matrix beyond headless Chromium has been exercised, which STATUS records honestly.
