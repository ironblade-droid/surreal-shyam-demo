import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { floorY, FLOOR_H } from "./building";
import { buildPhotoreal } from "./photoreal";
import { PROJECT, WINGS, unitNo, sqft, type Wing } from "./data";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $("stage") as unknown as HTMLCanvasElement;
const coarse = matchMedia("(pointer:coarse)").matches;
const mobile = coarse || Math.min(innerWidth, innerHeight) < 600;
const F = PROJECT.floors;

// ------------------------------------------------------------------ renderer, scene (photoreal GLB + HDRI)
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x3c4a63, 160, 520);
const hemi = new THREE.HemisphereLight(0xdfe6f5, 0x8a7a66, 0.3); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffdcb0, 1.0);
sun.position.set(-45, 55, 60); sun.castShadow = true;
sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 10, far: 200 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
sun.shadow.radius = 4;
scene.add(sun);
const built = buildPhotoreal(scene, renderer, sun, hemi, { mobile, onChange: () => invalidate() });
let modelReady = false;
built.ready.then(() => { modelReady = true; syncTargets(); invalidate(); }).catch(e => { console.error("model load failed", e); });

const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 2000);
const dist0 = mobile ? (innerHeight > innerWidth ? 150 : 95) : 68;
camera.position.set(-0.58 * dist0, mobile ? 10 : 6, 0.81 * dist0);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 15, 0); controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false;
controls.minDistance = 24; controls.maxDistance = 150; controls.maxPolarAngle = 1.48; controls.minPolarAngle = 0.25;
controls.rotateSpeed = coarse ? 0.6 : 0.8; controls.zoomSpeed = 0.8;
controls.autoRotateSpeed = 0.5;

// ------------------------------------------------------------------ state (single source of truth = location.hash)
interface State { floor: number | null; wing: number | null; }
let state: State = { floor: null, wing: null };
let dirty = 2;   // frames still to draw (render on demand)
let hover: { floor: number; wing: number } | null = null;
const hashOf = (s: State) => s.floor == null ? "#" : s.wing == null ? `#floor-${s.floor}` : `#floor-${s.floor}/wing-${s.wing}`;
function parse(h: string): State {
  const m = /^#floor-(\d+)(?:\/wing-(\d+))?$/.exec(h || "");
  if (!m) return { floor: null, wing: null };
  const f = +m[1], w = m[2] ? +m[2] : null;
  if (f < 1 || f > F) return { floor: null, wing: null };
  if (w != null && (w < 1 || w > 4)) return { floor: f, wing: null };
  return { floor: f, wing: w };
}
const depth = () => (history.state && typeof history.state.d === "number") ? history.state.d : 0;
function nav(to: State) {
  const cur = hashOf(state), next = hashOf(to);
  if (cur === next) return;
  const level = (s: State) => s.floor == null ? 0 : s.wing == null ? 1 : 2;
  const url = next === "#" ? location.pathname + location.search : next;
  if (level(to) > level(state)) history.pushState({ d: depth() + 1 }, "", url);     // deeper: new entry
  else history.replaceState({ d: depth() }, "", url);                                 // sibling or jump up: replace, so Back always means "up"
  apply();
}
function back() {
  const parent: State = state.wing != null ? { floor: state.floor, wing: null } : { floor: null, wing: null };
  if (depth() > 0) { history.back(); return; }   // popstate -> apply()
  history.replaceState({ d: 0 }, "", parent.floor == null ? location.pathname + location.search : hashOf(parent)); apply();
}
addEventListener("popstate", () => { closeModal(); apply(); });
function apply() {
  const s = parse(location.hash);
  const canonical = s.floor == null ? "" : hashOf(s);
  if ((location.hash || "") !== canonical && !(canonical === "" && (location.hash === "" || location.hash === "#")))
    history.replaceState(history.state, "", canonical || location.pathname + location.search);
  const floorChanged = s.floor !== state.floor;
  state = s; hover = null;
  renderPanel(); renderSheet();
  if (floorChanged) focusFloor();
  syncTargets(); layout();
}

