import type { ComponentMeta, PlaygroundDef } from "~/content/types";

export const flowStackGalleryMeta: ComponentMeta = {
  slug: "flow-stack-gallery",
  name: "FlowStackGallery",
  title: "ThumbnailFlow Gallery",
  tagline: "A gallery where thumbnails flow into a stacked viewer.",
  description:
    "A gallery with a thumbnail strip and a stacked viewer: the active image sits on top of a shallow deck of the next ones. Pick a thumbnail and a copy of it flies from the strip into the top of the deck; next and previous, arrow keys and a horizontal drag shuffle the deck instead, the outgoing image sliding away. The strip is a tablist, the viewer its tabpanel, so keyboard and screen-reader users get a standard, well-known pattern.",
  category: "media",
  tier: "premium",
  status: "experimental",
  version: "0.1.0",
  keywords: ["gallery", "carousel", "thumbnails", "stack", "deck", "images", "lightbox", "media", "swipe"],
  registryName: "flow-stack-gallery",
  importPath: "@/components/ui/flow-stack-gallery",
  dependencies: { npm: ["motion", "clsx", "tailwind-merge"], registry: ["utils", "use-reduced-motion"] },
  props: [
    { name: "items", type: "{ id, src, alt, thumb?, caption? }[]", default: "—", description: "The images. alt is required; it names the thumbnail tab and the active image." },
    { name: "label", type: "string", default: "—", description: "Accessible name of the gallery (required)." },
    { name: "index / defaultIndex / onIndexChange", type: "number / number / (i) => void", default: "— / 0 / —", description: "Controlled or uncontrolled active index." },
    { name: "stackDepth", type: "number", default: "3", description: "How many following images peek out behind the active one." },
    { name: "aspect", type: "string", default: '"4 / 3"', description: "Aspect ratio of the viewer." },
    { name: "thumbSize", type: "number", default: "64", description: "Thumbnail width in px (height is 3:4 of it)." },
    { name: "loop", type: "boolean", default: "true", description: "Wrap from the last image to the first and back." },
    { name: "drag", type: "boolean", default: "true", description: "Horizontal drag on the viewer moves through the deck (60 px or a flick)." },
    { name: "showCaptions", type: "boolean", default: "true", description: "Render the active item's caption under the viewer." },
    { name: "spring", type: '"soft" | "snappy" | "stiff"', default: '"snappy"', description: "Spring feel of the flight and deck shuffle." },
    { name: "motion", type: '"auto" | "reduced" | "off"', default: '"auto"', description: "auto follows prefers-reduced-motion. reduced crossfades without flights or drag physics; off is instant." },
  ],
  cssVars: [
    { name: "--fsg-card", description: "Card background while an image loads", default: "light-dark(rgba(20,19,17,0.06), rgba(236,235,230,0.06))" },
    { name: "--fsg-radius", description: "Viewer and card corner radius", default: "18px" },
    { name: "--fsg-control", description: "Previous/next button background", default: "light-dark(rgba(250,249,246,0.85), rgba(31,31,28,0.88))" },
    { name: "--fsg-foreground", description: "Text and icon colour", default: "light-dark(#141311, #ecebe6)" },
    { name: "--fsg-ring", description: "Selected thumbnail and focus ring colour", default: "light-dark(#141311, #ecebe6)" },
  ],
  examples: [
    {
      id: "basic",
      title: "Lookbook",
      description: "Click thumbnails to fly them in; use the arrows or drag the top image to shuffle the deck.",
      code: `<FlowStackGallery
  label="Lookbook"
  items={photos.map((p) => ({ id: p.id, src: p.url, thumb: p.thumbUrl, alt: p.alt, caption: p.caption }))}
/>`,
    },
    {
      id: "deep",
      title: "Deeper stack, soft spring",
      description: "Five images peek out behind; soft springs suit large photography.",
      code: `<FlowStackGallery label="Archive" items={items} stackDepth={5} spring="soft" aspect="3 / 2" thumbSize={56} />`,
    },
    {
      id: "controlled",
      title: "Controlled with an external list",
      description: "Own the index to sync with other UI, such as a list of titles.",
      code: `const [i, setI] = useState(0);

<FlowStackGallery label="Works" items={items} index={i} onIndexChange={setI} showCaptions={false} />
<ol>{items.map((it, n) => <li key={it.id}><button aria-current={n === i} onClick={() => setI(n)}>{it.alt}</button></li>)}</ol>`,
    },
    {
      id: "nodrag",
      title: "No loop, no drag",
      description: "Edges disable the controls; drag is off for embedded contexts.",
      code: `<FlowStackGallery label="Steps" items={items} loop={false} drag={false} stackDepth={2} />`,
    },
  ],
  sections: [
    {
      id: "anatomy",
      title: "Anatomy and behaviour",
      body: `A \`group\` labelled by \`label\` containing the **viewer** (\`role="tabpanel"\`, focusable, with previous/next buttons and a polite live region announcing "Image n of N"), an optional caption, and the **strip** (\`role="tablist"\` of \`role="tab"\` thumbnails with roving tabindex).

- **Deck**: the active image and up to \`stackDepth\` following ones are absolutely stacked, each scaled down and nudged up a little per step. Changing the index re-targets every card's spring; the outgoing image slides off in the direction of travel and fades.
- **Flight**: selecting a thumbnail (click, or arrows/Home/End on the strip) measures the thumbnail and the viewer and animates a copy from one rectangle to the other on a spring; the real top card stays invisible until the copy lands, and the thumbnail dims while its copy is in the air.
- **Shuffle**: previous/next, Left/Right on the viewer and a drag of 60 px (or a flick) move through the deck without a flight.
- \`data-index\` and \`data-motion\` on the root; \`data-offset\` on deck cards; \`data-selected\` on the active thumbnail.`,
    },
    {
      id: "customization",
      title: "Styling and customization",
      body: `Theme with the \`--fsg-*\` variables; their defaults follow \`color-scheme\` via \`light-dark()\` (Chrome 123+, Safari 17.5+, Firefox 120+; older browsers get the light values). Size the viewer with \`aspect\` and the strip with \`thumbSize\`; the component is \`width: 100%\` of its container. Provide \`thumb\` URLs for the strip to keep it light, and captions as any React node.

Use \`spring="soft"\` and a larger \`stackDepth\` for editorial imagery, \`"stiff"\` and depth 1–2 for product shots. Turn \`drag\` off when the gallery sits inside a horizontally scrolling or draggable surface.`,
    },
    {
      id: "accessibility",
      title: "Accessibility",
      body: `- Tabs pattern: thumbnails are tabs with \`aria-selected\` and \`aria-controls\`; Left/Right move selection (wrapping when \`loop\`), Home/End jump; only the selected thumbnail is in the tab order.
- The viewer is the tabpanel, labelled by the selected tab; it is focusable and takes Left/Right too. Previous/next are labelled buttons, disabled at the edges when not looping.
- Only the top image carries \`alt\`; deck images behind it are \`aria-hidden\`. A polite live region announces the position.
- Every item needs meaningful \`alt\` text: it is the thumbnail's accessible name.
- Reduced motion: no flight and no drag physics, crossfade only; \`motion="off"\` is instant.`,
    },
    {
      id: "performance",
      title: "Performance",
      body: `Thumbnails and deck images beyond the second are \`loading="lazy"\`; the active and next images are eager. Nothing animates at rest. A change runs one spring per visible card plus the flight (transforms, opacity and the flight's box), for a few hundred milliseconds. Measurement for the flight is two \`getBoundingClientRect\` calls on selection only.`,
    },
    {
      id: "browser",
      title: "Browser and device notes",
      body: `- Drag uses Motion's pointer handling and works with mouse, touch and pen.
- The strip scrolls natively (\`overflow-x: auto\`) and keeps the selected thumbnail in view with \`scrollIntoView\`.
- Server rendering outputs the deck at the initial index; no measurement happens until a selection.`,
    },
    {
      id: "limitations",
      title: "Known limitations",
      body: `- Images only (\`src\`/\`alt\`); no arbitrary slide content yet.
- No zoom or lightbox; the viewer is a fixed aspect box.
- The flight uses a plain \`img\` copy, so very large images may decode late on first flight; provide \`thumb\` and reasonable \`src\` sizes.
- Vertical stacks and right-to-left strips are not special-cased.`,
    },
  ],
  sourceFiles: ["components/ui/flow-stack-gallery.tsx", "hooks/use-reduced-motion.ts"],
  provenance:
    "Original implementation. Stacked-card galleries and FLIP-style thumbnail transitions are common techniques; the tabs/tabpanel model follows the WAI-ARIA Authoring Practices. No third-party code. Runtime dependencies: motion (MIT), clsx (MIT), tailwind-merge (MIT).",
};

