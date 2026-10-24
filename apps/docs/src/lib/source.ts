import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Root of the distributable source tree (the files the registry serves). */
export const UI_SRC = join(process.cwd(), "..", "..", "packages", "ui", "src");

/** Read a component source file at build time. Throws if missing, so docs never drift silently. */
export function readUiSource(relativePath: string): string {
  return readFileSync(join(UI_SRC, relativePath), "utf8");
}
