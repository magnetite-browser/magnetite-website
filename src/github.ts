// What the pages show from GitHub about the browser's repository: its stars
// (header) and its latest release (download links). This server asks GitHub,
// never the visitor's browser, and keeps each answer in memory: pages are
// rendered with the last known value and do not wait for GitHub, except while
// there is no value at all (the stars, on the first request after a start).
import { FALLBACK_VERSION, GITHUB_REPO } from "./site";

const REFRESH_MS = 15 * 60 * 1000;
const TIMEOUT_MS = 2000;

/**
 * A value read from one GitHub API address, asked again at most once per 15
 * minutes. `pick` takes the value out of the answer, or returns null for an
 * answer it does not trust; that, like a failed request, keeps the value we had.
 */
function cached<T>(path: string, pick: (body: object) => T | null, initial: T | null): () => Promise<T | null> {
  let value = initial;
  let refreshAt = 0;
  let pending: Promise<void> = Promise.resolve();

  async function refresh() {
    try {
      const res = await fetch(`https://api.github.com/${path}`, {
        headers: { Accept: "application/vnd.github+json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) return;
      const body: unknown = await res.json();
      if (typeof body === "object" && body !== null) value = pick(body) ?? value;
    } catch {
      // No network, a timeout or no JSON: the pages keep the old value.
    }
  }

  return async () => {
    if (Date.now() >= refreshAt) {
      refreshAt = Date.now() + REFRESH_MS;
      pending = refresh();
    }
    if (value === null) await pending;
    return value;
  };
}

/** The repository's star count, or null while GitHub has not answered yet. */
export const stars = cached(
  `repos/${GITHUB_REPO}`,
  (body) => ("stargazers_count" in body && typeof body.stargazers_count === "number" ? body.stargazers_count : null),
  null,
);

/**
 * Version of the latest published release, without the "v" (e.g. "0.1.0"); FALLBACK_VERSION
 * until GitHub has answered. It goes into the download links: nothing but a plain version counts.
 */
export const latestVersion = cached(
  `repos/${GITHUB_REPO}/releases/latest`,
  (body) =>
    "tag_name" in body && typeof body.tag_name === "string" && /^v\d+\.\d+\.\d+$/.test(body.tag_name)
      ? body.tag_name.slice(1)
      : null,
  FALLBACK_VERSION,
);