// ------------------------------------------------------------------ UI: side panel / bottom sheet
const panel = $("panel"), sheet = $("sheet"), modal = $("modal"), tag = $("tag");
const fmt = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
function keyPlan(sel: number | null) {
  const shape = (w: number, d: string, tx: number, ty: number) =>
    `<g class="w${sel === w ? " on" : ""}" data-wing="${w}" role="button" tabindex="0" aria-label="${WINGS[w - 1].name}"><path d="${d}"/><text x="${tx}" y="${ty}" text-anchor="middle">${WINGS[w - 1].name.toUpperCase()}</text></g>`;
  return `<svg class="keyplan" viewBox="0 0 180 300" aria-label="Key plan: four wings around the lobby">
    ${shape(3, "M24 8H90V150H24Z", 57, 82)}${shape(4, "M90 8H156V106H90Z", 123, 60)}
    <g class="lob"><path d="M90 106H156V150H90Z"/><text x="123" y="132" text-anchor="middle">LOBBY</text></g>
    ${shape(2, "M24 150H90V278H24Z", 57, 218)}${shape(1, "M90 150H156V278H90Z", 123, 218)}
    <text class="road" x="90" y="294" text-anchor="middle">80' MAIN ROAD</text>
    <text class="road" x="12" y="150" text-anchor="middle" transform="rotate(-90 12 150)">30' ENTRY ROAD</text></svg>`;
}
function renderPanel() {
  if (state.floor == null) {
    const rows = Array.from({ length: F }, (_, i) => F - i).map(f =>
      `<button type="button" data-floor="${f}"><span class="n">Floor ${f}</span><span class="m">4 homes</span></button>`).join("");
    panel.innerHTML = `<h2>Explore in 3D</h2><div class="h">Choose a floor</div>
      <p>Tap a floor on the building or pick one here, then choose a wing to see its plan, areas and 360° tour.</p>
      <div class="chips"><span>G + ${F} floors</span><span>4 homes / floor</span><span>3 BHK · 2,454–2,525 sq ft SBU</span>${PROJECT.approvals.map(a => `<span>${a}</span>`).join("")}</div>
      <div class="floors">${rows}<div class="gf"><span>Ground</span><span>Retail · entrance lobby</span></div></div>`;
  } else {
    const f = state.floor;
    const cards = WINGS.map(w => `<button type="button" data-wing="${w.id}" class="${state.wing === w.id ? "on" : ""}">
      <span class="wn">${w.name}</span><span class="wa">Flat ${unitNo(f, w.id)} · ${fmt(w.sbu)} sq ft</span>${w.tour ? `<span class="t3">360° tour</span>` : ""}</button>`).join("");
    panel.innerHTML = `<button type="button" class="back" data-act="back" aria-label="Back to all floors">← All floors</button>
      <h2>Floor ${f} · 4 homes</h2><div class="h">Choose a wing</div>${keyPlan(state.wing)}<div class="wings">${cards}</div>
      <div class="hint">or tap a wing on the highlighted floor</div>`;
  }
}
panel.addEventListener("click", e => {
  const t = (e.target as HTMLElement).closest<HTMLElement>("[data-floor],[data-wing],[data-act]"); if (!t) return;
  if (t.dataset.act === "back") return back();
  if (t.dataset.floor) return nav({ floor: +t.dataset.floor, wing: null });
  if (t.dataset.wing && state.floor != null) return nav({ floor: state.floor, wing: +t.dataset.wing });
});
panel.addEventListener("keydown", e => {
  const t = (e.target as HTMLElement).closest<HTMLElement>("g[data-wing]");
  if (t && (e.key === "Enter" || e.key === " ") && state.floor != null) { e.preventDefault(); nav({ floor: state.floor, wing: +t.dataset.wing! }); }
});
function renderSheet() {
  if (state.floor == null || state.wing == null) { if (!sheet.hidden) { sheet.hidden = true; sheet.innerHTML = ""; } return; }
  const w: Wing = WINGS[state.wing - 1], f = state.floor, from = `floor-${f}/wing-${w.id}`;
  const tour = w.tour ? `<a class="go" href="tour360/?room=living&from=${encodeURIComponent(from)}">◎ 360° Tour</a>`
                      : `<button type="button" class="off" disabled aria-disabled="true">360° tour coming soon</button>`;
  const other = WINGS.filter(x => x.id !== w.id).map(x => `<button type="button" class="ghost" data-wing="${x.id}">${x.name}</button>`).join("");
  sheet.innerHTML = `<div class="card">
    <div class="plan"><img src="${w.plan}" alt="Floor plan of the ${w.name}, Surreal Shyam" decoding="async"><button type="button" class="zoom" data-act="zoom">⤢ Full plan</button></div>
    <div class="info">
      <div class="crumb"><span class="kick">Floor ${f} · Flat ${unitNo(f, w.id)}</span><button type="button" class="x" data-act="close" aria-label="Back to the wings">✕</button></div>
      <div><h3 id="sheetTitle">${w.name} · 3 BHK</h3><p class="faces">${w.faces}</p></div>
      <div class="areas">
        <div><div class="l">SBU area</div><div class="v">${fmt(w.sbu)}<span class="u">sq ft</span></div></div>
        <div><div class="l">Built-up area</div><div class="v">${fmt(w.builtUp)}<span class="u">sq ft</span></div></div>
        <div><div class="l">Carpet area</div><div class="v">${fmt(w.carpet)}<span class="u">m²</span></div><div class="s">≈ ${fmt(sqft(w.carpet))} sq ft</div></div>
        <div><div class="l">Balcony area</div><div class="v">${fmt(w.balcony)}<span class="u">m²</span></div><div class="s">≈ ${fmt(sqft(w.balcony))} sq ft</div></div>
      </div>
      <div class="cta">${tour}<a class="ghost" href="tel:${PROJECT.contacts[0][1].replace(/\s/g, "")}">✆ Enquire</a></div>
      <table class="rooms"><thead><tr><th></th><th>Room</th><th>Size</th></tr></thead><tbody>
        ${w.rooms.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join("")}</tbody></table>
      <div class="cta">${other}</div>
      <p class="note">Areas and room sizes as in the builder's brochure; plans are indicative. ${w.tour ? "The 360° tour is a styled sample interior of the 1st Wing; the layout is the same on floors 1–7." : "360° interiors are ready for the 1st Wing; this wing is next."}</p>
    </div></div>`;
  sheet.hidden = false;
  (sheet.querySelector(".x") as HTMLElement)?.focus({ preventScroll: true });
}
sheet.addEventListener("click", e => {
  if (e.target === sheet) return back();                          // tap on the dimmed backdrop
  const t = (e.target as HTMLElement).closest<HTMLElement>("[data-act],[data-wing],img"); if (!t) return;
  if (t.dataset.act === "close") return back();
  if (t.dataset.act === "zoom" || t.tagName === "IMG") { const w = WINGS[(state.wing || 1) - 1]; return openModal(`${w.name} · floor plan`, `<img src="${w.plan}" alt="${w.name} floor plan">`); }
  if (t.dataset.wing && state.floor != null) return nav({ floor: state.floor, wing: +t.dataset.wing });
});
addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (!modal.hidden) return closeModal();
  if (state.floor != null) back();
});
function openModal(title: string, body: string) {
  modal.innerHTML = `<div class="mh"><b>${title}</b><button type="button" data-act="mclose" aria-label="Close">✕</button></div><div class="mb">${body}</div>`;
  modal.hidden = false; (modal.querySelector("button") as HTMLElement).focus({ preventScroll: true });
}
function closeModal() { if (!modal.hidden) { modal.hidden = true; modal.innerHTML = ""; } }
modal.addEventListener("click", e => { const t = e.target as HTMLElement; if (t.closest("[data-act=mclose]") || t.classList.contains("mb")) closeModal(); });
$("bPlate").onclick = () => openModal("Typical floor plan · 4 wings", `<img src="img/floor-plate.webp" alt="Typical floor plan of all four wings around the lobby">`);
$("bRender").onclick = () => openModal("Elevation · builder's render", `<div style="display:grid;gap:12px;justify-items:center"><img src="img/exterior-corner.webp" alt="Surreal Shyam corner render"><img src="img/exterior-front.webp" alt="Surreal Shyam front elevation"></div>`);
$("bMode").onclick = () => { const d = built.mode === "dusk"; built.setMode(d ? "day" : "dusk");
  $("bMode").innerHTML = d ? "☾ Dusk" : "☀ Day"; $("bMode").setAttribute("aria-label", d ? "Switch to dusk light" : "Switch to day light"); };
