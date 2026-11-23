// Procedural massing of Surreal Shyam, after the brochure render: retail glass podium, 7 residential floors with
// undulating white balcony bands, warm-grey walls, dark glazing, vertical louvres, rooftop pergola; roads, trees, entrance canopy.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const GROUND_H = 5.2, FLOOR_H = 3.2;
export const floorY = (f: number) => GROUND_H + (f - 1) * FLOOR_H;       // slab level of residential floor f (1..7)
// wing footprints in plan (x across the 80' road frontage, z from the rear (-) to the road (+))
export const WING_RECTS: Record<number, [number, number, number, number]> = {
  1: [0.0, 7.7, 0.0, 20.0], 2: [-7.7, 0.0, 0.0, 20.0], 3: [-7.7, 0.0, -20.0, 0.0], 4: [0.0, 7.7, -20.0, -6.0],
};
const LOBBY: [number, number, number, number] = [0.0, 7.7, -6.0, 0.0];
const X0 = -7.7, X1 = 7.7, Z0 = -20, Z1 = 20;

export interface Built { group: THREE.Group; picks: THREE.Mesh[]; top: number; dispose(): void; }

function mat(color: number, rough = 0.8, metal = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}
function box(g: THREE.Object3D, m: THREE.Material, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, shadow = true) {
  const me = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), m);
  me.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  me.castShadow = shadow; me.receiveShadow = true; g.add(me); return me;
}
function labelTexture(text: string, w = 1024, h = 160, color = "#ffe2a8") {
  const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d")!;
  x.fillStyle = "#18140f"; x.fillRect(0, 0, w, h);
  x.font = `600 ${Math.round(h * 0.52)}px Georgia, 'Times New Roman', serif`; x.textAlign = "center"; x.textBaseline = "middle";
  x.shadowColor = color; x.shadowBlur = 18; x.fillStyle = color;
  const spaced = text.split("").join(String.fromCharCode(8202));
  x.fillText(spaced, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// plate outline pushed out by a wavy offset: the band reads as the brochure's curved balcony lips
function bandShape(off: (side: number, t: number) => number, steps = 22): THREE.Shape {
  const P: THREE.Vector2[] = [];
  const sides: [number, number, number, number, number][] = [   // x0,z0 -> x1,z1, side id
    [X0, Z1, X1, Z1, 0], [X1, Z1, X1, Z0, 1], [X1, Z0, X0, Z0, 2], [X0, Z0, X0, Z1, 3]];
  for (const [ax, az, bx, bz, s] of sides) {
    const nx = s === 1 ? 1 : s === 3 ? -1 : 0, nz = s === 0 ? 1 : s === 2 ? -1 : 0;
    const n = s % 2 === 0 ? steps : Math.round(steps * 2.4);
    for (let i = 0; i < n; i++) {
      const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, o = off(s, t);
      P.push(new THREE.Vector2(x + nx * o, -(z + nz * o)));
    }
  }
  return new THREE.Shape(P);
}

export function buildScene(scene: THREE.Scene, opts: { mobile: boolean }): Built {
  const g = new THREE.Group(); scene.add(g);
  const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const disposables: { dispose(): void }[] = [];
  const M = {
    wall: mat(0xb9b1a4, 0.9), wallDark: mat(0x8f877b, 0.9), white: mat(0xf2eee6, 0.6), slab: mat(0xe9e4da, 0.7),
    glass: new THREE.MeshStandardMaterial({ color: 0x51677a, roughness: 0.06, metalness: 0.55, envMapIntensity: 2.2 }),
    lit: new THREE.MeshStandardMaterial({ color: 0x4a3d2e, roughness: 0.2, metalness: 0.2, emissive: 0xffc47e, emissiveIntensity: 0.55 }),
    glassWarm: new THREE.MeshStandardMaterial({ color: 0x2b2824, roughness: 0.1, metalness: 0.4, emissive: 0xffc27a, emissiveIntensity: 0.42, envMapIntensity: 1.5 }),
    louvre: mat(0x4a4744, 0.6, 0.3), frame: mat(0x1b1b1c, 0.5, 0.5), wood: mat(0x8a5a32, 0.7),
    rail: new THREE.MeshStandardMaterial({ color: 0x9fb4bf, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.28, depthWrite: false }),
    glow: new THREE.MeshBasicMaterial({ color: 0xffd394 }),
    road: mat(0x3b3b3d, 0.95), walk: mat(0xb8b0a3, 0.95), grass: mat(0x6f7f4c, 1), paving: mat(0xc9c0b2, 0.9),
    line: new THREE.MeshBasicMaterial({ color: 0xe9e4d6 }), trunk: mat(0x5b4633, 1), stone: mat(0x2c2a28, 0.6),
  };
  Object.values(M).forEach(m => disposables.push(m));

  // ---------------------------------------------------------------- ground floor: retail glass podium + entrance
  box(g, M.stone, X0 - 0.2, X1 + 0.2, 0, 0.35, Z0 - 0.2, Z1 + 0.2);
  box(g, M.glassWarm, X0 + 0.25, X1 - 0.25, 0.35, GROUND_H - 0.45, Z0 + 0.25, Z1 - 0.25, false);
  for (let x = X0 + 0.25; x <= X1 - 0.2; x += 1.6) { box(g, M.frame, x - 0.04, x + 0.04, 0.35, GROUND_H - 0.4, Z1 - 0.3, Z1 - 0.2, false); }
  for (let z = Z0 + 0.25; z <= Z1 - 0.2; z += 1.6) { box(g, M.frame, X0 + 0.2, X0 + 0.3, 0.35, GROUND_H - 0.4, z - 0.04, z + 0.04, false);
    box(g, M.frame, X1 - 0.3, X1 - 0.2, 0.35, GROUND_H - 0.4, z - 0.04, z + 0.04, false); }
  box(g, M.frame, X0 + 0.2, X1 - 0.2, 2.95, 3.05, Z1 - 0.32, Z1 - 0.18, false);                        // storefront transom
  box(g, M.frame, X0 + 0.18, X0 + 0.32, 2.95, 3.05, Z0 + 0.2, Z1 - 0.2, false);
  box(g, M.wallDark, X0 - 0.05, X1 + 0.05, GROUND_H - 0.45, GROUND_H, Z0 - 0.05, Z1 + 0.05);           // podium fascia
  // entrance canopy on the 30' entry road side (rear), with the lit name board
  const ex0 = X0 - 7.0, ez0 = -18.5, ez1 = -9.5;
  box(g, M.stone, ex0, X0, 0, 0.18, ez0, ez1);
  box(g, M.louvre, ex0, X0, 4.6, 5.4, ez0, ez1);
  box(g, M.wood, ex0 + 0.1, X0, 4.45, 4.6, ez0 + 0.1, ez1 - 0.1, false);
  box(g, M.louvre, ex0, ex0 + 0.5, 0, 4.6, ez0, ez0 + 0.5); box(g, M.louvre, ex0, ex0 + 0.5, 0, 4.6, ez1 - 0.5, ez1);
  const signT = labelTexture("SURREAL SHYAM"); disposables.push(signT);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 1.3), new THREE.MeshBasicMaterial({ map: signT }));
  sign.position.set(ex0 - 0.01, 5.0, (ez0 + ez1) / 2); sign.rotation.y = -Math.PI / 2; g.add(sign);
  const sign2 = sign.clone(); sign2.position.set(X0 - 0.02, GROUND_H - 0.22, 9.0); sign2.scale.set(0.9, 0.55, 1); g.add(sign2);
  const sign3 = sign.clone(); sign3.position.set(0, GROUND_H - 0.22, Z1 + 0.07); sign3.rotation.y = 0; sign3.scale.set(0.9, 0.55, 1); g.add(sign3);

  // ---------------------------------------------------------------- residential floors
  const F = 7;
  for (let f = 1; f <= F; f++) {
    const y0 = floorY(f), y1 = y0 + FLOOR_H;
    // wall body, set back from the bands
    box(g, M.wall, X0 + 0.35, X1 - 0.35, y0, y1, Z0 + 0.35, Z1 - 0.35);
    // glazing on the four faces (bays differ per side; alternate a few to break repetition)
    const win = (x0: number, x1: number, z0: number, z1: number, tall: boolean) => {
      const ya = y0 + (tall ? 0.15 : 0.95), yb = y0 + 2.45;
      box(g, rnd() < 0.3 ? M.lit : M.glass, x0, x1, ya, yb, z0, z1, false);
    };
    for (const [a, b, tall] of [[-6.6, -4.6, true], [-3.6, -1.8, false], [1.4, 3.2, false], [4.4, 6.6, true]] as [number, number, boolean][]) {
      win(a, b, Z1 - 0.37, Z1 - 0.3, tall); win(a, b, Z0 + 0.3, Z0 + 0.37, !tall);
    }
    for (const [a, b, tall] of [[16.2, 18.6, false], [12.6, 15.4, true], [8.6, 10.2, false], [4.0, 6.2, true], [-2.6, -0.6, false],
      [-6.0, -4.0, true], [-10.4, -8.6, false], [-14.6, -12.4, true], [-18.6, -16.8, false]] as [number, number, boolean][]) {
      win(X1 - 0.37, X1 - 0.3, a, b, tall); win(X0 + 0.3, X0 + 0.37, a, b, !tall);
    }
    // undulating white band at the slab + a thinner lip at the head, with a glass balustrade where the band bulges
    const phase = f * 0.9;
    const off = (s: number, t: number) => {
      const base = 0.5;
      if (s === 1 || s === 3) return base + 0.95 * Math.max(0, Math.sin((t * 3 + phase * (s === 1 ? 1 : -1)) * Math.PI)) ** 0.6;
      return base + 0.7 * Math.max(0, Math.sin((t * 2 + 0.25) * Math.PI)) ** 0.6;
    };
    const shp = bandShape(off);
    const bandG = new THREE.ExtrudeGeometry(shp, { depth: 0.38, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2, curveSegments: 4 });
    bandG.rotateX(-Math.PI / 2); disposables.push(bandG);
    const band = new THREE.Mesh(bandG, M.white); band.position.y = y0 - 0.32; band.castShadow = true; band.receiveShadow = true; g.add(band);
    const rail = new THREE.Mesh(new THREE.ExtrudeGeometry(shp, { depth: 1.0, bevelEnabled: false, curveSegments: 4 }), M.rail);
    rail.geometry.rotateX(-Math.PI / 2); rail.position.y = y0 + 0.12; rail.scale.set(0.985, 1, 0.995); g.add(rail); disposables.push(rail.geometry);
    // warm soffit glow line under the band (dusk look)
    const glow = new THREE.Mesh(new THREE.BoxGeometry(X1 - X0 + 0.8, 0.03, 0.08), M.glow);
    glow.position.set(0, y0 - 0.36, Z1 + 0.45); g.add(glow);
    // vertical louvre panels between some bays (dark fins)
    const fins = (cx: number, cz: number, along: "x" | "z") => {
      for (let k = -3; k <= 3; k++) {
        const o = k * 0.16;
        if (along === "x") box(g, M.louvre, cx + o - 0.03, cx + o + 0.03, y0 + 0.08, y1 - 0.12, cz - 0.12, cz + 0.12, false);
        else box(g, M.louvre, cx - 0.12, cx + 0.12, y0 + 0.08, y1 - 0.12, cz + o - 0.03, cz + o + 0.03, false);
      }
    };
    fins(X1 - 0.2, 7.2, "z"); fins(X1 - 0.2, -11.4, "z"); fins(X0 + 0.2, 1.8, "z"); fins(X0 + 0.2, -7.4, "z");
    fins(-0.1, Z1 - 0.2, "x");
  }
  // roof: parapet band, pergola louvres, lift/stair core
  const roofY = floorY(F) + FLOOR_H;
  box(g, M.white, X0 - 0.4, X1 + 0.4, roofY - 0.3, roofY + 0.9, Z0 - 0.4, Z1 + 0.4);
  box(g, M.wall, LOBBY[0] - 1, LOBBY[1] - 0.6, roofY + 0.9, roofY + 3.6, LOBBY[2] - 1, LOBBY[3] + 1);
  for (let z = 3; z <= 17; z += 0.55) box(g, M.louvre, X0 + 0.6, X1 - 0.6, roofY + 3.0, roofY + 3.25, z - 0.08, z + 0.08, false);
  box(g, M.white, X0 + 0.4, X0 + 0.9, roofY + 0.9, roofY + 3.3, 2.6, 17.6); box(g, M.white, X1 - 0.9, X1 - 0.4, roofY + 0.9, roofY + 3.3, 2.6, 17.6);

  // ---------------------------------------------------------------- site: paving, roads, trees, neighbours
  const ground = new THREE.Mesh(new THREE.CircleGeometry(700, 48), M.grass); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true; g.add(ground);
  box(g, M.paving, X0 - 9.5, X1 + 6, -0.01, 0.02, Z0 - 6, Z1 + 4.5, false);
  box(g, M.road, -260, 260, -0.005, 0.03, Z1 + 4.5, Z1 + 4.5 + 24.4, false);               // 80' main road
  box(g, M.walk, -260, 260, 0, 0.12, Z1 + 2.0, Z1 + 4.5, false);
  box(g, M.road, X0 - 9.5 - 9.1, X0 - 9.5, -0.004, 0.031, -260, Z1 + 4.5, false);             // 30' entry road
  for (let x = -250; x < 250; x += 9) box(g, M.line, x, x + 4.5, 0.031, 0.036, Z1 + 16.6, Z1 + 16.8, false);
  for (let z = -250; z < Z1 + 4; z += 9) box(g, M.line, X0 - 14.1, X0 - 13.9, 0.032, 0.037, z, z + 4.5, false);
  // trees (low-poly crowns), more on the road edges like the render
  const crownG = new THREE.IcosahedronGeometry(1, 1); disposables.push(crownG);
  const greens = [0x4d6b34, 0x5d7a3c, 0x3f5c2e, 0x6b8443].map(c => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, flatShading: true }); disposables.push(m); return m; });
  const tree = (x: number, z: number, s = 1) => {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.18 * s, 2.6 * s, 6), M.trunk); t.position.set(x, 1.3 * s, z); t.castShadow = true; g.add(t);
    for (let k = 0; k < 4; k++) {
      const c = new THREE.Mesh(crownG, greens[Math.floor(rnd() * greens.length)]);
      const r = (1.3 + rnd() * 0.7) * s; c.scale.set(r, r * 0.8, r);
      c.position.set(x + (rnd() - 0.5) * 1.8 * s, (3.0 + rnd() * 1.2) * s, z + (rnd() - 0.5) * 1.8 * s);
      c.castShadow = !opts.mobile; g.add(c);
    }
  };
  for (let x = -18; x <= 18; x += 5.2) tree(x, Z1 + 3.3, 0.9 + rnd() * 0.3);
  for (let z = -17; z <= 18; z += 5.6) tree(X0 - 8.4, z, 0.85 + rnd() * 0.3);
  for (let k = 0; k < 30; k++) { const x = -120 + rnd() * 240, z = -150 + rnd() * 120; if (Math.abs(x) < 30 && z > -40) continue; tree(x, z, 1.1 + rnd() * 0.8); }
  for (let x = -60; x <= 60; x += 7.5) if (Math.abs(x) > 22) tree(x, Z1 + 3.3, 0.9 + rnd() * 0.3);
  // neighbouring low-rise blocks and a ring of Aravalli hills
  const nb = mat(0x9c978f, 1);
  disposables.push(nb);
  for (const [x, z, w, d, h] of [[34, -14, 14, 18, 9], [-44, -36, 16, 14, 12], [8, -46, 20, 12, 7], [-40, 4, 10, 18, 8], [40, 74, 22, 14, 10], [-46, 76, 18, 12, 6], [62, 30, 16, 20, 11], [-70, 40, 18, 16, 9]])
    box(g, nb, x - w / 2, x + w / 2, 0, h, z - d / 2, z + d / 2);
  const hillM = new THREE.MeshStandardMaterial({ color: 0x7b8670, roughness: 1, flatShading: true }); disposables.push(hillM);
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2 + rnd() * 0.2, d = 380 + rnd() * 60, h = 24 + rnd() * 30;
    const hill = new THREE.Mesh(new THREE.ConeGeometry(80 + rnd() * 50, h, 7), hillM); hill.position.set(Math.cos(a) * d, h / 2 - 1, Math.sin(a) * d); g.add(hill);
  }

  // ---------------------------------------------------------------- merge static meshes per material (few draw calls on phones)
  g.updateMatrixWorld(true);
  const buckets = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; cast: boolean }>();
  for (const o of [...g.children]) {
    const me = o as THREE.Mesh;
    if (!me.isMesh || Array.isArray(me.material) || (me.material as THREE.Material).type === "MeshBasicMaterial" && (me.material as THREE.MeshBasicMaterial).map) continue;
    let geo = me.geometry.clone().applyMatrix4(me.matrixWorld);
    if (geo.index) geo = geo.toNonIndexed();
    for (const k of Object.keys(geo.attributes)) if (!["position", "normal", "uv"].includes(k)) geo.deleteAttribute(k);
    if (!geo.attributes.uv) geo.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    const b = buckets.get(me.material as THREE.Material) || { geos: [], cast: false };
    b.geos.push(geo); b.cast = b.cast || me.castShadow; buckets.set(me.material as THREE.Material, b);
    g.remove(me); me.geometry.dispose();
  }
  for (const [m, b] of buckets) {
    const merged = mergeGeometries(b.geos, false); b.geos.forEach(x => x.dispose());
    if (!merged) continue;
    const me = new THREE.Mesh(merged, m); me.castShadow = b.cast; me.receiveShadow = !(m as THREE.MeshStandardMaterial).transparent; g.add(me); disposables.push(merged);
  }

  // ---------------------------------------------------------------- pick volumes: one per floor and wing
  const picks: THREE.Mesh[] = [];
  for (let f = 1; f <= F; f++) for (const w of [1, 2, 3, 4]) {
    const [a, b, c, d] = WING_RECTS[w];
    const pad = 0.75, gx0 = a === X0 ? a - pad : a + 0.06, gx1 = b === X1 ? b + pad : b - 0.06;
    const gz0 = c === Z0 ? c - pad : c + 0.06, gz1 = d === Z1 ? d + pad : d - 0.06;
    const m = new THREE.MeshBasicMaterial({ color: 0xe8b25c, transparent: true, opacity: 0, depthWrite: false });
    const me = new THREE.Mesh(new THREE.BoxGeometry(gx1 - gx0, FLOOR_H - 0.12, gz1 - gz0), m);
    me.position.set((gx0 + gx1) / 2, floorY(f) + FLOOR_H / 2 - 0.2, (gz0 + gz1) / 2);
    me.userData = { floor: f, wing: w }; me.renderOrder = 10; g.add(me); picks.push(me);
    disposables.push(me.geometry, m);
  }
  return { group: g, picks, top: roofY + 3.6, dispose: () => disposables.forEach(d => d.dispose()) };
}
