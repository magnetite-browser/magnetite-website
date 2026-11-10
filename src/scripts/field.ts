// Iron filings on a canvas: thousands of short strokes that line up with the
// field of a magnet (two poles around the anchor element, usually the big
// logo) and a third pole that follows the pointer. Pauses off screen and in
// hidden tabs; with reduced motion it draws one still frame.

type Pole = { x: number; y: number; q: number };

const SPACING = 15;
// Weak field is steel grey, stronger brass, strongest copper like the coil.
const STEEL: [number, number, number] = [147, 164, 184];
const BRASS: [number, number, number] = [235, 196, 132];
const COPPER: [number, number, number] = [236, 128, 72];
const BUCKETS = 9;

export function startField(canvas: HTMLCanvasElement, anchor: HTMLElement | null) {
  const maybeCtx = canvas.getContext("2d");
  if (!maybeCtx) return;
  const ctx: CanvasRenderingContext2D = maybeCtx;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let w = 0;
  let h = 0;
  let dpr = 1;
  // Per filing: x, y, current angle, length factor.
  let filings = new Float32Array(0);
  let count = 0;
  const pointer = { x: 0, y: 0, active: false, seen: 0 };
  const roam = { x: 0, y: 0 };
  let magnet = { x: 0, y: 0, r: 120 };

  function layout() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = rect.width;
    h = rect.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const cols = Math.ceil(w / SPACING) + 1;
    const rows = Math.ceil(h / SPACING) + 1;
    count = cols * rows;
    filings = new Float32Array(count * 4);
    let i = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        filings[i++] = c * SPACING + (r % 2) * SPACING * 0.5 + (Math.random() - 0.5) * SPACING * 0.6;
        filings[i++] = r * SPACING + (Math.random() - 0.5) * SPACING * 0.6;
        filings[i++] = Number.NaN;
        filings[i++] = 0.55 + Math.random() * 0.9;
      }
    }
    if (anchor && anchor.offsetParent !== null) {
      const a = anchor.getBoundingClientRect();
      magnet = { x: a.left - rect.left + a.width / 2, y: a.top - rect.top + a.height / 2, r: a.width * 0.32 };
    } else {
      magnet = { x: w * 0.72, y: h * 0.42, r: Math.min(w, h) * 0.16 };
    }
  }

  function poles(t: number): Pole[] {
    // The pointer pole drifts on its own until the pointer moves over the canvas.
    const orbitX = magnet.x + Math.cos(t * 0.00023) * w * 0.38;
    const orbitY = magnet.y + Math.sin(t * 0.00031) * h * 0.32;
    const tx = pointer.active ? pointer.x : orbitX;
    const ty = pointer.active ? pointer.y : orbitY;
    roam.x += (tx - roam.x) * (still ? 1 : 0.06);
    roam.y += (ty - roam.y) * (still ? 1 : 0.06);
    return [
      { x: magnet.x - magnet.r, y: magnet.y, q: 1.6 },
      { x: magnet.x + magnet.r, y: magnet.y, q: -1.6 },
      // The pointer pulls harder than the drifting pole, so the field visibly follows it.
      { x: roam.x, y: roam.y, q: pointer.active ? 0.9 : 0.35 },
    ];
  }

  function field(x: number, y: number, ps: Pole[]): [number, number] {
    let ex = 0;
    let ey = 0;
    for (const p of ps) {
      const dx = x - p.x;
      const dy = y - p.y;
      const d2 = dx * dx + dy * dy + 400;
      ex += (p.q * dx) / d2;
      ey += (p.q * dy) / d2;
    }
    return [ex, ey];
  }

  const paths: Path2D[] = [];
  function draw(t: number, dt: number) {
    const ps = poles(t);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Soft light around the poles.
    for (const [i, p] of ps.entries()) {
      const r = i === 2 ? 160 : magnet.r * 2.2;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, i === 2 ? `rgba(215,166,101,${pointer.active ? 0.14 : 0.07})` : "rgba(226,98,43,0.12)");
      g.addColorStop(1, i === 2 ? "rgba(215,166,101,0)" : "rgba(226,98,43,0)");
      ctx.fillStyle = g;
      ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    }

    for (let b = 0; b < BUCKETS; b++) paths[b] = new Path2D();
    const ease = still ? 1 : Math.min(1, dt * 0.008);
    for (let i = 0; i < count; i++) {
      const o = i * 4;
      const x = filings[o]!;
      const y = filings[o + 1]!;
      const [ex, ey] = field(x, y, ps);
      const target = Math.atan2(ey, ex);
      let a = filings[o + 2]!;
      if (Number.isNaN(a)) a = target;
      // Filings have no head or tail: turn the short way, within half a turn.
      let d = target - a;
      d = ((((d + Math.PI / 2) % Math.PI) + Math.PI) % Math.PI) - Math.PI / 2;
      a += d * ease;
      filings[o + 2] = a;
      const m = Math.hypot(ex, ey);
      const k = Math.min(1, Math.log1p(m * 500) / 3.4);
      const len = SPACING * 0.36 * filings[o + 3]! * (0.65 + k * 0.7);
      const cx = Math.cos(a) * len;
      const cy = Math.sin(a) * len;
      const bucket = Math.min(BUCKETS - 1, Math.floor(k * BUCKETS));
      const path = paths[bucket]!;
      path.moveTo(x - cx, y - cy);
      path.lineTo(x + cx, y + cy);
    }
    ctx.lineCap = "round";
    for (let b = 0; b < BUCKETS; b++) {
      const k = b / (BUCKETS - 1);
      const mix = (i: 0 | 1 | 2) =>
        k < 0.7
          ? Math.round(STEEL[i] + (BRASS[i] - STEEL[i]) * (k / 0.7) ** 2)
          : Math.round(BRASS[i] + (COPPER[i] - BRASS[i]) * ((k - 0.7) / 0.3));
      ctx.strokeStyle = `rgba(${mix(0)},${mix(1)},${mix(2)},${(0.07 + k * 0.6).toFixed(3)})`;
      ctx.lineWidth = 1 + k * 0.6;
      ctx.stroke(paths[b]!);
    }

  }

  let visible = true;
  let frame = 0;
  let last = performance.now();
  function tick(now: number) {
    frame = 0;
    if (!visible || document.hidden) return;
    const dt = Math.min(64, now - last);
    last = now;
    if (pointer.active && now - pointer.seen > 2500) pointer.active = false;
    draw(now, dt);
    frame = requestAnimationFrame(tick);
  }
  function wake() {
    if (still || frame || !visible || document.hidden) return;
    last = performance.now();
    frame = requestAnimationFrame(tick);
  }

  layout();
  roam.x = magnet.x + w * 0.3;
  roam.y = magnet.y;
  draw(performance.now(), 16);

  new ResizeObserver(() => {
    layout();
    draw(performance.now(), 16);
  }).observe(canvas);
  if (still) return;

  new IntersectionObserver(([e]) => {
    visible = e?.isIntersecting ?? true;
    wake();
  }).observe(canvas);
  document.addEventListener("visibilitychange", wake);
  window.addEventListener(
    "pointermove",
    (e) => {
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      if (x < 0 || y < 0 || x > r.width || y > r.height) return;
      pointer.x = x;
      pointer.y = y;
      pointer.active = true;
      pointer.seen = performance.now();
    },
    { passive: true },
  );
  wake();
}
