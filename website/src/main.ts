import * as THREE from "three";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { buildPhotoreal } from "./scene";
import { WINGS, sqft } from "../../src/data";
gsap.registerPlugin(ScrollTrigger);

const $ = (s: string) => document.querySelector(s) as HTMLElement;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarse = matchMedia("(pointer:coarse)").matches;
const mobile = coarse || Math.min(innerWidth, innerHeight) < 600;
const lite = reduce || /[?&]lite/.test(location.search) || !(() => { try { return !!document.createElement("canvas").getContext("webgl2"); } catch { return false; } })();

// ---------------------------------------------------------------- smooth scroll
const lenis = reduce ? null : new Lenis({ lerp: 0.07, smoothWheel: true, wheelMultiplier: 0.8, touchMultiplier: 1.1 });
if (lenis) { lenis.on("scroll", ScrollTrigger.update); gsap.ticker.add(t => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0); }
document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach(a => a.addEventListener("click", e => {
  const t = document.querySelector(a.getAttribute("href")!); if (!t) return; e.preventDefault();
  lenis ? lenis.scrollTo(t as HTMLElement, { duration: 1.6 }) : (t as HTMLElement).scrollIntoView();
}));

// ---------------------------------------------------------------- intro logo letters
const logo = $("#logo"); logo.innerHTML = [...logo.textContent!].map(c => `<span>${c === " " ? "&nbsp;" : c}</span>`).join("");
const letters = [...logo.querySelectorAll("span")] as HTMLElement[];
const seeds = letters.map((_, i) => [Math.sin(i * 12.9) , Math.cos(i * 7.3), Math.sin(i * 3.1)]);
const react = $("#react"); react.innerHTML = [...react.textContent!].map(c => `<span>${c === " " ? "&nbsp;" : c}</span>`).join("");
const rLetters = [...react.querySelectorAll("span")] as HTMLElement[];
addEventListener("pointermove", e => {
  for (const s of rLetters) { const r = s.getBoundingClientRect(); const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const k = Math.exp(-(dx * dx + dy * dy) / 18000); s.style.transform = `translateY(${-k * 14}px)`; s.style.color = k > 0.35 ? "#e8c58f" : ""; }
}, { passive: true });

// ---------------------------------------------------------------- chapters + scroll progress
const chaps = [...document.querySelectorAll(".chap")] as HTMLElement[];
const intro = $("#intro"), rail = $("#rail span"), counter = $("#counter"), counterSub = $("#counterSub");
const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
let P = 0; let scn: { update(p: number): void } | null = null;
function story(p: number) {
  P = p;
  const ip = sm(0, 0.085, p);
  letters.forEach((l, i) => { const s = seeds[i]; l.style.transform = `translate(${s[0] * ip * 160}px, ${s[1] * ip * 90 - ip * 40}px) rotate(${s[2] * ip * 18}deg)`; l.style.opacity = String(1 - ip); l.style.filter = ip > 0.01 ? `blur(${ip * 6}px)` : ""; });
  (intro.querySelectorAll(".eyebrow,.lede,.hint") as NodeListOf<HTMLElement>).forEach(e => e.style.opacity = String(1 - sm(0, 0.05, p)));
  intro.style.visibility = ip >= 1 ? "hidden" : "visible";
  for (const c of chaps) {
    const a = +c.dataset.in!, b = +c.dataset.out!;
    const o = Math.min(sm(a, a + 0.03, p), 1 - sm(b - 0.03, b, p));
    c.style.visibility = o > 0.001 ? "visible" : "hidden"; c.style.opacity = o > 0.001 ? "1" : "0";
    [...c.children].forEach((k, i) => { const e = k as HTMLElement; const d = i * 0.008;
      const oi = Math.min(sm(a + d, a + d + 0.03, p), 1 - sm(b - 0.03 - (2 - i) * 0.004, b - (2 - i) * 0.004, p));
      e.style.opacity = String(oi); e.style.transform = `translateY(${(1 - oi) * (p < (a + b) / 2 ? 22 : -14)}px)`; });
  }
  rail.style.height = (p * 100) + "%";
  // floor counter (02 · Rising : 0.24 -> 0.50)
  const fr = (p - 0.25) / 0.25 * 8;
  const f = Math.max(0, Math.min(7, Math.floor(fr)));
  counter.textContent = f === 0 ? "Ground" : "Floor 0" + f;
  counterSub.textContent = f === 0 ? "Retail and entrance level" : f === 7 ? "Seven floors, 28 homes" : `Four 3 BHK homes · ${f * 4} so far`;
  if (scn) scn.update(p);
}
const prog = { p: 0 };
gsap.to(prog, { p: 1, ease: "none", scrollTrigger: { trigger: ".story", start: "top top", end: "bottom bottom", scrub: reduce ? true : 1.3 }, onUpdate: () => story(prog.p) });
const top = $(".top");
const solid = () => top.classList.toggle("solid", ($(".content").getBoundingClientRect().top) < 80);
addEventListener("scroll", solid, { passive: true }); solid();
document.querySelectorAll(".sec > *").forEach(el => { el.classList.add("reveal"); ScrollTrigger.create({ trigger: el, start: "top 88%", once: true, onEnter: () => el.classList.add("in") }); });

