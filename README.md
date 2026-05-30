# TeraBooks Player

A modern, responsive web app that lets you paste a **public** TeraBox share
link and stream the video inside a clean OTT-style player — no redirects,
no full-page TeraBox UI.

> ⚠️ Only **publicly shared** TeraBox links are supported. The app does not
> bypass authentication, password protection, or DRM.

---

## Features

- **Home page** with a glassmorphism search bar and centred hero.
- **History page** with thumbnails, resume position, search, and one-click
  delete.
- **Custom player** (Plyr + hls.js) with:
  - Playback speed: 0.5×, 1×, 1.5×, 1.8×, 2×
  - Quality selector (when multiple are available)
  - Picture-in-picture, fullscreen, AirPlay
  - Keyboard shortcuts (space/→/←/M/F)
  - Buffering indicator and tooltip seek
  - Auto-resume from last watched position
- **Stream proxy** (`/api/stream`) that forwards Range requests and
  attaches the Referer/User-Agent that TeraBox CDNs require.
- **Modular extractor** so you can swap TeraBox API logic in one file when
  it inevitably changes.
- **Black + blue** theme, Framer Motion animations, skeleton loading.
- **Vercel-ready**, no external services required to run locally.

---

## Tech stack

- Next.js 15 (App Router) + React 19
- TypeScript (strict)
- Tailwind CSS
- Plyr + hls.js
- Framer Motion
- localStorage (swappable for a database via the `HistoryStore` interface)

---

## Getting started

```bash
git clone <this-repo>
cd Newterabox
cp .env.example .env.local      # optional — see "Configuration"
npm install
npm run dev
```

Open <http://localhost:3000>, paste a public TeraBox link
(`https://www.terabox.com/s/…`), and click **Play Video**.

### Production build

```bash
npm run build
npm start
```

---

## Configuration

All variables are optional — the app falls back to a built-in extractor
strategy when nothing is set.

| Variable | Purpose |
| --- | --- |
| `TERABOX_EXTRACTOR_URL` | A self-hosted extractor service. `/api/extract` will `POST { url }` to it and expects `{ directUrl, title, thumbnail?, durationSec?, qualities? }`. **Recommended for production** — see the note below. |
| `TERABOX_EXTRACTOR_TOKEN` | Sent as `x-extractor-token` header to the proxy. |
| `TERABOX_USER_AGENT` | Override the User-Agent used when calling TeraBox or the proxy. |
| `NEXT_PUBLIC_SITE_URL` | Public URL used in `<meta>` tags. |

> **Why a proxy?** TeraBox rotates its tokens and endpoints often. Keeping
> the fragile extraction code in a separate, easily-deployable service
> means you can update it independently without redeploying the player.

---

## Architecture

```
src/
├── app/
│   ├── layout.tsx          ← Glass navbar, decorative background, footer
│   ├── page.tsx            ← Home: search + player
│   ├── history/page.tsx    ← History list + search
│   ├── globals.css         ← Tailwind + Plyr brand overrides
│   └── api/
│       ├── extract/route.ts  ← POST { url } → ExtractedVideo
│       └── stream/route.ts   ← GET ?u= → CDN passthrough w/ Range + Referer
├── components/             ← Navbar, SearchBar, VideoPlayer, HistoryCard, …
├── hooks/                  ← useHistory, usePlaybackProgress
├── services/
│   ├── terabox/
│   │   ├── extractor.ts    ← Proxy + Public strategies
│   │   ├── types.ts        ← ExtractionStrategy + ExtractionError
│   │   └── index.ts
│   └── history.ts          ← HistoryStore interface (localStorage impl)
├── utils/                  ← url, format, mockData
└── types/index.ts          ← Shared API types
```

### Where to update when extraction breaks

`src/services/terabox/extractor.ts` is the **only** file that talks to
TeraBox. The frontend never imports from it directly — it only consumes
the typed response from `/api/extract`. Two strategies are tried in order:

1. **`ProxyStrategy`** — used when `TERABOX_EXTRACTOR_URL` is set. Most
   reliable for production; you control the extractor.
2. **`PublicStrategy`** — best-effort scrape of the share page +
   `share/list` + `api/download`. Useful for local development and demos.

When TeraBox changes its parameters, edit one of these strategies (or
add a new one). Nothing else in the app needs to change.

### Swapping localStorage for a database

`src/services/history.ts` exposes a `HistoryStore` interface. The default
export is `localHistoryStore` (browser-only). To add a server-backed
store later:

```ts
// e.g. src/services/history.server.ts
export const remoteHistoryStore: HistoryStore = { /* … */ };
```

Then point `useHistory` and the home page at the new implementation.
No component changes needed.

---

## API reference

### `POST /api/extract`

```jsonc
// Request
{ "url": "https://www.terabox.com/s/1abc…" }

// 200 OK
{
  "id": "surl:1abc…",
  "sourceUrl": "https://www.terabox.com/s/1abc…",
  "title": "MyVideo.mp4",
  "directUrl": "https://d.terabox.com/file/…",
  "thumbnail": "https://…/thumb.jpg",
  "durationSec": 596,
  "sizeBytes": 158000000,
  "qualities": [{ "label": "Auto", "url": "https://…" }],
  "extractedAt": "2026-05-30T09:00:00.000Z"
}

// Errors
{ "error": "URL is not a recognised TeraBox share link", "code": "INVALID_URL" }
```

Status codes: `200` success, `400` invalid/private, `429` rate limited,
`502` upstream failure, `500` other.

### `GET /api/stream?u=<encoded direct URL>`

Range-aware proxy. Only forwards to allowlisted TeraBox/Baidu CDN hosts.
Used internally by the player — you should not need to call it directly.

---

## Deployment (Vercel)

1. Push this repo to GitHub.
2. Import it into Vercel — defaults work (Next.js preset, Node runtime).
3. Set environment variables (optional) in **Project → Settings → Environment Variables**.
4. Deploy.

The `/api/stream` route is `nodejs` runtime (not edge) because it streams
binary bodies with Range support.

---

## Development notes

- **Player is lazy-loaded** (`next/dynamic`) so Plyr and hls.js never ship
  in the initial route bundle.
- **History writes** dispatch a `terabooks:history-updated` `CustomEvent`
  so multiple components stay in sync without a global state library.
- **Resume position** is saved every 5 s, and on `pause`, `ended`,
  `visibilitychange` (hidden), and `beforeunload`.
- **Mock history** is available via the *Load sample data* button on an
  empty History page — handy for design review.

---

## Important notes & limitations

- Only public TeraBox links are supported. Private / password-protected /
  DRM-protected shares are intentionally rejected.
- Direct URLs returned by TeraBox are **short-lived and signed** — do not
  cache the `/api/extract` response on the edge.
- TeraBox CDNs commonly enforce a Referer header; this is why the player
  pipes the URL through `/api/stream` rather than playing it directly.
- The built-in `PublicStrategy` may stop working without warning when
  TeraBox rotates its API. When that happens, update
  `src/services/terabox/extractor.ts` or set `TERABOX_EXTRACTOR_URL`.

---

## License

MIT — for personal use. You are responsible for complying with TeraBox's
terms of service in your jurisdiction.