$("bLoc").onclick = () => openModal("Location", `<div class="loc"><b>${PROJECT.name}</b><br>${PROJECT.address}<br><br>
  On the main 80' road, close to Celebration Mall, schools and the city's lifestyle destinations.<br><br>
  <a href="${PROJECT.maps}" target="_blank" rel="noopener">Open in Google Maps ↗</a><br><br>
  ${PROJECT.contacts.map(c => `${c[0]}: <a href="tel:${c[1].replace(/\s/g, "")}">${c[1]}</a>`).join("<br>")}</div>`);

// ------------------------------------------------------------------ 3D picking: tap (not drag) selects; mouse hover previews
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pickAt(cx: number, cy: number) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  return ray.intersectObjects(built.picks, false);
}
function chooseHit(hits: THREE.Intersection[]) {
  if (!hits.length) return null;
  // Once a floor is selected, prefer that floor so a slightly high/low tap still picks the wing.
  if (state.floor != null) {
    const same = hits.find(h => (h.object.userData as { floor: number }).floor === state.floor);
    if (same) return same.object.userData as { floor: number; wing: number };
  }
  return hits[0].object.userData as { floor: number; wing: number };
}
function pick(cx: number, cy: number) {
  let h = chooseHit(pickAt(cx, cy));
  if (h || !coarse) return h;
  const rad = 20;
  for (const [dx, dy] of [[0, -rad], [0, rad], [-rad, 0], [rad, 0], [-rad, -rad], [rad, -rad], [-rad, rad], [rad, rad], [0, -2 * rad], [0, 2 * rad]]) {
    h = chooseHit(pickAt(cx + dx, cy + dy));
    if (h) return h;
  }
  return null;
}
let down: { x: number; y: number; t: number; id: number } | null = null, pointers = 0, lastInteract = performance.now();
canvas.addEventListener("pointerdown", e => { pointers++; lastInteract = performance.now(); down = pointers === 1 ? { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId } : null; });
const release = (e: PointerEvent) => {
  pointers = Math.max(0, pointers - 1); lastInteract = performance.now();
  if (!down || e.pointerId !== down.id || e.type !== "pointerup") { if (!pointers) down = null; return; }
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t; down = null;
  if (moved > (coarse ? 12 : 6) || dt > 700) return;              // it was a drag / long press, not a tap
  const h = pick(e.clientX, e.clientY); if (!h) return;
  if (state.floor !== h.floor) nav({ floor: h.floor, wing: null }); else nav({ floor: h.floor, wing: h.wing });
};
canvas.addEventListener("pointerup", release); canvas.addEventListener("pointercancel", release);
canvas.addEventListener("pointerleave", () => { if (hover) { hover = null; syncTargets(); } });
let hoverQ: { x: number; y: number } | null = null;
canvas.addEventListener("pointermove", e => { if (e.pointerType === "mouse" && !e.buttons) hoverQ = { x: e.clientX, y: e.clientY }; });
function doHover() {
  if (!hoverQ) return; const h = pick(hoverQ.x, hoverQ.y); hoverQ = null;
  const same = (h && hover && h.floor === hover.floor && h.wing === hover.wing) || (!h && !hover);
  if (!same) { hover = h; syncTargets(); canvas.style.cursor = h ? "pointer" : "grab"; }
}

