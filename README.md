# Long Division Puzzles

A mobile-first static web app for practicing long division by filling missing digits in the divisor, dividend, quotient, and remainder.

## Run locally

```bash
npm start
```

Then open <http://localhost:5173>. The app uses relative asset URLs so it works both locally and under a GitHub Pages project path such as `/suanshi/`.

## Validate

```bash
npm run build
```

The build script performs a JavaScript syntax check, which keeps the app dependency-free and compatible with GitHub Pages static hosting.

## GitHub Pages

This repository includes a GitHub Actions workflow that deploys the static site to GitHub Pages on every push. After the workflow runs, the site is available from the Pages URL shown in the workflow summary, usually:

```text
https://<owner>.github.io/<repo>/
```

If the URL returns 404 after merging, check **Actions → Deploy GitHub Pages** first. A one-time manual setup may be required: open **Settings → Pages**, set **Source** to **GitHub Actions**, save, and rerun **Deploy GitHub Pages** from the default branch. If the workflow still fails, check **Settings → Environments → github-pages** and make sure deployments are not blocked by environment protection rules. The app also includes `404.html` as a static fallback for GitHub Pages project URLs.
