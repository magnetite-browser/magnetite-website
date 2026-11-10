// Page motion, loaded on every page as one small module. Everything here is an
// enhancement: without it (no JavaScript) every element is visible and in its
// final place, and with reduced motion only the static parts run.
//
//   [data-reveal]     fades and rises in when scrolled into view; only where
//                     CSS cannot tie it to the scroll itself (global.css)
//   [data-loop]       CSS loops that pause while off screen (data-play)
//   .spot             cards lit where the pointer is (--mx, --my)
//   [data-magnetic]   pulled a little towards the pointer
//   [data-film]       the tour: a live window that follows the scroll (film.ts)
//   [data-show]       the smaller features: a live window for the card in turn (film.ts)
//   .os-switch        shortcuts preselected for this computer's system
//   [data-tilt]       tilts a little towards the pointer (--rx, --ry)

import { film, showcase } from "./film";

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
const scrollLinked = CSS.supports("animation-timeline: view()");

function reveals() {
  const items = document.querySelectorAll<HTMLElement>("[data-reveal]");
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        (e.target as HTMLElement).dataset.reveal = "visible";
        io.unobserve(e.target);
      }
    },
    { rootMargin: "0px 0px -6% 0px", threshold: 0 },
  );
  for (const el of items) {
    // Only what is still below the fold gets hidden, so nothing visible blinks.
    if (el.getBoundingClientRect().top < innerHeight * 0.95) continue;
    el.dataset.reveal = "pending";
    io.observe(el);
  }
}

function loops() {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) (e.target as HTMLElement).dataset.play = e.isIntersecting ? "on" : "off";
    },
    { rootMargin: "120px 0px" },
  );
  for (const el of document.querySelectorAll<HTMLElement>("[data-loop]")) io.observe(el);
}

function spotlights() {
  for (const el of document.querySelectorAll<HTMLElement>(".spot")) {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  }
}

function magnets() {
  for (const el of document.querySelectorAll<HTMLElement>("[data-magnetic]")) {
    const strength = Number(el.dataset.magnetic) || 0.3;
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) * strength;
      const y = (e.clientY - (r.top + r.height / 2)) * strength;
      el.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
    });
    el.addEventListener("pointerleave", () => {
      el.style.translate = "";
    });
  }
}

function tilts() {
  const items = [...document.querySelectorAll<HTMLElement>("[data-tilt]")];
  if (!items.length) return;
  window.addEventListener(
    "pointermove",
    (e) => {
      for (const el of items) {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - (r.left + r.width / 2)) / innerWidth;
        const y = (e.clientY - (r.top + r.height / 2)) / innerHeight;
        el.style.setProperty("--ry", `${(x * 18).toFixed(2)}deg`);
        el.style.setProperty("--rx", `${(-y * 14).toFixed(2)}deg`);
      }
    },
    { passive: true },
  );
}

// Shortcuts: show Windows & Linux keys on computers that are not Macs.
function osKeys() {
  if (/Mac|iPhone|iPad/.test(navigator.userAgent)) return;
  const pc = document.querySelector<HTMLInputElement>('.os-switch input[value="pc"]');
  if (pc) pc.checked = true;
}

film();
showcase();
osKeys();
loops();
if (!reduceMotion) {
  if (!scrollLinked) reveals();
  if (finePointer) {
    spotlights();
    magnets();
    tilts();
  }
}
