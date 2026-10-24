# Roadmap

Order follows the specification README's initial collection, with the flagship pulled forward as the vertical slice. Each entry lists the shared foundations it reuses or must create. Every component needs a reference, a brief with acceptance criteria, and the contract's definition of done before it ships.

## Done

| # | Component | Tier | Foundations created |
| --- | --- | --- | --- |
| 10 | **MaterialButton** (flagship) | premium | `springs`, `rounded-outline`, `pointer-field`, `strand-field`, `strand-renderer`, `use-strand-field`, `use-reduced-motion`, `utils` |
| 1 | **FieldMagnet** (primitive) | free | `magnetic-field`, `use-magnetic-field`; reuses `pointer-field`, `springs`. Built through `pnpm scaffold`, which proved the add-a-component path. |
| 2 | **LiquidSwitch** | free | No new primitives: Motion springs + an SVG gooey filter. Establishes the controlled/uncontrolled + hidden-input form pattern for inputs. |
| 3 | **AdaptiveRail** | free | `use-scroll-direction` (new hook); reuses `use-magnetic-field`. Establishes the toolbar / roving-focus and context-scoping patterns. |
| 4 | **GhostTraceText** | free (hybrid) | No new primitives. Establishes the decorative-SVG + semantic-text pattern (sr-only copy, measured viewBox, in-view trigger). |
| 5 | **OrbitalMenu** | premium | No new primitives; reuses `use-magnetic-field`. Establishes the menu-button pattern (aria-haspopup, role=menu, focus return) and polar layout from a progress spring. |
| 6 | **ElasticGrid** | premium | No new primitives; reuses `pointer-field`. Establishes pointer-weighted `fr` tracks on springs and Motion layout animation for catalogs. |
| 7 | **ExpandingProductGrid** | premium | No new primitives. Establishes the expand-in-place pattern: full-row span + layout morph, aria-expanded title button, labelled detail region, focus hand-off. |
| 8 | **FlowStackGallery** | premium | No new primitives. Establishes the tabs/tabpanel gallery model, a measured FLIP flight, deck choreography with direction-aware exits, and Motion drag gestures. |
| 9 | **MosaicMenu** | premium | No new primitives; reuses `use-magnetic-field`. Establishes the portal modal pattern (focus trap, scroll lock, focus return), dense auto-fill mosaics and centre-out stagger choreography. |

## Next, in order

The initial collection is complete. Candidates for the next wave come from the specification's catalog of 40 ideas (not attached; see SPEC_GAPS). Until briefs arrive, the highest-value work is hardening: stable status for the free components, prop-table extraction, cross-platform visual baselines, and the premium registry.

| # | Component | Tier | Reuses | New primitive work | Risk |
| --- | --- | --- | --- | --- | --- |

## Shared work before #5

- Extract `useLift`/`usePress` spring helpers from MaterialButton into `hooks/use-material-springs.ts` if a second component needs the same lift/press/shadow trio (LiquidSwitch likely will).
- Add a `tokens` registry item (`registry:style`) once two components share colour semantics.
- Automate the prop table: a script that extracts `Props` JSDoc into `meta.ts` or a test that diffs them.

## Exit gates per milestone

1. Contract checklist complete; unit + e2e green; visual baselines committed.
2. Registry item builds and installs into `examples/vite-consumer`; consumer builds.
3. Docs page complete with measured performance numbers.
4. Provenance and licence review recorded in the component brief.
