# magnetitebrowser.org

The website of the [Magnetite browser](https://github.com/magnetite-browser/magnetite):
a site without cookies. Images, stylesheets, the font and the site's own
scripts all come from the site itself. The one request a visitor's browser
makes to another server is the visitor statistics script, from our own Umami
server.

Stack: [Astro](https://astro.build) and Tailwind CSS, with pnpm. The pages
are rendered on the server for every request (`output: "server"`, the Node
adapter), because they show two things from GitHub: the repository's stars
in the header, and the latest release in the download links. The server asks
GitHub for each at most once in 15 minutes and keeps the answers in memory
(`src/github.ts`), so a visitor's browser never contacts GitHub, and a page
never waits for it once a value is known. Without an answer from GitHub the
header shows no count and the links name `FALLBACK_VERSION` (`src/site.ts`). Astro gives shared layouts and components for the pages, typed
constants for every link and fact, and bundles the one small script they
share into a file. The pages use no client framework. The one exception is
the live demo, a page of its own (`/demo/`): it runs the app's sidebar, which
is written in React.

## What the site promises

`src/pages/privacy.astro` says what the site does with a visitor's data, and
the build holds the pages to it (`scripts/check-links.mjs`, the
Content-Security-Policy):

- No cookies, and nothing stored in the browser.
- Nothing loaded from another server, with one exception: the visitor
  statistics script from our own Umami server (`STATS` in `src/site.ts`,
  added in `src/layouts/Base.astro`). It is in built pages only and counts
  visits to magnetitebrowser.org only (`data-domains`), so local builds and
  previews are not counted. The live demo's page does not load it.

A change that makes one of these untrue changes the privacy policy with it.

## Design and motion

The idea is magnetism: the icon is an iron ring wound with copper wire, and
the hero is a live field of iron filings (`src/scripts/field.ts`, canvas)
that bends around the icon and follows the pointer. Entrances follow the
scroll position with CSS scroll-driven animations (`animation-timeline:
view()`); browsers without them get one-off reveals from
`src/scripts/motion.ts`, which also runs the card spotlights, the magnetic
buttons and the icon's tilt. The sync diagram is HTML and CSS drawn for this
site, moving in plain CSS. Moving between pages keeps the header in place
and fades the content (cross-document view transitions in
`src/styles/global.css`; browsers without them just load the next page).

Palette: the app's graphite and brass (`app/index.css`) on a deeper ink,
copper from the icon, steel grey for weak field lines. Headings: Bricolage
Grotesque (SIL OFL 1.1, self-hosted through
`@fontsource-variable/bricolage-grotesque`); body text: the system font.

### The tour and the live demo

The tour on the home page shows Magnetite itself, not a drawing of it.
`/demo/` (`src/demo/`) runs the app's own sidebar, command bar and Settings:
`app/` is a copy of that code from the browser's repository (alias `@app`;
`app/README.md` says where it comes from and how to renew it). What the app
draws natively is drawn in `Demo.tsx` to the engine's measurements: the
window, the page area, split panes, the peek. `host.ts` stands in for the
Rust side: it keeps a sample state (`world.ts`: invented tabs on
example.org, sample pages in `pages.tsx`) and answers the sidebar's
commands, so the page works when clicked. Nothing in it is loaded from the
web, and it stores nothing: the sidebar's use of `localStorage` is kept in
memory there.

The home page embeds that page in a frame (`/demo/?film`) and directs it:

- `src/demo/film.ts` (in the frame) defines the scenes. A tour scene is a
  function from its progress (0 to 1) to what the window shows, plus the
  path of a pointer and labels for keys, so it plays backwards as well as
  forwards. A scene of the smaller features starts from a state and is then
  played by using the window: where its pointer clicks, the element under
  it is really clicked.
- `src/scripts/film.ts` (on the page) picks scene and progress. On large
  screens the window is pinned and the scroll position is the playhead; on
  small ones it stays in the page and plays by itself while on screen. A
  camera (one CSS transform) moves the window so that the part a scene is
  about fills the view; the scenes, their captions and those parts are
  listed in `src/pages/index.astro`.
- The frame is added by the script when the tour comes near, and is `inert`:
  it never takes the keyboard or the pointer. Until it runs, and without
  JavaScript, `public/tour.webp` is shown in its place.
- The smaller features further down have a second frame: a large window
  beside their cards that plays the scene of the card being pointed at
  (`showcase` in `src/scripts/film.ts`). Each card shows one piece of the
  real interface, a picture cut out of the window at a moment of its scene
  (`public/cards/`).

The sidebar asks for site icons at `/favicons/<host>.png` and for extension
icons at `/ext-icons/<id>`, as it does in the app. Here those are folders of
sample icons, drawn by `scripts/make-demo-icons.mjs`. After renewing `app/`
or changing the demo's sample tabs, run `scripts/make-images.sh` with the
site running to renew `public/tour.webp` and the cards' pictures. The
pictures are taken with WebKit, which breaks some lines differently from
Chromium, so each card names its piece by a CSS selector and the demo says
where that is.

- Without JavaScript every word is visible, with a picture of the window in
  place of the live one; only the canvas and the pointer effects are missing.
- With "reduce motion" set, nothing loops, nothing follows the scroll and
  nothing is hidden for an entrance; the tour shows one still per scene.
- The canvas, the CSS loops and the tour pause while off screen or in a
  hidden tab.

## Develop

```sh
pnpm install
pnpm dev            # http://localhost:4321, reloads on save
```

`app/` is compiled with this project's own React. `react`, `react-dom` and
`lucide-react` here follow the versions the browser uses
(`crates/ui/web/package.json` in its repository).

Astro's anonymous telemetry is turned off in every script
(`ASTRO_TELEMETRY_DISABLED=1`). To turn it off for the machine too:
`pnpm astro telemetry disable`.

## Build and check

```sh
pnpm build            # astro check (types) + astro build + scripts/check-links.mjs
pnpm check:external   # also requests every external link once
pnpm preview          # runs the build (server.mjs) on http://localhost:8080
```

`scripts/check-links.mjs` starts the built server on a free local port, reads
every page reachable from the home page, the live demo and the 404 page, and
fails the build if:

- an internal link, `#anchor` or canonical address points nowhere,
- a link to a file in the browser's or the sync server's repository names a
  file that does not exist, when those repositories are checked out next to
  this one (`../magnetite`, `../magnetite-sync`),
- a page loads anything from another origin other than the statistics
  script, has an inline `<script>` or an inline `style=""` (the CSP blocks
  both), contains `<iframe>`, `<embed>` or `<object>`, or lacks the CSP meta
  tag. (The tour's frame is added by the script; the CSP lets a page frame
  this site's own pages only.)

The output is `dist/`: `dist/client/` holds the files served as they are
(CSS, the scripts and the font under `/_astro/`, icons, the pictures, the
Open Graph image, the sitemap), about 1.6 MB, most of it the OG image, the
font and the live demo's script (about 415 KB with the app's Settings pages,
loaded only by the frames, once they come near). `dist/server/` is the code
that renders the pages; it carries its own dependencies.

## Deploy

`server.mjs` is the web server: Astro's handler for the files and the pages,
plus what that leaves out, the security headers on every response and
compression (the one package needed at run time, `compression`). The
`Dockerfile` builds the site (the same `pnpm build`, checks included) and
puts `dist/`, `server.mjs` and that package into a Node image, which serves
on port 8080. That is plain HTTP, for a reverse proxy that holds the
certificate. The container runs as an unprivileged user and writes nothing:
no volumes, no settings, and a read-only root file system works. It makes one
kind of outgoing request: to `api.github.com`, for the stars and the latest
release.

```sh
docker build -t magnetite-website .
docker run --rm --read-only --cap-drop ALL -p 8080:8080 magnetite-website
scripts/smoke-test.sh magnetite-website   # starts it and checks pages and headers
```

The deployment builds the image from `main` whenever the repository changes;
there are no versions and no tags. CI builds the same image for every pull
request and runs the smoke test on it.

In front of the container:

- `www.magnetitebrowser.org` redirects to `magnetitebrowser.org`.
- The server here writes no access log. What the reverse proxy logs, and for
  how long, is what the privacy policy states (`HOSTING` in `src/site.ts`).

The headers every response gets (`server.mjs`), and the pages' own policy
(`src/middleware.ts`):

```
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=()
Cross-Origin-Opener-Policy: same-origin
Strict-Transport-Security: max-age=31536000
Cache-Control: public, max-age=31536000, immutable    # only for /_astro/*
Content-Security-Policy: default-src 'none'; script-src 'self' https://umami.stack-forge.cloud; connect-src https://umami.stack-forge.cloud; img-src 'self'; style-src 'self'; font-src 'self'; frame-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'    # pages only
```

`script-src` and `connect-src` name the statistics server. `frame-src 'self'`
and `frame-ancestors 'self'` are for the tour: the home page frames this
site's own `/demo/` page, and nothing else may frame or be framed. The
policy is written once, in `src/csp.ts`: every page carries it as a `<meta>`
tag and gets it as a header, where `frame-ancestors` is added (it only works
as a header); the smoke test compares the two.

## Facts in `src/site.ts`

Every fact the pages state about the project lives there, so a change is
made once.

| Constant | What | Used on |
|---|---|---|
| `GITHUB_REPO` | `"owner/repo"` of the browser on GitHub. Every GitHub link, the Releases links and the Homebrew tap (`brew install --cask <owner>/magnetite/magnetite`) derive from it. | everywhere |
| `FALLBACK_VERSION` | The release the pages link to if GitHub cannot be reached when the server starts. Otherwise the server asks GitHub for the latest published release (`src/github.ts`) and the download buttons link straight to its files, `…/releases/download/v<version>/<asset>`. Raise it by hand now and then. | download page, home page |
| `SECURITY_CONTACT` | Where to report vulnerabilities; same value as in the browser's `SECURITY.md`. | security page |
| `LEGAL` | The company that provides the site and publishes Magnetite, as in its own imprint. | imprint, privacy policy |
| `HOSTING` | Where the site runs and how long server logs are kept. | privacy policy |
| `STATS` | The statistics server and this site's id there. | every page, privacy policy |

When one of these changes in the real world (a new address, another hosting
location, other log retention), the pages follow from here; the privacy
policy's date is set by hand.

With the first release, check `PLATFORMS` against the asset names the
browser's `scripts/release/` produces, and the requirements (macOS 13 comes
from `packaging/homebrew/magnetite.rb.template` there).

