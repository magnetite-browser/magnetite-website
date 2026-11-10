// What the home page's tour (src/scripts/film.ts) and the embedded demo
// (film.ts in this folder) agree on: types only, so the home page's script
// carries none of the demo's code.

/** The scenes the demo can play (film.ts): the tour's, then the feature cards'. The home page lists both (src/pages/index.astro). */
export type SceneId =
  | "sidebar"
  | "spaces"
  | "command"
  | "split"
  | "peek"
  | "archive"
  | "reopen"
  | "pip"
  | "smart"
  | "profiles"
  | "extensions"
  | "media"
  | "links"
  | "capture"
  | "site"
  | "import";

/** `window.magnetiteDemo` of the embedded demo (`/demo/?film`). */
export interface DemoApi {
  /** Show `scene` at `t`: 0 at its start, 1 at its end. */
  show(scene: SceneId, t: number): void;
}

/**
 * What the embedded demo posts to the page around it once it can show
 * scenes. A type, not a constant: the home page's script and the demo's
 * share no code, so each spells it out (and the compiler checks it).
 */
export type DemoReady = "magnetite-demo-ready";

declare global {
  interface Window {
    magnetiteDemo?: DemoApi;
  }
}
