"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import type { ComponentMeta, PlaygroundDef } from "~/content/types";
import { generateUsage } from "~/lib/codegen";
import { highlight } from "~/lib/highlight";
import { CopyButton } from "~/components/docs/copy-button";
import { ControlField } from "~/components/playground/controls";

export type PlaygroundValues = Record<string, unknown>;

export interface PlaygroundProps {
  meta: Pick<ComponentMeta, "name" | "importPath" | "title">;
  def: PlaygroundDef;
  /** Renders the real component for the current values. */
  render: (values: PlaygroundValues, env: PreviewEnv) => ReactNode;
}

export interface PreviewEnv {
  surface: "light" | "dark";
  reducedMotion: boolean;
}

/**
 * Generic playground: schema-driven controls, immediate preview of the real
 * component, generated usage code, presets, reset, and preview environment
 * toggles (surface + simulated reduced motion).
 */
export function Playground({ meta, def, render }: PlaygroundProps) {
  const [values, setValues] = useState<PlaygroundValues>(() => ({ ...def.initial }));
  const [env, setEnv] = useState<PreviewEnv>({ surface: "light", reducedMotion: false });
  const [grid, setGrid] = useState(false);
  const [key, setKey] = useState(0);

  const set = useCallback((prop: string, value: unknown) => {
    setValues((v) => ({ ...v, [prop]: value }));
  }, []);

  const reset = () => {
    setValues({ ...def.initial });
    setKey((k) => k + 1);
  };

  const code = useMemo(
    () =>
      generateUsage({
        component: meta.name,
        importPath: meta.importPath ?? `@/components/ui/${meta.name}`,
        values: env.reducedMotion ? { ...values, motion: "reduced" } : values,
        defaults: def.defaults,
        childrenProp: def.childrenProp,
      }),
    [values, def, meta, env.reducedMotion],
  );

  const groups = useMemo(() => {
    const map = new Map<string, typeof def.controls>();
    for (const c of def.controls) {
      const g = c.group ?? "Props";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(c);
    }
    return [...map.entries()];
  }, [def]);

  return (
    <section aria-label={`${meta.title} playground`} className="overflow-hidden rounded-2xl border border-line bg-card shadow-card">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* preview */}
        <div className="flex min-h-[420px] flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2 text-xs">
            <Segmented
              label="Surface"
              value={env.surface}
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
              onChange={(surface) => setEnv((e) => ({ ...e, surface: surface as PreviewEnv["surface"] }))}
            />
            <Toggle label="Grid" checked={grid} onChange={setGrid} />
            <Toggle
              label="Reduced motion"
              checked={env.reducedMotion}
              onChange={(reducedMotion) => setEnv((e) => ({ ...e, reducedMotion }))}
            />
            <div className="ml-auto flex items-center gap-2">
              {def.presets.length > 0 && (
                <label className="flex items-center gap-1.5 text-muted">
                  <span className="sr-only">Preset</span>
                  <select
                    aria-label="Preset"
                    className="h-7 rounded-md border border-line bg-paper px-2 text-xs text-ink"
                    defaultValue=""
                    onChange={(e) => {
                      const preset = def.presets.find((p) => p.name === e.target.value);
                      if (preset) {
                        setValues({ ...def.initial, ...preset.values });
                        setKey((k) => k + 1);
                      }
                      e.target.value = "";
                    }}
                  >
                    <option value="" disabled>
                      Presets…
                    </option>
                    {def.presets.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                type="button"
                onClick={reset}
                className="h-7 rounded-md border border-line px-2.5 text-xs text-ink-2 hover:bg-paper-2 hover:text-ink"
              >
                Reset
              </button>
            </div>
          </div>
          <div
            data-testid="playground-stage"
            data-surface={env.surface}
            className={`relative flex flex-1 items-center justify-center overflow-hidden p-10 ${
              env.surface === "dark" ? "stage-dark dark" : "stage"
            } ${grid ? "stage-grid" : ""}`}
          >
            <div key={key} className="relative flex w-full justify-center">
              {render(env.reducedMotion ? { ...values, motion: "reduced" } : values, env)}
            </div>
            {env.reducedMotion && (
              <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-line bg-paper/80 px-3 py-1 text-[11px] text-muted backdrop-blur">
                Simulating <code>prefers-reduced-motion</code>: strands off, lift kept short.
              </p>
            )}
          </div>
          <div className="relative border-t border-line">
            <div className="absolute right-2 top-2 z-10">
              <CopyButton text={code} label="Copy code" />
            </div>
            <pre className="code-block scroll-thin m-0 max-h-64 overflow-auto p-4 pr-28" data-testid="playground-code">
              <code dangerouslySetInnerHTML={{ __html: highlight(code.trimEnd(), "tsx") }} />
            </pre>
          </div>
        </div>

        {/* controls */}
        <aside className="scroll-thin max-h-[720px] overflow-y-auto border-t border-line bg-paper-2/60 lg:border-l lg:border-t-0" aria-label="Controls">
          {groups.map(([group, controls]) => (
            <fieldset key={group} className="border-b border-line px-4 py-3">
              <legend className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted">{group}</legend>
              <div className="flex flex-col gap-3">
                {controls.map((c) => (
                  <ControlField key={c.prop} control={c} value={values[c.prop]} onChange={(v) => set(c.prop, v)} />
                ))}
              </div>
            </fieldset>
          ))}
        </aside>
      </div>
    </section>
  );
}

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-line p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded px-2 py-0.5 text-xs transition-colors ${
            value === o.value ? "bg-ink text-paper" : "text-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5 text-muted">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-3.5 accent-[var(--ember)]"
      />
      {label}
    </label>
  );
}