// highlight targets are derived from state + hover only (no leftover highlight can survive a state change)
const targets = new Map<THREE.Mesh, number>();
const C_FLOOR = new THREE.Color(0xffe3ad), C_WING = new THREE.Color(0xe9a640);
function syncTargets() {
  dirty = Math.max(dirty, 2);
  for (const p of built.picks) {
    const { floor, wing } = p.userData as { floor: number; wing: number }; let o = 0, sel = false;
    if (state.floor == null) { if (hover && hover.floor === floor) o = 0.3; }
    else if (floor === state.floor) {
      o = 0.26;
      if (hover && hover.floor === floor && hover.wing === wing) o = 0.5;
      if (state.wing === wing) { o = 0.62; sel = true; }
    } else if (hover && hover.floor === floor) o = 0.14;
    (p.material as THREE.MeshBasicMaterial).color.copy(sel ? C_WING : C_FLOOR);
    targets.set(p, o);
  }
}
// camera focus on the chosen floor (target only; the user's orbit angle is kept)
let focusY = 15, focusing = false;
function focusFloor() {
  focusY = state.floor == null ? (mobile ? 14 : 15) : floorY(state.floor) + FLOOR_H / 2;
  const wantD = state.floor == null ? (mobile ? (innerHeight > innerWidth ? 150 : 95) : 68) : (mobile ? 105 : 75);
  const az = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z);
  const elev = state.floor == null ? (mobile ? 8 : 4) : (mobile ? 20 : 14);
  controls.target.set(0, focusY, 0);
  camera.position.set(Math.sin(az) * wantD, focusY + elev, Math.cos(az) * wantD);
  controls.update(); focusing = false; invalidate();
}

