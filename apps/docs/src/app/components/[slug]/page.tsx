import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { components, getComponent, playgrounds } from "~/content/components";
import { ComponentPlayground } from "~/components/playground/component-playground";
import { ExampleGallery } from "~/components/docs/example-gallery";
import { SourceView } from "~/components/docs/source-view";
import { CodeBlock } from "~/components/docs/code-block";
import { DocBody } from "~/components/docs/doc-section";
import { StatusBadge, TierBadge } from "~/components/docs/badges";
import { DocsSidebar } from "~/components/site/docs-sidebar";
import { HydrationMarker } from "~/components/site/hydration-marker";
import { readUiSource } from "~/lib/source";
import { registryItemUrl } from "~/lib/registry-url";

export function generateStaticParams() {
  return components.filter((c) => c.status !== "planned").map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/components/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const meta = getComponent(slug);
  if (!meta) return {};
  return { title: meta.title, description: meta.tagline };
}

export default async function ComponentPage({ params }: PageProps<"/components/[slug]">) {
  const { slug } = await params;
  const meta = getComponent(slug);
  if (!meta || meta.status === "planned") notFound();

  const playground = playgrounds[meta.slug];
  const sources = meta.sourceFiles.map((path) => ({ path, content: readUiSource(path) }));
  const installUrl = registryItemUrl(meta.registryName ?? meta.slug);

  const toc = [
    playground && { id: "playground", title: "Playground" },
    { id: "examples", title: "Examples" },
    { id: "installation", title: "Installation" },
    { id: "api", title: "API reference" },
    { id: "css-variables", title: "CSS variables" },
    ...meta.sections.map((s) => ({ id: s.id, title: s.title })),
    { id: "source", title: "Source" },
    { id: "provenance", title: "Provenance" },
  ].filter(Boolean) as { id: string; title: string }[];

  return (
    <div className="mx-auto grid max-w-[1400px] gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_200px]">
      <aside className="hidden lg:block">
        <div className="scroll-thin sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto overscroll-contain pb-6 pr-2">
          <DocsSidebar />
        </div>
      </aside>

      <main className="min-w-0">
        <header className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <TierBadge tier={meta.tier} />
            <StatusBadge status={meta.status} />
            <span className="font-mono text-[11px] text-muted">v{meta.version}</span>
          </div>
          <h1 className="display text-5xl text-ink sm:text-6xl">{meta.title}</h1>
          <p className="mt-3 text-lg text-ink-2">{meta.tagline}</p>
          <p className="prose-docs mt-4 max-w-3xl">{meta.description}</p>
        </header>

        {playground && (
          <section id="playground" className="scroll-mt-24">
            <ComponentPlayground meta={meta} def={playground} />
          </section>
        )}

        <section id="examples" className="prose-docs scroll-mt-24">
          <h2>Examples</h2>
          <ExampleGallery slug={meta.slug} examples={meta.examples} />
        </section>

        <section id="installation" className="prose-docs scroll-mt-24">
          <h2>Installation</h2>
          <p>
            Install the source into your project with the shadcn CLI. The item pulls in its registry
            dependencies (hooks and lib files) and npm dependencies automatically.
          </p>
          <CodeBlock lang="bash" code={`npx shadcn@latest add ${installUrl}`} />
          <p>
            Then import it from wherever your <code>components.json</code> aliases point (by default{" "}
            <code>{meta.importPath}</code>).
          </p>
          <CodeBlock
            lang="tsx"
            code={`import { ${meta.name} } from "${meta.importPath}";\n\n<${meta.name}>Let’s collaborate</${meta.name}>`}
          />
          <h3>What gets installed</h3>
          <table>
            <thead>
              <tr>
                <th>Kind</th>
                <th>Items</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Files</td>
                <td>
                  {meta.sourceFiles.map((f) => (
                    <code key={f} className="mr-1.5">
                      {f}
                    </code>
                  ))}
                </td>
              </tr>
              <tr>
                <td>npm dependencies</td>
                <td>
                  {meta.dependencies.npm.map((d) => (
                    <code key={d} className="mr-1.5">
                      {d}
                    </code>
                  ))}
                </td>
              </tr>
              <tr>
                <td>Registry dependencies</td>
                <td>
                  {meta.dependencies.registry.map((d) => (
                    <code key={d} className="mr-1.5">
                      {d}
                    </code>
                  ))}
                </td>
              </tr>
            </tbody>
          </table>
          <p>
            Requirements: React 18.2+ or 19, Tailwind CSS v4 (v3 works with the default shadcn
            setup), TypeScript. Works in Next.js (App and Pages router) and Vite. Mark the importing
            module as a client component in React Server Component setups; the file already carries{" "}
            <code>&quot;use client&quot;</code>.
          </p>
        </section>

        <section id="api" className="prose-docs scroll-mt-24">
          <h2>API reference</h2>
          <table>
            <thead>
              <tr>
                <th>Prop</th>
                <th>Type</th>
                <th>Default</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {meta.props.map((p) => (
                <tr key={p.name}>
                  <td>
                    <code>{p.name}</code>
                  </td>
                  <td>
                    <code>{p.type}</code>
                  </td>
                  <td>{p.default ? <code>{p.default}</code> : "—"}</td>
                  <td>{p.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section id="css-variables" className="prose-docs scroll-mt-24">
          <h2>CSS variables</h2>
          <table>
            <thead>
              <tr>
                <th>Variable</th>
                <th>Purpose</th>
                <th>Default</th>
              </tr>
            </thead>
            <tbody>
              {meta.cssVars.map((v) => (
                <tr key={v.name}>
                  <td>
                    <code>{v.name}</code>
                  </td>
                  <td>{v.description}</td>
                  <td>
                    <code>{v.default}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {meta.sections.map((s) => (
          <section key={s.id} id={s.id} className="prose-docs scroll-mt-24">
            <h2>{s.title}</h2>
            <DocBody body={s.body} />
          </section>
        ))}

        <section id="source" className="prose-docs scroll-mt-24">
          <h2>Source</h2>
          <p>
            These are the exact files the registry installs, read from the repository at build time.
            Copy them if you would rather not use the CLI.
          </p>
          <SourceView files={sources} />
        </section>

        <section id="provenance" className="prose-docs scroll-mt-24">
          <h2>Provenance and licensing</h2>
          <p>{meta.provenance}</p>
        </section>
      </main>

      <aside className="hidden xl:block">
        <nav
          aria-label="On this page"
          className="scroll-thin sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto overscroll-contain text-sm"
        >
          <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted">
            On this page
          </div>
          <ul className="flex flex-col gap-1 border-l border-line">
            {toc.map((t) => (
              <li key={t.id}>
                <a
                  href={`#${t.id}`}
                  className="-ml-px block border-l border-transparent py-0.5 pl-3 text-muted hover:border-ink hover:text-ink"
                >
                  {t.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <HydrationMarker />
    </div>
  );
}
