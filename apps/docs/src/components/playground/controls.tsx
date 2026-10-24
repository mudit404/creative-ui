"use client";

import { useId } from "react";
import type { ControlDef } from "~/content/types";

export function ControlField({
  control,
  value,
  onChange,
}: {
  control: ControlDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const id = useId();
  const base = "h-8 w-full rounded-md border border-line bg-paper px-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-ember/60";

  switch (control.type) {
    case "select":
      return (
        <Field id={id} label={control.label}>
          <select id={id} className={base} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
            {control.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      );
    case "boolean":
      return (
        <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-3 text-sm text-ink-2">
          <span>{control.label}</span>
          <input
            id={id}
            type="checkbox"
            role="switch"
            aria-checked={!!value}
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="size-4 accent-[var(--ember)]"
          />
        </label>
      );
    case "range":
      return (
        <Field id={id} label={control.label} hint={`${value ?? control.min}${control.unit ?? ""}`}>
          <input
            id={id}
            type="range"
            min={control.min}
            max={control.max}
            step={control.step}
            value={Number(value ?? control.min)}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full accent-[var(--ember)]"
          />
        </Field>
      );
    case "text":
      return (
        <Field id={id} label={control.label}>
          <input
            id={id}
            type="text"
            className={base}
            placeholder={control.placeholder}
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
          />
        </Field>
      );
    case "color":
      return (
        <Field id={id} label={control.label}>
          <div className="flex items-center gap-2">
            <input
              id={id}
              type="color"
              aria-label={control.label}
              value={typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
              onChange={(e) => onChange(e.target.value)}
              className="size-8 cursor-pointer rounded-md border border-line bg-paper p-0.5"
            />
            <input
              type="text"
              aria-label={`${control.label} value`}
              className={base + " font-mono text-xs"}
              value={String(value ?? "")}
              placeholder="inherit"
              onChange={(e) => onChange(e.target.value)}
            />
          </div>
        </Field>
      );
  }
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm text-ink-2">
          {label}
        </label>
        {hint && <span className="font-mono text-[11px] text-muted">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
