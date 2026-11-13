// Every project fact the pages use lives here, so a change is made once.

/** GitHub "owner/repo"; every GitHub link and the Homebrew tap derive from it. */
export const GITHUB_REPO = "magnetite-browser/magnetite";

/** Branch the "view file" links point at. */
export const DEFAULT_BRANCH = "main";

/**
 * Version of the latest signed release on GitHub Releases, without the "v"
 * (e.g. "0.1.0"). While null, the download page says "Coming soon"; once set,
 * the buttons link straight to the release assets. Kept current by
 * scripts/follow-release.sh, which rewrites this line: keep its form.
 */
export const LATEST_VERSION: string | null = "0.0.1";

/** Where to report vulnerabilities; same value as in SECURITY.md. */
export const SECURITY_CONTACT = "security@magnetitebrowser.org";

/**
 * Who provides this website and publishes Magnetite (imprint, privacy
 * policy): the company's own details, as on https://www.stack-forge.eu/en/imprint.
 */
export const LEGAL = {
  entity: "StackForge UG (haftungsbeschränkt)",
  website: "https://www.stack-forge.eu",
  representedBy: "Tobias Sittenauer and Manuel Stingl, managing directors",
  street: "Bergstraße 4",
  city: "84107 Weihmichl",
  country: "Germany",
  email: "hallo@stack-forge.eu",
  phone: "+49 (0) 156 797 670 00",
  /** For questions about personal data and for exercising GDPR rights. */
  privacyEmail: "privacy@stack-forge.eu",
  registerCourt: "Amtsgericht Landshut",
  registerNumber: "HRB 15051",
  vatId: "DE458158604",
  /** The data protection authority responsible for the company. */
  authority: "Bayerisches Landesamt für Datenschutzaufsicht",
} as const;

/** Where this site runs and how long its server logs are kept, for the privacy policy. */
export const HOSTING = {
  location: "Germany",
  logRetention: "14 days",
} as const;

/**
 * Visitor statistics: our own Umami server, the one script the pages load
 * from another origin (layouts/Base.astro, privacy policy). The Caddyfile's
 * Content-Security-Policy and scripts/check-links.mjs name it too.
 */
export const STATS = {
  origin: "https://umami.stack-forge.cloud",
  script: "https://umami.stack-forge.cloud/umami",
  websiteId: "01c72990-0a5f-4c32-9cdb-b3f359a90be0",
} as const;

export const ARC_SHUTDOWN = "22 December 2026";

/** Node.js major version a source build needs (README.md, "Building from source"). */
export const NODE_VERSION = 22;

const [owner] = GITHUB_REPO.split("/");
const repoUrl = `https://github.com/${GITHUB_REPO}`;

/** This website's own repository. */
export const WEBSITE_REPO = `https://github.com/${owner}/magnetite-website`;

/** Links into the browser's repository. */
export const repo = {
  url: repoUrl,
  releases: `${repoUrl}/releases`,
  issues: `${repoUrl}/issues`,
  file: (path: string) => `${repoUrl}/blob/${DEFAULT_BRANCH}/${path}`,
};

/** Magnetite's free sync server and the repository of magnetite-sync (ADR-0008). */
export const SYNC = {
  url: "https://sync.magnetitebrowser.org",
  host: "sync.magnetitebrowser.org",
  repo: "https://github.com/magnetite-browser/magnetite-sync",
  hosting: "Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen, Germany",
  backupDays: 14,
};

export const docs = {
  readme: repo.file("README.md"),
  building: `${repo.file("README.md")}#building-from-source`,
  contributing: repo.file("CONTRIBUTING.md"),
  security: repo.file("SECURITY.md"),
  securityRules: repo.file("docs/design/security.md"),
  license: repo.file("LICENSE"),
  licenseAdr: repo.file("docs/adr/0006-license.md"),
  notices: repo.file("THIRD_PARTY_NOTICES.md"),
  syncAdr: repo.file("docs/adr/0005-sync.md"),
  syncServer: `${SYNC.repo}#readme`,
  syncPublic: `${SYNC.repo}/blob/${DEFAULT_BRANCH}/docs/public-instance.md`,
  linux: repo.file("packaging/linux/README.md"),
  specs: repo.file("docs/spec/README.md"),
};

export const EUPL_TEXTS = "https://interoperable-europe.ec.europa.eu/collection/eupl/eupl-text-eupl-12";

/** Homebrew cask from the project's own tap (magnetite-browser/homebrew-magnetite). */
export const BREW_INSTALL = `brew install --cask ${owner}/magnetite/magnetite`;

export type Platform = {
  id: string;
  os: "macOS" | "Linux" | "Windows";
  arch: string;
  /** Release asset name for a version, as scripts/release produces it. */
  asset: (version: string) => string;
  /** What works today, in one short line. */
  status: string;
  /** Releases carry a package for it; lights the status dot on the home page. */
  ready: boolean;
  requirements: string;
};

export const PLATFORMS: readonly Platform[] = [
  {
    id: "macos-aarch64",
    os: "macOS",
    arch: "Apple silicon",
    asset: (v) => `Magnetite-${v}-macos-aarch64.zip`,
    status: "Signed and notarized",
    ready: true,
    requirements: "macOS 13 Ventura or later",
  },
  {
    id: "macos-x86_64",
    os: "macOS",
    arch: "Intel",
    asset: (v) => `Magnetite-${v}-macos-x86_64.zip`,
    status: "Experimental",
    ready: true,
    requirements: "macOS 13 Ventura or later",
  },
  {
    id: "linux-x86_64",
    os: "Linux",
    arch: "x86_64",
    asset: (v) => `magnetite-${v}-linux-x86_64.tar.gz`,
    status: "Experimental",
    ready: true,
    requirements: "GTK 3, NSS, ALSA, GBM and the usual Chromium libraries",
  },
  {
    id: "linux-aarch64",
    os: "Linux",
    arch: "ARM64",
    asset: (v) => `magnetite-${v}-linux-aarch64.tar.gz`,
    status: "Experimental",
    ready: true,
    requirements: "GTK 3, NSS, ALSA, GBM and the usual Chromium libraries",
  },
  {
    id: "windows-x86_64",
    os: "Windows",
    arch: "x86_64",
    asset: (v) => `magnetite-${v}-windows-x86_64.zip`,
    status: "In preparation",
    ready: false,
    requirements: "64-bit Windows",
  },
];

/** Direct link to a platform's file in the latest release, or null while there is none for it. */
export const downloadUrl = (p: Platform): string | null =>
  LATEST_VERSION === null || !p.ready ? null : `${repo.releases}/download/v${LATEST_VERSION}/${p.asset(LATEST_VERSION)}`;
