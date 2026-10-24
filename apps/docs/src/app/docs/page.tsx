import type { Metadata } from "next";
import { CodeBlock } from "~/components/docs/code-block";
import { DocsSidebar } from "~/components/site/docs-sidebar";
import { HydrationMarker } from "~/components/site/hydration-marker";
import { registryItemUrl, siteUrl } from "~/lib/registry-url";

export const metadata: Metadata = {
  title: "Docs",
  description: "Getting started with Creative UI: philosophy, installation, theming and motion.",
};

export default function DocsPage() {
  return (
    <div className="mx-auto grid max-w-[1400px] gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <div className="scroll-thin sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto overscroll-contain pb-6 pr-2">
          <DocsSidebar />
        </div>
      </aside>
      <main className="prose-docs min-w-0 max-w-3xl">
        <h1 className="display text-5xl text-ink">Introduction</h1>
        <p className="mt-4 text-lg">
          Creative UI is a source-first library of React components with distinctive, physical
          interactions. It follows the shadcn/ui model: you do not install a package, you install
          files. The code lands in your project, under your aliases, for you to keep and change.
        </p>
        <p>The engineering contract every component follows:</p>
        <ul>
          <li>Real semantics first. A control works fully before any motion is added.</li>
          <li>
            Motion is optional. <code>prefers-reduced-motion</code> and a <code>motion</code> prop
            always give a usable fallback.
          </li>
          <li>
            No continuous work when nothing moves. Animation loops run only while something is
            animating and the element is on screen.
          </li>
          <li>Styling through CSS variables and a small prop surface. No global stylesheet.</li>
          <li>
            SSR and hydration safe. Nothing touches <code>window</code> during render.
          </li>
          <li>
            Each component ships with tests, a playground, examples, an API reference and a
            provenance note.
          </li>
        </ul>

        <h2 id="installation">Installation</h2>
        <p>
          Prerequisites: a React project with Tailwind CSS and a <code>components.json</code>. If
          you have not set up shadcn yet:
        </p>
        <CodeBlock lang="bash" code={`npx shadcn@latest init`} />
        <p>Then add any component by its registry URL:</p>
        <CodeBlock
          lang="bash"
          code={`npx shadcn@latest add ${registryItemUrl("material-button")}`}
        />
        <p>
          The CLI reads the item, installs its npm dependencies, pulls in the registry dependencies
          (shared hooks and lib files) and writes everything under the paths from your{" "}
          <code>components.json</code>: components to <code>components/ui</code>, hooks to{" "}
          <code>hooks</code>, utilities to <code>lib</code>. Imports are rewritten to your aliases.
        </p>
        <p>
          The registry index lives at <a href="/r/registry.json">{siteUrl}/r/registry.json</a>.
          Every item is a plain JSON file you can also read or vendor by hand.
        </p>
        <h3>Source ownership and updates</h3>
        <ul>
          <li>
            Installed files are yours. Nothing is overwritten unless you run <code>add</code> again
            with <code>--overwrite</code>.
          </li>
          <li>
            Each component has a semantic version in its docs and registry metadata. Breaking
            changes bump the major; the changelog on the component page lists migration notes.
          </li>
          <li>
            Shared lib and hook items are versioned together with the components that use them;
            re-adding a component refreshes its dependencies.
          </li>
          <li>
            Premium items will be served from an authenticated registry URL in a later phase; the
            free registry format is identical.
          </li>
        </ul>

        <h2 id="theming">Theming</h2>
        <p>
          Components expose CSS variables prefixed per component (for example <code>--mb-*</code>{" "}
          for the Material Button). Set them on the component, an ancestor, or globally:
        </p>
        <CodeBlock
          lang="css"
          code={`/* brand the material button app-wide */\n[data-slot="material-button"] {\n  --mb-surface: #1d2a6b;\n  --mb-label: #f2f0ff;\n  --mb-ring-offset: var(--background);\n}`}
        />
        <p>
          Props such as <code>colors</code> map onto the same variables, so a one-off override and
          an app-wide theme never conflict. Dark mode needs no special handling: pick the{" "}
          <code>tone</code> that suits the surface, or set the variables under your dark selector.
        </p>

        <h2 id="motion">Motion and accessibility</h2>
        <p>
          Every component reads <code>prefers-reduced-motion</code> through a hydration-safe hook
          and renders a reduced variant: no strands, no idle life, short transitions. Force a
          variant for testing or product reasons with <code>motion=&quot;reduced&quot;</code> or{" "}
          <code>motion=&quot;off&quot;</code>.
        </p>
        <p>
          Keyboard users get equivalent feedback to pointer users where the design allows it (for
          example a press burst on Enter and Space). Touch devices never depend on hover. Focus
          rings are visible for <code>:focus-visible</code> and themeable.
        </p>

        <h2 id="stack">Stack</h2>
        <table>
          <thead>
            <tr>
              <th>Concern</th>
              <th>Choice</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Components</td>
              <td>React 19 + TypeScript, Tailwind v4 utilities, CSS variables</td>
            </tr>
            <tr>
              <td>Springs and transforms</td>
              <td>
                Motion for React (<code>motion</code>)
              </td>
            </tr>
            <tr>
              <td>Physics and goo</td>
              <td>Framework-free TypeScript simulation rendered to Canvas 2D</td>
            </tr>
            <tr>
              <td>Accessibility primitives</td>
              <td>
                Radix Slot for <code>asChild</code>; more Radix primitives as components need them
              </td>
            </tr>
            <tr>
              <td>Distribution</td>
              <td>
                shadcn registry schema, static JSON under <code>/r</code>
              </td>
            </tr>
            <tr>
              <td>Docs</td>
              <td>Next.js 16 App Router; data-driven component pages</td>
            </tr>
            <tr>
              <td>Tests</td>
              <td>Vitest + Testing Library (unit), Playwright (e2e + visual)</td>
            </tr>
          </tbody>
        </table>
      </main>
      <HydrationMarker />
    </div>
  );
}