// ------------------------------------------------------------------ layout: keep the building clear of the panel
let offX = 0, offY = 0, wantX = 0, wantY = 0, W = 1, H = 1;
function visibleInset() {
  const topB = (document.querySelector(".top") as HTMLElement | null)?.getBoundingClientRect().bottom ?? 56;
  const pr = panel.getBoundingClientRect();
  let left = 8, right = W - 8, top = Math.min(H * 0.22, topB + 6), bottom = H - 8;
  if (pr.width > 0 && pr.height > 0) {
    if (pr.top > H * 0.3 && pr.width > W * 0.55) bottom = Math.min(bottom, pr.top - 8);      // bottom sheet
    else if (pr.left > W * 0.35) right = Math.min(right, pr.left - 8);                       // right-hand panel
  }
  if (bottom - top < 90) { top = Math.max(48, topB); bottom = Math.max(top + 90, Math.round(H * 0.48)); }
  return { left, right, top, bottom, cx: (left + right) / 2, cy: (top + bottom) / 2, vw: right - left, vh: Math.max(1, bottom - top) };
}
function layout() {
  // Use the layout viewport (not visualViewport) so the drawing buffer, CSS canvas
  // and pointer coordinates stay in lock-step — a mismatch was sending landscape
  // floor taps two storeys too high and pushing Floor 1 off-screen.
  W = Math.max(1, Math.round(innerWidth)); H = Math.max(1, Math.round(innerHeight));
  renderer.setSize(W, H, false); dirty = Math.max(dirty, 2);
  camera.aspect = W / H;
  const vis = visibleInset();
  wantX = W / 2 - vis.cx; wantY = H / 2 - vis.cy;                                          // centre the building in the unobstructed area
  controls.maxDistance = vis.vh / H < 0.65 || camera.aspect < 0.85 ? 220 : 150;
  camera.updateProjectionMatrix();
}
function applyOffset() {
  offX += (wantX - offX) * 0.15; offY += (wantY - offY) * 0.15;
  if (Math.abs(offX) < 0.5 && Math.abs(offY) < 0.5 && wantX === 0 && wantY === 0) camera.clearViewOffset();
  else camera.setViewOffset(W, H, offX, offY, W, H);
}
addEventListener("resize", layout);
addEventListener("orientationchange", () => { setTimeout(layout, 120); setTimeout(layout, 450); });
window.visualViewport?.addEventListener("resize", layout);
new ResizeObserver(() => layout()).observe(panel);

// ------------------------------------------------------------------ floating floor tag
const tagP = new THREE.Vector3();
function placeTag() {
  if (state.floor == null || state.wing != null) { if (!tag.hidden) tag.hidden = true; return; }
  tagP.set(8.4, floorY(state.floor) + FLOOR_H / 2, 14.2).project(camera);
  const x = (tagP.x + 1) / 2 * W, y = (1 - tagP.y) / 2 * H;
  const vis = tagP.z < 1 && x > 0 && x < W - 120 && y > 60 && y < H - 20;
  const pr = panel.getBoundingClientRect(); const overPanel = x + 140 > pr.left && x < pr.right && y > pr.top && y < pr.bottom;
  tag.hidden = !vis || overPanel;
  if (!tag.hidden) { tag.style.left = x + "px"; tag.style.top = y + "px"; tag.innerHTML = `<b>Floor ${state.floor}</b> · tap a wing`; }
}

// ------------------------------------------------------------------ loop
let first = true;
const invalidate = () => { dirty = Math.max(dirty, 2); };
controls.addEventListener("change", invalidate);
addEventListener("resize", invalidate);
renderer.setAnimationLoop(() => {
  const now = performance.now();
  controls.autoRotate = state.floor == null && now - lastInteract > 6000 && !matchMedia("(prefers-reduced-motion:reduce)").matches;
  if (focusing) {
    controls.target.y += (focusY - controls.target.y) * 0.25;
    if (Math.abs(focusY - controls.target.y) < 0.05) { controls.target.y = focusY; focusing = false; }
  }
  controls.update(); doHover();
  const ox = offX, oy = offY; applyOffset(); if (Math.abs(ox - offX) > 0.01 || Math.abs(oy - offY) > 0.01) invalidate();
  for (const [p, o] of targets) {
    const m = p.material as THREE.MeshBasicMaterial; if (m.opacity === o) continue;
    m.opacity += (o - m.opacity) * 0.25; if (Math.abs(o - m.opacity) < 0.003) m.opacity = o; invalidate();
  }
  if (focusing || controls.autoRotate) invalidate();
  if (dirty <= 0) return;                     // nothing moved: skip the frame (battery, and slow GPUs)
  dirty--; renderer.render(scene, camera); placeTag();
  if (first && modelReady) { first = false; $("loading").classList.add("done"); (window as any).__ss = { ready: true, info: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, pr: renderer.getPixelRatio() }) }; }
});
controls.addEventListener("start", () => { lastInteract = performance.now(); });