// ---------------------------------------------------------------- wings
const tabs = $("#tabs"), wingEl = $("#wing");
function showWing(i: number) {
  const w = WINGS[i];
  tabs.querySelectorAll("button").forEach((b, j) => b.setAttribute("aria-selected", String(j === i)));
  wingEl.innerHTML = `<img src="../${w.plan}" alt="${w.name} floor plan" loading="lazy">
    <div><h3>${w.name}</h3><p class="faces">${w.faces}</p>
    <div class="areas"><div><b>${w.sbu.toLocaleString("en-IN")}</b><span>Super built-up sq ft</span></div><div><b>${w.builtUp.toLocaleString("en-IN")}</b><span>Built-up sq ft</span></div><div><b>${sqft(w.carpet).toLocaleString("en-IN")}</b><span>Carpet sq ft</span></div></div>
    <ul class="rooms">${w.rooms.filter(r => !/Vestibule|Store|Utility/.test(r[1])).map(r => `<li>${r[1]} <span>${r[2]}</span></li>`).join("")}</ul></div>`;
}
WINGS.forEach((w, i) => { const b = document.createElement("button"); b.type = "button"; b.role = "tab"; b.textContent = w.name; b.onclick = () => showWing(i); tabs.appendChild(b); });
showWing(0);

// ---------------------------------------------------------------- enquiry -> WhatsApp
$("#form").addEventListener("submit", e => {
  e.preventDefault(); const d = new FormData(e.target as HTMLFormElement);
  const txt = `Hello, I am interested in Surreal Shyam, Udaipur.\nName: ${d.get("name")}\nPhone: ${d.get("phone")}\nPreferred: ${d.get("wing")}\n${d.get("msg") || ""}`;
  window.open("https://wa.me/919610972223?text=" + encodeURIComponent(txt), "_blank", "noopener");
});

// ---------------------------------------------------------------- 3D
interface Scn { update(p: number): void; }

const loadbar = $("#loadbar");
if (lite) { loadbar.classList.add("done"); }
else scn = start3D();

