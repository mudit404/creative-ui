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

## Collection 02 (from `CREATIVE_UI_COLLECTION_02_MASTER_SPEC.md`, 24 Oct 2026)

Briefs #41–#60 ship in waves of three or four. Each adds the spec's state-authority contract: controlled props are authoritative, pointer/keyboard operations preview, one commit per release with `source` metadata, parent revisions and stale events cancel previews, and `--cui-*` tokens.

### Done

| # | Component | Tier | Foundations created |
| --- | --- | --- | --- |
| 41 | **ElasticRange** | free | `bounded-value` lib (domain validation, decimal-safe quantization, scales, detent hysteresis, strict parsing). Establishes preview/commit for numeric inputs and the hidden-input serialisation of intervals. |
| 42 | **DetentDial** | free | Reuses `bounded-value`. Establishes vertical-drag rotary input, hysteretic detents, config diagnostics with usable fallback, and the fine/coarse step contract. |
| 60 | **ActivityCapsule** | free | `task-snapshots` lib (attempt/revision authority, terminal freezing, primary selection, milestones). Establishes request-only actions and restrained live regions. |
| 49 | **CompareWorkbench** | premium | `compare-schema` lib (availability, unit-aware equality, schema-ordered rows, differences filter). Establishes schema-driven semantic tables and the limit-without-substitution selection policy. |

| 48 | **PaletteComposer** | premium | `palette-extract` lib (deterministic extraction, colour parsing, CSS export) plus `decoder`/`extractor` adapter points. Establishes the request-id + AbortSignal pipeline for media work and owned-resource teardown. |
| 43 | **DecisionDeck** | premium | `transactions` lib (request ids, resolution matching). Establishes the request → pending → resolution contract and the no-drag/keyboard parity pattern for gestures. |
| 44 | **TransferBoard** | premium | `board-moves` lib (validation, id-addressed moves, inverse moves). Establishes placeholder previews that never mutate controlled data, revision-based cancellation and conflict-explaining undo. |

| 45 | **CablePatchbay** | premium | `patch-graph` lib (typed validation with reasons, diagnostics, snapping, cable geometry). Establishes DOM-controls + SVG-overlay measurement and the drag/tap/keyboard/list equivalence for connections. |
| 46 | **TimeLens** | premium | `time-scale` lib (validation, sorting, lanes, clamp/zoom, ticks, zone formatting, strict ISO). Establishes overview/detail brushing with preview vs commit and opt-in non-passive wheel handling. |
| 57 | **ContinuityChart** | free | `chart-layout` lib (snapshot validation, zero-inclusive domain, keyed geometry). Establishes identity-preserving SVG morphs with plain-SVG fallbacks outside full motion. |
| 56 | **FocusGraph** | premium | `graph-model` lib (validation, adjacency, deterministic bounded force layout, viewBox fitting). Establishes list-first graph exploration with a viewBox-only camera. |

| 50 | **ScrollFilm** | premium | `seek-scheduler` lib (latest-target seeks, timeouts, generations, scroll mapping, chapter validation). Establishes native-first media with an honest requested/presented contract. |
| 51 | **ExplodedProduct** | premium | `three-stage` (demand-rendered stage, bounded orbit, DPR cap, context loss) and `exploded-parts` libs. Establishes the poster+list-first 3D pattern with a renderer-less controller. |
| 52 | **CutawayViewer** | premium | `clip-plane` lib (model-local bounds, world planes, cap support). Establishes in-place plane updates and declared-not-guessed cap support. |
| 53 | **FinishConfigurator** | premium | `finish-options` lib (rules with reasons, flags, allowlisted params, generations). Establishes per-instance material ownership and generation-guarded assets. |

### Next, in order (rest of wave D, then E)

| # | Component | Tier | Reuses | New primitive work | Risk |
| --- | --- | --- | --- | --- | --- |
| 54 | ParticleMorph | premium | `three-stage`, `point-targets` | seeded Morton sampling, Points buffers, latest-target morph — shipped 25 Oct (batch five) | GPU cost (budgeted by `quality`) |
| 58 | GlassKeybed | premium | `voice-pool` | explicit consent, mallet `SoundAdapter`, bounded voices, Stop all — shipped 25 Oct (batch five) | audio policy (blocked → visual-only) |
| 47, 55, 59 | wave E (SplitFlapBoard free, AsciiMedia free, DockWorkspace premium) | free / free / premium | `flap-cells`, `ascii-grid`, `dock-layout` | split-flap scheduler, glyph atlas sampling, independent dock layout — shipped 25 Oct (batch five) | consent/resource rules recorded in DECISIONS 017 |

## Shared work before #5

- Extract `useLift`/`usePress` spring helpers from MaterialButton into `hooks/use-material-springs.ts` if a second component needs the same lift/press/shadow trio (LiquidSwitch likely will).
- Add a `tokens` registry item (`registry:style`) once two components share colour semantics.
- Automate the prop table: a script that extracts `Props` JSDoc into `meta.ts` or a test that diffs them.

## Exit gates per milestone

1. Contract checklist complete; unit + e2e green; visual baselines committed.
2. Registry item builds and installs into `examples/vite-consumer`; consumer builds.
3. Docs page complete with measured performance numbers.
4. Provenance and licence review recorded in the component brief.
