# care_radi0 — Cloudflare edition

This folder is the current care_radi0 site migrated from Netlify to Cloudflare Workers + Static Assets.

## What changed

- Static site moved into `public/`.
- Apple/iTunes and Deezer cover proxies are now handled by `src/worker.js`.
- Netlify Forms was removed.
- Music submissions now go to `/api/submit` and are stored in a Cloudflare D1 database.
- The D1 database is declared without an ID so Wrangler/Cloudflare can automatically provision it on first deploy.
- `/admin/submissions` is a private submissions viewer once `ADMIN_PASSWORD` is added as a Cloudflare secret.
- `/admin/submissions.csv` downloads the latest 200 submissions.
- The old hard-coded Netlify share URL was replaced with the current site origin.
- Stale Netlify canonical/OG URL tags were removed. Add the final Cloudflare/custom-domain URL after launch.
- Fixed asset-name mismatches: `og-image.png` and `apple-touch-icon.png` now actually exist.

## Important: do not put ADMIN_PASSWORD in GitHub

After the first deploy, create a Cloudflare Secret named:

`ADMIN_PASSWORD`

Choose your own strong password. The admin username is always:

`care`

Then open:

`https://YOUR-SITE/admin/submissions`

Your browser will ask for username/password.

## Local preview

For ordinary visual work, VS Code + Live Server still works for the static site.

For the Cloudflare routes (`/itunes`, `/deezer`, `/api/submit`, `/admin`), use:

```bash
npm install
npm run dev
```

## Deploy

Recommended: put this whole folder in a GitHub repository, then in Cloudflare:

Workers & Pages → Create application → Import a repository.

The deploy command can stay:

`npx wrangler deploy`

No build command is required.

Cloudflare should automatically provision the D1 binding declared in `wrangler.jsonc` on the first deploy.

## After first deploy

1. Test player and artwork.
2. Submit a test track through the form.
3. Add the `ADMIN_PASSWORD` secret in Worker Settings → Variables and Secrets.
4. Open `/admin/submissions` and confirm the test submission is there.
5. Send the final `*.workers.dev` URL back to ChatGPT so the canonical/OG URLs can be finalized.