// test hooks (used by the headless QA script)
function projectWing(f: number, w: number) {
  const mesh = built.picks.find(m => m.userData.floor === f && m.userData.wing === w);
  if (!mesh) return { x: -1, y: -1, ok: false };
  const bb = new THREE.Box3().setFromObject(mesh);
  const c = bb.getCenter(new THREE.Vector3());
  const pts: THREE.Vector3[] = [new THREE.Vector3(c.x, c.y, w <= 2 ? bb.max.z : bb.min.z)];
  // denser samples, including the upper half of the floor (helps Floor 1 stay on-screen)
  for (const z of [bb.max.z, bb.min.z, c.z]) for (const x of [c.x, (c.x + bb.max.x) / 2, (c.x + bb.min.x) / 2, bb.max.x, bb.min.x])
    for (const y of [c.y, c.y + 0.6, c.y - 0.6, bb.max.y - 0.25, bb.min.y + 0.4]) pts.push(new THREE.Vector3(x, y, z));
  const vis = visibleInset();
  const rect = canvas.getBoundingClientRect();
  const toS = (v: THREE.Vector3) => {
    const q = v.clone().project(camera);
    return { x: (q.x + 1) / 2 * rect.width + rect.left, y: (1 - q.y) / 2 * rect.height + rect.top, z: q.z };
  };
  const inVis = (s: { x: number; y: number; z: number }) => s.z < 1 && s.x >= vis.left + rect.left && s.x <= vis.right + rect.left && s.y >= vis.top + rect.top && s.y <= vis.bottom + rect.top;
  const onScreen = pts.map(toS).filter(s => s.z < 1 && s.x >= rect.left && s.x < rect.right && s.y >= rect.top && s.y < rect.bottom);
  const hitsRight = (s: { x: number; y: number }) => { const h = pick(s.x, s.y); return !!h && h.floor === f && h.wing === w; };
  const good = onScreen.filter(hitsRight);
  const best = good.find(inVis) || good[0] || onScreen.find(inVis) || onScreen[0];
  if (!best) return { x: -1, y: -1, ok: false };
  return { x: best.x, y: best.y, ok: inVis(best) && hitsRight(best) };
}
(window as any).__ssApi = {
  state: () => ({ ...state }), project: (f: number, w: number) => projectWing(f, w),
  inset: () => visibleInset(),
  pickAt: (x: number, y: number) => pick(x, y),
  info: (x: number, y: number) => { pick(x, y); const hs = ray.intersectObjects(built.picks, false).slice(0, 3).map(h => ({ f: h.object.userData.floor, w: h.object.userData.wing, y: +h.point.y.toFixed(2), d: +h.distance.toFixed(2) })); return { hs, cam: camera.position.toArray(), tgt: controls.target.toArray(), fy: [3, 4].map(f => floorY(f)) }; },
  settled: () => !focusing && Math.abs(offX - wantX) < 1 && Math.abs(offY - wantY) < 1 && Math.abs(controls.target.y - focusY) < 0.15,
  look: (p: number[], tg: number[]) => { focusing = false; controls.minDistance = 5; controls.target.set(tg[0], tg[1], tg[2]); camera.position.set(p[0], p[1], p[2]); controls.update(); lastInteract = performance.now(); invalidate(); },
  view: (az: number) => {
    layout();
    const vis = visibleInset();
    const span = Math.max(28, built.top + 3);
    const frac = Math.max(0.5, vis.vh / Math.max(1, H));
    const d = Math.max(72, Math.min(160, (span / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / frac));
    const midY = span * 0.42;
    const elev = Math.min(16, d * 0.16);
    focusY = midY; focusing = false;
    controls.target.set(0, midY, 0);
    camera.position.set(Math.sin(az) * d, midY + elev, Math.cos(az) * d);
    controls.update(); layout(); offX = wantX; offY = wantY; applyOffset();
    lastInteract = performance.now(); invalidate();
  },
};
history.replaceState({ d: 0 }, "", location.href);
apply(); layout();
