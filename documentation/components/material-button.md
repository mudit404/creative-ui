# MaterialButton — reference analysis, design and verification

**Spec name:** MaterialShift Action / `MaterialButton` (flagship, premium)
**Reference:** https://exteestudio.github.io/venom-button/ — repository `exteestudio/venom-button`, MIT licence (© 2026 exteestudio); embedded Geist font under SIL OFL 1.1; cursor artwork from a Figma Community file.
**Inspected on:** 24 October 2026, in the Claude desktop browser (Chromium), plus the repository's `README.md`, `docs/03-anatomy.md`, `docs/04-how-it-works.md` and the single-file source.

## 1. Reference analysis

### Verified by inspection

| Aspect | Observation |
| --- | --- |
| DOM | One full-page `<canvas id="stage" aria-hidden>`; one real `<button class="venom" type="button" aria-label="let’s collaborate">`; a "Tune (T)" toggle; a tuning panel with 13 sliders. |
| Rendering | WebGL2, three passes: SDF ray march (height/normal G-buffer), studio lighting, FXAA. The OS cursor is hidden and redrawn in the scene as a 3D arrow that morphs into a hand. |
| Rest state | Matte black pill, 60 px tall, width hugs the label + 30 px padding, silver label (Geist Bold 19 px), tight contact shadow, out-of-focus window reflection on the left of the face, a glint travelling round the rim about every 7 s. |
| Approach | At ≈220 px ("awareness") the surface leans toward the cursor and tiny strings fizz along the facing edge. At 120 px ("reach") strands launch, one every 30–60 ms: 2 at the edge of reach, up to 6 close in. Each strand lunges with a springy wind-up and overshoot, curls, and coils around a finger of the hand cursor. Neighbouring strands web together. |
| Hold | Strands conserve volume (thinner as they stretch), show beads past 1.5× stretch, and creep under slow pulls (0.25 /s). The web tugs the drawn cursor up to 10 px and tilts it ~20°; the real pointer is never moved. |
| Release | Past 1.6× rest length or 160 px the neck thins over ~100 ms and the strand splits, each half recoiling along its own path (exponential, no overshoot). |
| Hover on the body | The slab rises 14 px (spring ω 11, ζ 0.95), the contact shadow fades into a wider, softer drop shadow. Goo patches drift across the hand. |
| Press | Squashes ~30% in height (ω 30, ζ 0.75). Click fires on the real `<button>` (`venom:activate` custom event). |
| Idle | Every 1.8–2.3 s, 2–3 strands rise 11–20 px from a new spot on the outline and sink back over ~1 s. |
| Reduced motion | `prefers-reduced-motion` disables strands and surface motion; lift and morph remain. |
| Fallback | No WebGL2 → plain CSS black button. |
| Tunables (panel) | reach 120, tendrils 6, snap stretch 1.60, max length 160, viscous flow 0.25, slither 1.0, lunge speed 1.0, magnetism 1.6, web grip 1.0, thickness 1.0, surface pull 1.0, gravity 900, blue sheen 0. |
| Performance claim | ~3 ms/frame on a MacBook; resolution scales down to 80% under load (from the reference docs, not re-measured). |

### Not verified / out of scope

- Exact shader lighting values; the reference's material was not re-measured pixel by pixel.
- Behaviour on touch devices (the reference exposes no touch-specific behaviour).
- SVG label mode (drop/paste an SVG) was not exercised.

## 2. Generalisation decisions

| Reference trait | Component decision | Why |
| --- | --- | --- |
| Full-page WebGL scene | Per-instance Canvas 2D overlay bleeding ~`1.35 × reach + 35` px around the button | Installable as a file; no context limits; many instances per page |
| Cursor replaced by a 3D hand | OS cursor kept; strands coil around it on the canvas | A component cannot hijack the cursor in a product |
| Fixed black pill | `tone` (ink/bone), `size`, `shape`, `finish`, `colors`, CSS variables | Reuse across brands and surfaces |
| 13 sliders | `reach`, `tendrils`, `intensity`, `speed`, `idle`, `lift` | Enough to tune feel; internals (creep, snap ratios, gravity) stay sensible defaults exposed through `StrandField` config for power users |
| Custom `venom:activate` event | Native `onClick`, all native attributes | Standard React API |
| No touch behaviour | Ring burst on touch press and on keyboard activation; no hover lift on touch | Equivalent feedback without hover |
| WebGL fallback | Canvas 2D is universal; `motion="reduced"/"off"` modes | Degradation is about motion, not capability |

## 3. Implementation

- `lib/rounded-outline.ts`: arc-length parameterised outline (point/normal/tangent at `s`, closest point, signed distance). Tested for pills and rounded boxes.
- `lib/strand-field.ts`: `StrandField` class. Strand lifecycle `launch → hold → snap → recoil` and `probe` (idle). Verlet chains of 13 points at 120 Hz substeps (max 6 per frame), distance and bend constraints, root pinned 3 px inside the body, tip pinned to a wrap slot around the pointer. Slack (1.14× distance) so strands curve; slither and magnet accelerations; viscous creep; snap past `snapStretch` or `maxLength`; recoil as a visible-fraction curve. Outputs `bow` (slab lean) and `fizz`. Seeded RNG for deterministic tests.
- `lib/strand-renderer.ts`: ribbons with volume-conserving radii, root fillets, webs between neighbours, fibres on stretched strands, rim highlight toward a light vector, offset shadow, coil arcs around the pointer, fizz strings.
- `lib/pointer-field.ts`: one shared window listener; touch counts as present only while pressed.
- `hooks/use-strand-field.ts`: controller owning the canvas, loop, visibility gating, idle scheduling, colour resolution from CSS variables.
- `components/ui/material-button.tsx`: the control. Motion springs for lift (121/21, from the reference's ω 11 ζ 0.95), press (900/45), shadow cross-fade, pointer sheen; CSS glint via a masked conic gradient; silver label via `background-clip: text` and `color-mix`.

## 4. Verification record (24 Oct 2026)

| Check | Result |
| --- | --- |
| Unit tests (`packages/ui`) | 28 passing: outline geometry, simulation lifecycle, determinism, NaN stress, renderer draw calls, component behaviour (click, keyboard, disabled, loading, ref, asChild, colours, motion modes, reduced-motion media, unmount). |
| Typecheck / lint | Clean for `packages/ui` (strict TS, React hooks rules incl. React Compiler rules). |
| Docs | `/`, `/components`, `/components/material-button`, `/docs`, `/docs/roadmap`, `/r/*.json` all 200. |
| Visual inspection | Strands launch toward the pointer, web, coil at the pointer, stretch and snap on pull-away; idle bursts appear; lift/shadow on hover. Inspected in the desktop browser pane. |
| Registry install | `npx shadcn@latest add http://localhost:3000/r/material-button.json` into `examples/vite-consumer` wrote 9 files and 4 npm deps; `pnpm build` succeeded (414 kB JS, 136 kB gz including React and Motion). |
| E2E | See `STATUS.md` for the latest run. |

## 5. Known gaps vs. the reference

- No cursor morph, no 3D shading, no beads rendered as true geometry (radius modulation only).
- Strands render beneath the control: they never cross the face.
- Performance numbers in the docs are estimates from the playground, not a benchmark suite.
