# care_radi0

This is the current care_radi0 front-end + Cloudflare Worker setup.

The existing radio infrastructure is unchanged:
- FastCast live stream + metadata
- Apple/iTunes artwork first
- Deezer second
- FastCast artwork only as final fallback
- `/api/submit` -> Cloudflare Worker -> D1
- `/admin/submissions` + CSV export

## The new Programs system

`rotation` has been replaced publicly by **programs**.

Programs are recurring editorial moods / selections, not genres. You can create as many as you want and update them whenever you want without editing HTML.

Everything lives in:

`programs.json`

The starter file includes:
- `new music` — the main rotation, updated every Friday
- `ici ça chiale (╥﹏╥)`
- `slut pop`
- `IM jUst 💅🏻 A GiRl`
- `electronic duos`
- `pitchfork™️`

No tracks have been invented for you; the starter tracklists are empty.

### Create a new program

Duplicate one object inside the `programs` array:

```json
{
  "id": "my-program",
  "title": "my program",
  "description": "whatever this one is about",
  "update_label": "updated whenever",
  "last_updated": "",
  "active": true,
  "featured": false,
  "tracks": []
}
```

Rules:
- `id` must be unique and should not change once the Agenda references it.
- `active: false` hides a program without deleting it.
- `featured: true` labels it as the main rotation.
- `default_program` at the top of `programs.json` controls the default/main program. It currently points to `new-music`.
- `last_updated` is optional and can be any label/date you want displayed.

### Add tracks to a program

```json
"tracks": [
  {
    "artist": "Artist",
    "title": "Track",
    "url": "https://optional-link.example"
  }
]
```

`url` is optional. If present, the track becomes clickable.

The website does **not** invent or automatically populate these program tracklists. They are your editorial selections.

## Agenda + Programs

Agenda/notes still live in:

`editorial.json`

An Agenda item can still use a plain title:

```json
{
  "date": "04.09.26",
  "time": "@ 20:00",
  "title": "guest mix — 001",
  "note": ""
}
```

Or it can reference one of your Programs by ID:

```json
{
  "date": "04.09.26",
  "time": "@ 20:00",
  "program": "slut-pop",
  "note": ""
}
```

The site then automatically pulls the current title from `programs.json`. This means you can rename the program later without rewriting every Agenda entry.

When no Agenda item is scheduled, the code can display the `default_program` as the fallback/main rotation.

Important: this website layer describes the programming. The actual audio scheduling still happens in FastCast; editing `programs.json` does not itself change the FastCast stream schedule.

## Command menu

Desktop/mobile command menu now shows:

`listen`, `agenda`, `submit`, `programs`, `notes`, `heard`, `instagram`

The old typed commands `rotation` / `rotations` still work as aliases, so old muscle memory/bookmarks do not break.

## Main files

- `index.html` — homepage + overlays
- `style.css` — visual design / responsive design
- `script.js` — player, metadata, Programs renderer, Agenda renderer, overlays, submit
- `programs.json` — all Programs and their tracklists
- `editorial.json` — Agenda + Notes
- `worker.js` — proxies, submit API, D1/admin

## Local preview

Use VS Code Live Server or `npm run dev`.

For the closest production behavior, use:

```bash
npm install
npm run dev
```

## Deploy

```bash
npm run deploy
```

Public domain: `https://care-radio.fr/`

## Right now program label

The small label beside the player is automatic. When nothing special is scheduled it uses `default_program` from `programs.json`, so it reads:

`right now : new music rotation`

If an Agenda item references a program, the label switches to that program during its scheduled slot:

```json
{
  "date": "05.09.26",
  "time": "@ 20:00",
  "program": "slut-pop",
  "duration_minutes": 120
}
```

You can also use an explicit end time:

```json
{
  "date": "05.09.26",
  "time": "@ 20:00",
  "end_time": "22:00",
  "program": "slut-pop"
}
```

Priority for a slot end is: `end_time` -> `duration_minutes` -> next program starting within six hours -> one hour fallback. Times are interpreted as Paris time.

`programs.json` also accepts an optional `now_label` if you want custom wording. `new music` currently uses `"now_label": "new music rotation"`.

## v1.4 typography cleanup
The public UI now uses exactly four rendered type sizes: grand / medium / small / micro. Legacy literal `font-size` declarations were removed from `style.css`; all public text maps to those four tokens. Featured programs no longer become a separate oversized heading — emphasis is handled with weight instead of a fifth size.


## v1.6 typography

The public site now uses:

- **Beast Regular** for the GRAND type tier only (logo + full-screen/page titles)
- **Arial Narrow / Arial Condensed system stack** for MEDIUM, SMALL and MICRO
- no Google Fonts dependency on the public frontend

To enable Beast, place your own `Beast-Regular.woff2` at the repo root next to `index.html`. The CSS already references it.
