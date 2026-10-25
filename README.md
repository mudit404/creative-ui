# Creative UI

A source-first React component library of production-ready creative interactions. Components install into your project as files through a shadcn-compatible registry; you own the code.

Working name: `creative-ui` (replace before publishing).

## What is here

| Path                            | What it is                                                                                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/ui/src`               | The distributable source tree: `components/ui`, `hooks`, `lib`. The registry serves exactly these files.                                                                              |
| `apps/docs`                     | Next.js 16 documentation site: landing, component explorer, per-component pages with a live playground, examples, API reference, source view. Also hosts the registry at `/r/*.json`. |
| `registry/registry.json`        | Registry definition (shadcn schema). `scripts/build-registry.ts` inlines sources and writes `apps/docs/public/r`.                                                                     |
| `scripts/scaffold-component.ts` | `pnpm scaffold <slug> <Name>` creates component, tests, docs data, live renderers and registry entry in one go.                                                                       |
| `tests/e2e`                     | Playwright: developer journey, playground, registry, touch, visual baselines.                                                                                                         |
| `examples/vite-consumer`        | A clean Vite app used to prove `npx shadcn add <url>` installs and builds.                                                                                                            |
| `documentation/`                | Architecture, decisions, component contract, roadmap, agent guide, spec gaps, component briefs.                                                                                       |

## Requirements

Node 24 (see `.nvmrc`), pnpm 12.

```bash
nvm use
corepack disable 2>/dev/null; npm i -g pnpm   # if pnpm is missing
pnpm install
```

## Commands

```bash
pnpm dev              # docs site at http://localhost:3000 (builds the registry first)
pnpm build            # registry + docs production build
pnpm test             # unit tests (Vitest, packages/ui)
pnpm test:e2e         # Playwright against a production build on :3100
pnpm typecheck        # all packages
pnpm lint             # all packages
pnpm build:registry   # write apps/docs/public/r/*.json (REGISTRY_URL sets the public base)
pnpm check:registry   # validate registry.json and import boundaries
pnpm scaffold liquid-switch LiquidSwitch --category inputs --tier free
```

Run e2e against the dev server instead of a production build:

```bash
BASE_URL=http://localhost:3000 pnpm test:e2e
```

## Installing a component into another app

```bash
npx shadcn@latest add http://localhost:3000/r/material-button.json
```

Set `NEXT_PUBLIC_SITE_URL` / `REGISTRY_URL` to the deployed origin before `pnpm build` so item URLs and install snippets point at production.

## Status

See `documentation/STATUS.md` for what is implemented and verified versus proposed.

## License

Copyright © 2026 Mudit Gupta. All rights reserved. This repository is proprietary; see [LICENSE](LICENSE). No permission to use, copy, modify or distribute any part of it is granted without the copyright holder's prior written consent. Third-party dependencies keep their own licences.