## Layout

```
src/site.ts                 facts and links (one place to change them)
src/github.ts               the repository's stars and latest release, asked by the server and kept in memory
src/csp.ts, middleware.ts   the pages' Content-Security-Policy and the header that sends it
src/i18n/ui.ts              strings for header and footer, typed per language
src/layouts/Base.astro      <head> (CSP, Open Graph, statistics script), header, footer, motion script
src/components/             header, footer, logo, sync diagram, terminal
src/scripts/                field.ts (hero canvas), motion.ts (reveals, pointer), film.ts (the tour, the
                            smaller features)
src/demo/                   the live demo: the app's sidebar on sample tabs (see above)
app/                        the app's interface code, copied from the browser's repository (app/README.md)
src/brand/                  the icon as SVG (designer's file), inlined by Logo.astro
src/pages/                  index, demo, download, privacy, imprint, license, security, 404
src/styles/global.css       Tailwind, palette, buttons, glass, reveals
public/                     logo.svg, favicon.svg/.ico, apple-touch-icon.png, og.png, tour.webp, robots.txt,
                            favicons/, ext-icons/, cards/
server.mjs, Dockerfile      the web server and the image the deployment runs (see Deploy)
scripts/check-links.mjs     post-build checks (see above)
scripts/smoke-test.sh       starts a built image and checks its pages and headers
scripts/og.html             source of og.png; scripts/make-images.sh renders it, tour.webp and cards/ (macOS)
scripts/render.swift        renders a local HTML file or a page to PNG with WebKit
scripts/make-card-pictures.mjs  takes the feature cards' pictures from the live demo
scripts/make-demo-icons.mjs draws the demo's sample icons into public/favicons/ and public/ext-icons/ (macOS)
```

The icon (`src/brand/magnetite.svg`, the same file as `public/logo.svg` and
`public/favicon.svg`) is the rounded variant of the designer's icon set and is
used at every size; `public/favicon.ico` (16, 32 and 48 px as PNG entries) and
`public/apple-touch-icon.png` (180 px) are renderings of it. The set's small
variant is older artwork and not used. The square variant and the `.icns`
belong to the app packaging, not here.

## Adding German later

1. Add `"de"` to `i18n.locales` in `astro.config.mjs` and a `de` dictionary to
   `src/i18n/ui.ts` (TypeScript then demands every key).
2. Put the translated pages under `src/pages/de/` and pass `lang="de"` to
   `<Base>`; links go through `localizePath`.
3. Add a language link to the header and `hreflang` alternates to
   `Base.astro`. The imprint and privacy policy need a legal review in German.

## Licence

EUPL-1.2 (`LICENSE`), like the browser. The licence covers the code and the
image files; it does not give the right to use the name "Magnetite" or its
logo for something else (the licence page, `src/pages/license.astro`, says
what that means). Contributing: `CONTRIBUTING.md`.
