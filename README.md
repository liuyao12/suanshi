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

If the URL returns 404 after merging, check **Actions → Deploy GitHub Pages** first. If there is no successful run, rerun the workflow manually. If the workflow cannot deploy, open **Settings → Pages**, set **Source** to **GitHub Actions**, and rerun **Deploy GitHub Pages**. The app also includes `404.html` as a static fallback for GitHub Pages project URLs.
