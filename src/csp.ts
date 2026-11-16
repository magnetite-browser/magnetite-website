// The pages' Content-Security-Policy, in one place: Base.astro puts it into a
// <meta> tag and src/middleware.ts sends it as a header, where frame-ancestors
// is added (it only works as a header). scripts/smoke-test.sh compares the two.
import { STATS } from "./site";

export const CSP = [
  "default-src 'none'",
  `script-src 'self' ${STATS.origin}`,
  // Where the statistics script reports a visit.
  `connect-src ${STATS.origin}`,
  "img-src 'self'",
  "style-src 'self'",
  "font-src 'self'",
  // The tour's live window: this site's own /demo/ page.
  "frame-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");
