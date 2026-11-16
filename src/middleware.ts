// Sends the pages' Content-Security-Policy as a header. Built pages only: the
// dev server injects inline styles and its own client script. The headers
// every response gets, files included, are set in server.mjs.
import { defineMiddleware } from "astro:middleware";
import { CSP } from "./csp";

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  // The home page frames this site's own /demo/ page; nothing else may frame or be framed.
  if (import.meta.env.PROD) response.headers.set("Content-Security-Policy", `${CSP}; frame-ancestors 'self'`);
  return response;
});