function start3D(): Scn {
  const canvas = $("#stage") as unknown as HTMLCanvasElement;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: "high-performance" });
  let dpr = Math.min(devicePixelRatio || 1, mobile ? 1.5 : 1.75);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.localClippingEnabled = true;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x3c4a63, 160, 520);
  const hemi = new THREE.HemisphereLight(0xdfe6f5, 0x8a7a66, 0.3); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffdcb0, 1.0); sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 10, far: 200 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; sun.shadow.radius = 4;
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(mobile && innerHeight > innerWidth ? 42 : 34, 1, 0.5, 2000);
  let dirty = true;
  const built = buildPhotoreal(scene, renderer, sun, hemi, { mobile, onChange: () => { dirty = true; } });
  const B = built.build;
  let prog = 0.15; const pt = setInterval(() => { prog = Math.min(0.9, prog + 0.07); (loadbar.firstElementChild as HTMLElement).style.width = prog * 100 + "%"; }, 250);
  built.ready.then(() => {
    clearInterval(pt); (loadbar.firstElementChild as HTMLElement).style.width = "100%"; loadbar.classList.add("done");
    renderer.compile(scene, camera);
    setP(P); renderer.shadowMap.needsUpdate = true; dirty = true;
    requestAnimationFrame(() => { canvas.classList.add("on"); setTimeout(() => $("#poster").classList.add("off"), 900); });
  }).catch(e => console.error("model load failed", e));

  // camera keyframes: p, azimuth (rad), height-to-fit (m), elevation (deg), target y
  const K: [number, number, number, number, number][] = [
    [0.00, -0.25, 120, 38, 2], [0.10, -0.45, 90, 30, 2], [0.22, -0.62, 62, 22, 6],
    [0.36, -0.40, 52, 14, 11], [0.52, -0.15, 46, 9, 14], [0.66, -0.62, 48, 7, 15],
    [0.80, -1.10, 52, 6, 15.5], [1.00, -1.80, 54, 8, 15.5]];
  const tgt = new THREE.Vector3(); let W = 1, H = 1;
  function resize() { W = innerWidth; H = innerHeight; renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix(); dirty = true; }
  addEventListener("resize", resize); resize();
  let mx = 0, my = 0, tx = 0, ty0 = 0;
  addEventListener("pointermove", e => { if (coarse) return; tx = e.clientX / W - 0.5; ty0 = e.clientY / H - 0.5; }, { passive: true });
  addEventListener("deviceorientation", e => { if (e.gamma == null || e.beta == null) return; tx = Math.max(-1, Math.min(1, e.gamma / 30)) * 0.25; ty0 = Math.max(-1, Math.min(1, (e.beta - 45) / 30)) * 0.15; }, { passive: true });
  let lastShadow = -1;
  function setP(p: number) {
    // build state
    const rise = sm(0.25, 0.50, p) * 8;                   // 0..8 floors
    const fl = Math.floor(rise), fr = rise - fl;
    const q = Math.min(1, Math.max(0, (fr - 0.1) / 0.75)), c1 = 1.25, settle = 1 + (c1 + 1) * Math.pow(q - 1, 3) + c1 * Math.pow(q - 1, 2);
    const step = fl + Math.min(1.03, settle);
    const cutH = (n: number) => n <= 0 ? 0.02 : n <= 1 ? 5.2 * n : 5.2 + (n - 1) * 3.2 + (n >= 8 ? 6 : 0);
    B.cut = p < 0.25 ? 0.02 : rise >= 8 ? 40 : cutH(step);
    B.skin = p < 0.53 ? -1 : 0.53 <= p && p < 0.63 ? sm(0.53, 0.63, p) * 33 : 40;
    B.light = p < 0.60 ? -1 : sm(0.60, 0.70, p) * 33;
    B.edge = sm(0.24, 0.27, p) * (1 - sm(0.62, 0.66, p));
    B.foot = sm(0.10, 0.16, p) * (1 - sm(0.24, 0.30, p));
    built.apply();
    if (Math.abs(B.cut - lastShadow) > 0.25) { lastShadow = B.cut; renderer.shadowMap.needsUpdate = true; }
    dirty = true;
  }
  function frame(p: number, t: number) {
    let i = 0; while (i < K.length - 2 && p > K[i + 1][0]) i++;
    const a = K[i], b = K[i + 1], a0 = K[Math.max(0, i - 1)], b1 = K[Math.min(K.length - 1, i + 2)];
    const u = Math.min(1, Math.max(0, (p - a[0]) / (b[0] - a[0])));
    const L = (j: number) => { const p0 = a0[j], p1 = a[j], p2 = b[j], p3 = b1[j], u2 = u * u, u3 = u2 * u;
      return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3); };
    const drift = Math.sin(t * 0.00009) * 0.05 * sm(0.66, 0.76, p);
    const az = L(1) + mx * (coarse ? 0.06 : 0.1) + drift, fit = L(2), el = THREE.MathUtils.degToRad(L(3) - my * (coarse ? 2 : 3.5)), ty = L(4);
    const vf = THREE.MathUtils.degToRad(camera.fov) / 2, hf = Math.atan(Math.tan(vf) * camera.aspect);
    const portrait = W <= 820 && H > W;
    const d = Math.max((fit / 2) / Math.tan(vf), (fit * (portrait ? 0.68 : 0.62)) / Math.tan(hf));
    tgt.set(0, ty, 0);
    camera.position.set(Math.sin(az) * d * Math.cos(el), ty + Math.sin(el) * d, Math.cos(az) * d * Math.cos(el));
    camera.lookAt(tgt);
    // composition: building to the right of the text on desktop, above the card on phones
    if (W > 820) camera.setViewOffset(W, H, -W * 0.14, 0, W, H); else camera.setViewOffset(W, H, 0, H * (0.12 - 0.06 * sm(0.62, 0.74, p)), W, H);
  }
  let visible = true, lastP = -1, frames = 0, acc = 0, lastT = performance.now();
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe($(".story"));
  function loop(t: number) {
    requestAnimationFrame(loop);
    if (!visible || document.hidden) return;
    mx += (tx - mx) * 0.05; my += (ty0 - my) * 0.05;
    const moving = (P > 0.66 && P < 1) || Math.abs(tx - mx) > 0.001 || Math.abs(ty0 - my) > 0.001;
    if (P !== lastP) { lastP = P; dirty = true; }
    if (!dirty && !moving) { lastT = t; return; }
    dirty = false;
    frame(P, t); renderer.render(scene, camera);
    // adaptive resolution: drop DPR if frames are slow
    const dt = t - lastT; lastT = t; if (dt < 200) { acc += dt; frames++; }
    if (frames >= 40) { const avg = acc / frames; frames = 0; acc = 0;
      if (avg > 30 && dpr > 1) { dpr = Math.max(1, dpr - 0.25); renderer.setPixelRatio(dpr); resize(); }
      (window as any).__fps = Math.round(1000 / avg); }
  }
  requestAnimationFrame(loop);
  return { update: setP };
}
story(0);
