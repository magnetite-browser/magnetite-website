// Static site. See README.md.
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// The live demo (src/demo/) runs the browser's own sidebar: app/ is a copy of its source (app/README.md).
const appUi = fileURLToPath(new URL("./app", import.meta.url));

export default defineConfig({
  site: "https://magnetitebrowser.org",
  trailingSlash: "always",
  build: {
    format: "directory",
    // CSS goes to files under /_astro/, never inline, so the CSP can stay at style-src 'self'.
    inlineStylesheets: "never",
  },
  // English at /, a German version can go to /de/ later (add "de" here and src/i18n/ui.ts).
  i18n: {
    locales: ["en"],
    defaultLocale: "en",
    routing: { prefixDefaultLocale: false },
  },
  // Compression drops spaces next to inline links at line breaks ("documented.Report").
  compressHTML: false,
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwindcss()],
    resolve: { alias: { "@app": appUi } },
    build: {
      // Never inline scripts or fonts as data: or inline <script>; the CSP only allows files from this site.
      assetsInlineLimit: 0,
      // The demo's script bundles React and Lucide: their licence notices stay in it.
      rolldownOptions: {
        output: { comments: { legal: true } },
        // Lucide marks its files "use client" for other bundlers; nothing to act on here.
        onLog(level, log, handler) {
          if (log.code !== "MODULE_LEVEL_DIRECTIVE") handler(level, log);
        },
      },
    },
  },
});
