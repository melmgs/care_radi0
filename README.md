# care_radi0 — cleaned front-end

This folder contains the current front-end files for care_radi0.
It keeps the existing Cloudflare setup intact: `/api/submit`, `/itunes/*` and `/deezer/*` are expected to be handled by the existing Worker.

## Edit the site

- `index.html` — homepage copy and overlay/page markup
- `style.css` — layout, typography, command menu, responsive design
- `script.js` — player, metadata, overlays, command navigation, submissions
- `editorial.json` — agenda and notes content

## Command menu

Desktop shows: `listen`, `agenda`, `submit`, `rotation`, `notes`, `heard`, `instagram`.
On mobile, opening command shows only the search field; type `?` to reveal the same clickable menu.
`notes` and `heard` open dedicated full-screen views instead of previews inside command.

## Local preview

Open this folder in VS Code and use Live Server for visual work.
The radio metadata and artwork proxies may depend on the deployed Cloudflare Worker, so production remains the final functional check.

## Production

Current production URL: `https://care-radi0.dmougas.workers.dev/`

When merging these files into the production repo, do not replace or delete `worker.js`, `wrangler.toml`, D1 bindings, or Cloudflare secrets.
