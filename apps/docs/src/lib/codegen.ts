/**
 * Generates a valid TSX usage snippet from playground values.
 * Props equal to their defaults are omitted; nested dotted props
 * (`colors.surface`) become object literals.
 */

export interface CodegenOptions {
  component: string;
  importPath: string;
  values: Record<string, unknown>;
  defaults: Record<string, unknown>;
  childrenProp?: string;
}

function isDefault(key: string, value: unknown, defaults: Record<string, unknown>) {
  return key in defaults && JSON.stringify(defaults[key]) === JSON.stringify(value);
}

function formatValue(v: unknown): string {
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number" || typeof v === "boolean") return `{${String(v)}}`;
  return `{${JSON.stringify(v)}}`;
}

function setDeep(target: Record<string, unknown>, path: string[], value: unknown) {
  let cur = target;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i]!;
    if (typeof cur[k] !== "object" || cur[k] === null) cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  cur[path[path.length - 1]!] = value;
}

function objectLiteral(obj: Record<string, unknown>): string {
  const parts = Object.entries(obj).map(([k, v]) => {
    const key = /^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k);
    const val = typeof v === "object" && v !== null ? objectLiteral(v as Record<string, unknown>) : JSON.stringify(v);
    return `${key}: ${val}`;
  });
  return `{ ${parts.join(", ")} }`;
}

export function generateUsage({ component, importPath, values, defaults, childrenProp }: CodegenOptions): string {
  const attrs: string[] = [];
  const nested: Record<string, Record<string, unknown>> = {};
  let children: unknown = undefined;

  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === "") continue;
    if (key === childrenProp) {
      children = value;
      continue;
    }
    if (key.includes(".")) {
      const [root, ...rest] = key.split(".");
      if (isDefault(key, value, defaults)) continue;
      nested[root!] ??= {};
      setDeep(nested[root!]!, rest, value);
      continue;
    }
    if (isDefault(key, value, defaults)) continue;
    if (value === true) attrs.push(key);
    else attrs.push(`${key}=${formatValue(value)}`);
  }
  for (const [root, obj] of Object.entries(nested)) {
    if (Object.keys(obj).length) attrs.push(`${root}={${objectLiteral(obj)}}`);
  }

  const propsStr = attrs.length ? (attrs.join(" ").length > 60 ? `\n  ${attrs.join("\n  ")}\n` : ` ${attrs.join(" ")}`) : "";
  const open = attrs.length && propsStr.startsWith("\n") ? `<${component}${propsStr}>` : `<${component}${propsStr}>`;
  const body =
    children === undefined ? `<${component}${propsStr} />` : `${open}\n  ${String(children)}\n</${component}>`;

  return `import { ${component} } from "${importPath}";\n\nexport function Example() {\n  return (\n${indent(body, 4)}\n  );\n}\n`;
}

function indent(s: string, spaces: number) {
  const pad = " ".repeat(spaces);
  return s
    .split("\n")
    .map((l) => (l.length ? pad + l : l))
    .join("\n");
}
