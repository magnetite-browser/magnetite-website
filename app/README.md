# The browser's sidebar, copied

The files in this folder are a copy of the Magnetite browser's own interface
code: the sidebar, the command bar, the capture tool and the Settings page,
with their stylesheet. They come from
[magnetite-browser/magnetite](https://github.com/magnetite-browser/magnetite),
folder `crates/ui/web/src`, as it was on 10 November 2026, and are under the
same licence (EUPL-1.2, `../LICENSE`).

The live demo (`../src/demo/`) runs this code unchanged, so the website
shows the interface the app has, not a drawing of it. Left out are the files
the demo does not use (the app's entry point, the licence viewer, the
notification panel, the split drop zones and the command bar's window).

Please do not change these files here. A change to the interface belongs to
the browser's repository; this copy is renewed from there by hand when the
website should show a newer interface, and the demo's pictures are taken
again after that (`../scripts/make-images.sh`).
