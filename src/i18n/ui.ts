// Strings shared by every page (header, footer, page chrome). Page prose lives
// in the pages themselves: a German version adds `de` below (the type forces
// every key) and its pages under src/pages/de/.

export const languages = { en: "English" } as const;
export type Lang = keyof typeof languages;
export const defaultLang: Lang = "en";

const en = {
  "skip": "Skip to content",
  "nav.label": "Main",
  "nav.features": "Features",
  "nav.privacy": "Privacy",
  "nav.faq": "FAQ",
  "nav.download": "Download",
  "nav.source": "Source code",
  "footer.product": "Product",
  "footer.project": "Project",
  "footer.legal": "Legal",
  "footer.features": "Features",
  "footer.download": "Download",
  "footer.faq": "FAQ",
  "footer.source": "Source code on GitHub",
  "footer.contributing": "Contributing",
  "footer.security": "Security policy",
  "footer.license": "Licence",
  "footer.notices": "Third-party notices",
  "footer.privacy": "Privacy policy",
  "footer.imprint": "Imprint",
  "footer.tagline": "An open-source desktop browser with sidebar tabs, spaces and a command bar.",
  "footer.copyright": "© 2026 the Magnetite contributors. Licensed under the EUPL-1.2.",
  "footer.independent":
    "Magnetite is an independent project. It is not affiliated with, endorsed by or sponsored by The Browser Company.",
} as const;

export const ui = { en } satisfies Record<Lang, Record<keyof typeof en, string>>;

export type UiKey = keyof typeof en;

/** Translator for one language: `const t = useTranslations(lang); t("nav.faq")`. */
export const useTranslations = (lang: Lang) => (key: UiKey) => ui[lang][key];

/** Path of a page in a language: English stays at the root, others get a prefix. */
export const localizePath = (lang: Lang, path: `/${string}`) => (lang === defaultLang ? path : `/${lang}${path}`);
