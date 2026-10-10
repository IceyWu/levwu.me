# Hi, there 🥳

My personal website, built with [Astro](https://astro.build/).

## Requirements

- Node.js >= 24
- pnpm 11.17.0

## Development

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Useful checks and build commands:

```bash
pnpm check
pnpm lint
pnpm build
```

## Environment variables

Copy `.env.example` to `.env` when local GitHub data is needed. `MY_TOKEN` is optional; it is used at build time for the homepage language/repository statistics and the Projects page repository/contribution data. The site uses public or fallback data when the token is unavailable.

## Deployment

Photo previews load public file details from `https://api.lpalette.cn/api/v1/files/{uid}?fields=full`. The information panel shows camera/lens, exposure settings, colors, file information, and location using the same layout as LifePalette Web. Set `PUBLIC_MAPBOX_TOKEN` to a public Mapbox token (`pk.*`) in `.env` locally and in the GitHub repository secret of the same name for deployment. Without the token, location text and coordinates remain available. Restrict token usage to the site and development domains; the public token is included in browser assets.

Pushes to `master` trigger `.github/workflows/deploy.yml`, which builds the site and deploys `dist/` to GitHub Pages. Configure the optional `MY_TOKEN` repository secret to enable authenticated GitHub data during deployment. Pull requests targeting `master` run the check, lint, and build workflow in `.github/workflows/ci.yml`.