export const flowStackGalleryPlayground: PlaygroundDef = {
  initial: { stackDepth: 3, aspect: "4 / 3", thumbSize: 64, loop: true, drag: true, showCaptions: true, spring: "snappy" },
  defaults: { stackDepth: 3, aspect: "4 / 3", thumbSize: 64, loop: true, drag: true, showCaptions: true, spring: "snappy", motion: "auto", defaultIndex: 0 },
  controls: [
    { type: "range", prop: "stackDepth", label: "Stack depth", group: "Deck", min: 0, max: 5, step: 1 },
    { type: "select", prop: "aspect", label: "Viewer aspect", group: "Deck", options: [{ label: "4 / 3", value: "4 / 3" }, { label: "16 / 9", value: "16 / 9" }, { label: "1 / 1", value: "1 / 1" }] },
    { type: "range", prop: "thumbSize", label: "Thumbnail size", group: "Strip", min: 40, max: 120, step: 4, unit: "px" },
    { type: "boolean", prop: "showCaptions", label: "Captions", group: "Strip" },
    { type: "boolean", prop: "loop", label: "Loop", group: "Behaviour" },
    { type: "boolean", prop: "drag", label: "Drag", group: "Behaviour" },
    { type: "select", prop: "spring", label: "Spring", group: "Motion", options: [{ label: "Soft", value: "soft" }, { label: "Snappy", value: "snappy" }, { label: "Stiff", value: "stiff" }] },
  ],
  presets: [
    { name: "Default", values: {} },
    { name: "Editorial", values: { stackDepth: 5, spring: "soft", aspect: "16 / 9", thumbSize: 56 } },
    { name: "Product", values: { stackDepth: 1, spring: "stiff", aspect: "1 / 1", loop: false } },
  ],
};
