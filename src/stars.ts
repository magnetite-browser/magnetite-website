// GitHub stars of the browser's repository, for the header. This server asks
// GitHub, never the visitor's browser, and keeps the answer in memory: pages
// are rendered with the last known count and never wait for GitHub, except
// while there is no count yet (the first request after a start).
import { GITHUB_REPO } from "./site";

const REFRESH_MS = 15 * 60 * 1000;
const TIMEOUT_MS = 2000;

let count: number | null = null;
let refreshAt = 0;
let pending: Promise<void> = Promise.resolve();

/** Asks GitHub once; a failed or odd answer keeps the count we had. */
async function refresh() {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`, {
      headers: { Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return;
    const body: unknown = await res.json();
    if (typeof body === "object" && body !== null && "stargazers_count" in body && typeof body.stargazers_count === "number")
      count = body.stargazers_count;
  } catch {
    // No network, a timeout or no JSON: the header shows the old count, or none.
  }
}

/** The star count, or null while GitHub has not answered yet. At most one request to GitHub per 15 minutes. */
export async function stars(): Promise<number | null> {
  if (Date.now() >= refreshAt) {
    refreshAt = Date.now() + REFRESH_MS;
    pending = refresh();
  }
  if (count === null) await pending;
  return count;
}
