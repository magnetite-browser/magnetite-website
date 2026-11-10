# Contributing

Thanks for helping. Before a pull request:

- `pnpm build` passes: it checks the types, builds the site and then checks
  the built pages (every link, nothing from another origin, the
  Content-Security-Policy).
- Commit subjects follow conventional commits, short: `fix(download): …`,
  `feat(home): …`.
- The site sets no cookies, stores nothing in the browser and loads nothing
  from another server except the visitor statistics script. A change must
  keep that true, or change `src/pages/privacy.astro` along with it.
- Facts about the project (links, versions, platforms, contacts, the
  company's details) live in `src/site.ts`. Legal details change only when
  the maintainers say so.
- `app/` is a copy of the browser's interface code, for the live demo.
  Please do not change it here: changes to the sidebar itself belong to the
  [browser's repository](https://github.com/magnetite-browser/magnetite), and
  the copy is renewed from there (`app/README.md`).
- Security issues go to security@magnetitebrowser.org, not to public issues.

`README.md` has the rest: how to run the site, what the checks look at, how
it is deployed.

CI builds the site's image for every pull request and starts it to check its
pages and headers. CodeRabbit reviews pull requests automatically
(`.coderabbit.yaml`); maintainers decide what gets merged.

Contributions come in under the EUPL-1.2 (inbound = outbound); you keep your
copyright. There is no CLA.
