// The sample pages the demo's tabs show. They stand in for websites: written
// for this demo, with invented names, and nothing in them is loaded from
// anywhere (styles in demo.css, classes `pg-…`).
import { useLayoutEffect, useState, type ReactNode } from "react";
import { SettingsPage } from "@app/SettingsPage";
import { hostOf } from "@app/bridge";
import { peek } from "./host";
import { pageFor, titleOf, urlOf, type SiteId } from "./world";

/** A link inside a sample page: it opens its page as a peek, like a Shift-click in the app. */
function PeekLink({ to, children }: { to: SiteId; children: ReactNode }) {
  const open = () => peek(titleOf(to), urlOf(to));
  return (
    <a role="link" tabIndex={0} data-peek-link={to} onClick={open} onKeyDown={(e) => e.key === "Enter" && open()}>
      {children}
    </a>
  );
}

const ROADMAP: { when: string; note: string; items: { title: string; area: string; done: number }[] }[] = [
  {
    when: "Now",
    note: "Winter",
    items: [
      { title: "Offline maps for saved routes", area: "Maps", done: 80 },
      { title: "Shared notebooks", area: "Sync", done: 55 },
      { title: "Faster photo import", area: "Media", done: 35 },
    ],
  },
  {
    when: "Next",
    note: "Spring",
    items: [
      { title: "Tablet layout", area: "Design", done: 20 },
      { title: "Export to GPX and PDF", area: "Files", done: 10 },
      { title: "Weather along the route", area: "Maps", done: 0 },
    ],
  },
  {
    when: "Later",
    note: "",
    items: [
      { title: "Voice notes", area: "Media", done: 0 },
      { title: "Public trail pages", area: "Sharing", done: 0 },
    ],
  },
];

