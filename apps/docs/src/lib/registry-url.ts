/**
 * Public base URL of this site. The registry build and the install snippets
 * must agree, so both read NEXT_PUBLIC_SITE_URL (default: local dev server).
 */
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export function registryItemUrl(name: string): string {
  return `${siteUrl}/r/${name}.json`;
}