function Roadmap() {
  return (
    <article className="pg pg-roadmap">
      <header className="pg-bar">
        <strong>Fieldbook</strong>
        <span>Roadmap</span>
        <span>Changelog</span>
        <span>Feedback</span>
      </header>
      <div className="pg-body">
        <h1>Roadmap 2027</h1>
        <p className="pg-lead">What the team is building, in the order we plan to ship it. Updated every second Friday.</p>
        <div className="pg-columns">
          {ROADMAP.map((col) => (
            <section key={col.when}>
              <h2>
                {col.when} <small>{col.note}</small>
              </h2>
              {col.items.map((it) => (
                <div key={it.title} className="pg-card">
                  <span className="pg-tag">{it.area}</span>
                  <p>{it.title}</p>
                  <progress value={it.done} max={100} aria-label={`${it.done}% done`} />
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}

function Notes() {
  return (
    <article className="pg pg-doc">
      <div className="pg-body">
        <p className="pg-kicker">Team notes · Monday</p>
        <h1>Weekly notes</h1>
        <h2>Decisions</h2>
        <ul>
          <li>Offline maps ship first; shared notebooks follow two weeks later.</li>
          <li>The beta stays invite-only until the import is twice as fast.</li>
          <li>
            Closed tabs are archived, not thrown away. The reasoning is in the <PeekLink to="design">archive design note</PeekLink>.
          </li>
        </ul>
        <h2>This week</h2>
        <ul className="pg-checks">
          <li data-done>Review the drag-and-drop fix</li>
          <li data-done>Write the release notes</li>
          <li>Retry sync when the server answers 503</li>
          <li>Plan the tablet layout</li>
        </ul>
        <h2>Open questions</h2>
        <p>Do we need a tablet layout before spring, or is a wider sidebar enough for now? Bring numbers on screen sizes to Thursday’s call.</p>
      </div>
    </article>
  );
}

function DesignNote() {
  return (
    <article className="pg pg-doc">
      <div className="pg-body">
        <p className="pg-kicker">Design note</p>
        <h1>Why closed tabs go to an archive</h1>
        <p>
          People keep tabs open because closing one feels like losing it. So closing never deletes anything: the tab moves to a local
          archive, and one shortcut brings the last one back.
        </p>
        <h2>What tidies itself</h2>
        <ul>
          <li>A tab opened today that nobody looks at for 12 hours is archived on its own.</li>
          <li>Pinned tabs and favorites are never archived. They are the things you decided to keep.</li>
          <li>The archive is searchable from the command bar and is kept for 90 days.</li>
        </ul>
        <h2>What it costs</h2>
        <p>A few kilobytes per tab: its address, its title and when it was closed. Nothing leaves the computer.</p>
      </div>
    </article>
  );
}

const REVIEWS: Record<string, { number: number; title: string; branch: string; summary: string; file: string; diff: [" " | "+" | "-", string][]; checks: [string, boolean][] }> = {
  [urlOf("mr482")]: {
    number: 482,
    title: "Fix tab drag on hover",
    branch: "fix/drag-hover",
    summary: "A tab dragged over a folder opened it on the first frame. It now waits until the pointer has rested there.",
    file: "src/sidebar/drag.ts",
    diff: [
      [" ", "function onDragOver(row: Row, at: Point) {"],
      ["-", "  if (row.isFolder) row.open();"],
      ["+", "  if (!row.isFolder) return;"],
      ["+", "  hover.start(row, at);"],
      ["+", "  if (hover.restedFor(row) > 350) row.open();"],
      [" ", "}"],
    ],
    checks: [
      ["Unit tests", true],
      ["Lint", true],
      ["Build (macOS, Linux)", false],
    ],
  },
  [urlOf("mr479")]: {
    number: 479,
    title: "Retry sync on 503",
    branch: "fix/sync-retry",
    summary: "The sync client gave up when the server was restarting. It now retries with a growing delay, three times at most.",
    file: "src/sync/client.ts",
    diff: [
      [" ", "const res = await send(batch);"],
      ["-", "if (!res.ok) throw new SyncError(res.status);"],
      ["+", "if (res.status === 503 && attempt < 3) {"],
      ["+", "  await sleep(500 * 2 ** attempt);"],
      ["+", "  return push(batch, attempt + 1);"],
      ["+", "}"],
    ],
    checks: [
      ["Unit tests", true],
      ["Lint", true],
      ["Build (macOS, Linux)", true],
    ],
  },
};

REVIEWS[urlOf("mr485")] = {
  number: 485,
  title: "Faster photo import",
  branch: "perf/photo-import",
  summary: "Thumbnails were made one by one on the main thread. They are now made in a pool of workers, four at a time.",
  file: "src/import/photos.ts",
  diff: [
    [" ", "export async function importAll(files: File[]) {"],
    ["-", "  for (const file of files) await thumbnail(file);"],
    ["+", "  const pool = new Pool(4);"],
    ["+", "  await Promise.all(files.map((f) => pool.run(thumbnail, f)));"],
    [" ", "}"],
  ],
  checks: [
    ["Unit tests", true],
    ["Lint", true],
    ["Build (macOS, Linux)", true],
  ],
};

function Review({ url }: { url: string }) {
  const mr = REVIEWS[url];
  if (!mr) return null;
  return (
    <article className="pg pg-review">
      <header className="pg-bar">
        <strong>studio / app</strong>
        <span>Code</span>
        <span>Issues</span>
        <span data-on>Merge requests</span>
        <span>Pipelines</span>
      </header>
      <div className="pg-body">
        <h1>
          {mr.title} <small>!{mr.number}</small>
        </h1>
        <p className="pg-meta">
          <span className="pg-state">Open</span>
          Sam wants to merge <code>{mr.branch}</code> into <code>main</code>
        </p>
        <p>{mr.summary}</p>
        <div className="pg-diff">
          <div className="pg-file">{mr.file}</div>
          <pre>
            {mr.diff.map(([sign, line], i) => (
              <span key={i} data-sign={sign}>
                {sign} {line}
                {"\n"}
              </span>
            ))}
          </pre>
        </div>
        <ul className="pg-checklist">
          {mr.checks.map(([name, done]) => (
            <li key={name} data-done={done || undefined}>
              {name}
              <small>{done ? "passed" : "running"}</small>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function Article() {
  return (
    <article className="pg pg-article">
      <div className="pg-body">
        <p className="pg-kicker">Notebook · 8 min read</p>
        <h1>Error handling in Rust</h1>
        <p className="pg-lead">Rust has no exceptions. A function that can fail says so in its type, and the caller decides what happens next.</p>
        <p>
          The type is <code>Result&lt;T, E&gt;</code>: either the value or the error. The <code>?</code> operator hands an error to the
          caller and keeps going with the value otherwise, which keeps the happy path readable:
        </p>
        <pre>{`fn port(config: &str) -> Result<u16, ConfigError> {
    let text = std::fs::read_to_string(config)?;
    let port = text.trim().parse::<u16>()?;
    Ok(port)
}`}</pre>
        <p>
          Both lines can fail in different ways. <code>ConfigError</code> says how each of them turns into the one error this function
          reports, so nothing is swallowed on the way up.
        </p>
      </div>
    </article>
  );
}

function Recipe() {
  return (
    <article className="pg pg-recipe">
      <div className="pg-hero">
        <p className="pg-kicker">Soups · 40 minutes · serves 4</p>
        <h1>Lentil soup</h1>
      </div>
      <div className="pg-body pg-two">
        <section>
          <h2>You need</h2>
          <ul>
            <li>250 g red lentils</li>
            <li>1 onion, 2 carrots</li>
            <li>2 cloves of garlic</li>
            <li>1 tsp cumin, 1 tsp paprika</li>
            <li>1 l vegetable stock</li>
            <li>Juice of half a lemon</li>
          </ul>
        </section>
        <section>
          <h2>Method</h2>
          <ol>
            <li>Soften the onion, carrots and garlic in olive oil for five minutes.</li>
            <li>Add the spices, then the lentils and the stock. Simmer for 25 minutes.</li>
            <li>Blend half of it, stir it back in and finish with the lemon juice.</li>
          </ol>
        </section>
      </div>
    </article>
  );
}

function Hike() {
  return (
    <article className="pg pg-hike">
      <div className="pg-body">
        <p className="pg-kicker">Trails · Loop</p>
        <h1>Ridge loop</h1>
        <dl className="pg-stats">
          <div>
            <dt>Distance</dt>
            <dd>14 km</dd>
          </div>
          <div>
            <dt>Climb</dt>
            <dd>620 m</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>4 h 30</dd>
          </div>
        </dl>
        <svg className="pg-profile" viewBox="0 0 600 150" preserveAspectRatio="none" role="img" aria-label="Elevation profile: a long climb to the ridge, then down in two steps">
          <path className="fill" d="M0 130 C60 122 90 96 140 84 S220 34 290 26 S360 52 400 60 S470 100 520 104 S580 124 600 128 V150 H0 Z" />
          <path className="line" d="M0 130 C60 122 90 96 140 84 S220 34 290 26 S360 52 400 60 S470 100 520 104 S580 124 600 128" />
        </svg>
        <h2>The way</h2>
        <ol>
          <li>From the car park, follow the stream to the old mill.</li>
          <li>Take the steep path through the beech wood up to the ridge.</li>
          <li>Walk the ridge east; the hut after 6 km serves soup until four.</li>
          <li>Come down by the forest road, which is easy on the knees.</li>
        </ol>
      </div>
    </article>
  );
}

/** A page with a playing video; the picture itself is drawn (demo.css, `.footage`). */
function Video() {
  return (
    <article className="pg pg-video">
      <header className="pg-bar">
        <strong>Field recordings</strong>
        <span>Latest</span>
        <span>Birds</span>
        <span>Water</span>
      </header>
      <div className="pg-body">
        <div className="footage" role="img" aria-label="A video: the sun rising over hills" />
        <h1>Dawn chorus</h1>
        <p className="pg-lead">Forty minutes of a beech wood waking up, recorded at the edge of the ridge in May.</p>
      </div>
    </article>
  );
}

/**
 * Magnetite's own Settings, the app's page as it is. It picks its section
 * from the address, so that is set before the page is built.
 */
function Settings({ section }: { section: string }) {
  const [shown, setShown] = useState<string | null>(null);
  useLayoutEffect(() => {
    history.replaceState(null, "", `#${section}`);
    setShown(section);
  }, [section]);
  return <div className="pg-app">{shown === section && <SettingsPage key={section} />}</div>;
}

/** magnetitebrowser.org as a favorite: a few words of the real page. */
function Home() {
  return (
    <article className="pg pg-home">
      <div className="pg-body">
        <img src="/favicon.svg" alt="" width={72} height={72} />
        <h1>
          Your tabs, <em>magnetized.</em>
        </h1>
        <p className="pg-lead">An open-source browser that keeps your tabs in a sidebar, sorts them into spaces and archives what you stop using.</p>
      </div>
    </article>
  );
}

/** Any other address: the demo shows the browser, not the web. */
function Sample({ title, url }: { title: string; url: string }) {
  const isSearch = url.includes("?q=");
  return (
    <article className="pg pg-sample">
      <div className="pg-body">
        <p className="pg-kicker">{url.startsWith("magnetite://") ? "Magnetite" : hostOf(url)}</p>
        <h1>{title}</h1>
        <p className="pg-lead">
          {isSearch
            ? "The demo does not search the web. In Magnetite this opens the search engine you chose."
            : "A sample page. The sidebar and the command bar around it are Magnetite’s own code, but this demo loads nothing from the web."}
        </p>
      </div>
    </article>
  );
}

/** The page at `url`: Magnetite's own for its own addresses, else a sample. */
export function Page({ url, title }: { url: string; title: string }) {
  if (url.startsWith("magnetite://ui/settings")) return <Settings section={url.split("#")[1] ?? "general"} />;
  switch (pageFor(url)) {
    case "roadmap":
      return <Roadmap />;
    case "notes":
      return <Notes />;
    case "design":
      return <DesignNote />;
    case "review":
      return <Review url={url} />;
    case "article":
      return <Article />;
    case "recipe":
      return <Recipe />;
    case "hike":
      return <Hike />;
    case "video":
      return <Video />;
    case "home":
      return <Home />;
    case "sample":
      return <Sample title={title} url={url} />;
  }
}
