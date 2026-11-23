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

export function buildScene(scene: THREE.Scene, opts: { mobile: boolean }): Built {
  const g = new THREE.Group(); scene.add(g);
  const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const disposables: { dispose(): void }[] = [];
  const M = {
    wall: mat(0xa59c90, 0.92), wallDark: mat(0x6f6b66, 0.9), white: mat(0xf2eee6, 0.6), slab: mat(0xb7afa1, 0.82),
    glass: new THREE.MeshStandardMaterial({ color: 0x1d2630, roughness: 0.05, metalness: 0.6, envMapIntensity: 2.0 }),
    lit: new THREE.MeshStandardMaterial({ color: 0x4a3d2e, roughness: 0.2, metalness: 0.2, emissive: 0xffc47e, emissiveIntensity: 0.55 }),
    glassWarm: new THREE.MeshStandardMaterial({ color: 0x2b2824, roughness: 0.1, metalness: 0.4, emissive: 0xffc27a, emissiveIntensity: 0.3, envMapIntensity: 1.5 }),
    louvre: mat(0x4a4744, 0.6, 0.3), frame: mat(0x1b1b1c, 0.5, 0.5), wood: mat(0x8a5a32, 0.7),
    rail: new THREE.MeshStandardMaterial({ color: 0x9fb4bf, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }),
    glow: new THREE.MeshBasicMaterial({ color: 0xffc67a }),
    road: mat(0x3b3b3d, 0.95), walk: mat(0xb8b0a3, 0.95), grass: mat(0x6f7f4c, 1), paving: mat(0xc9c0b2, 0.9),
    line: new THREE.MeshBasicMaterial({ color: 0xe9e4d6 }), trunk: mat(0x5b4633, 1), stone: mat(0x2c2a28, 0.6),
  };
  Object.values(M).forEach(m => disposables.push(m));

  // ---------------------------------------------------------------- helpers: rounded footprint, wavy slab outline, face-aligned boxes
  const sstep = (a: number, b: number, v: number) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const R = 2.2;                                         // corner radius of the plan: slabs wrap the corners in curves
  interface OP { x: number; z: number; nx: number; nz: number; }
  const outline = (grow = 0, step = 0.55): OP[] => {      // rounded-rect perimeter (rect grown by `grow`), with outward normals
    const P: OP[] = [], r = R + grow, x0 = X0 - grow, x1 = X1 + grow, z0 = Z0 - grow, z1 = Z1 + grow;
    const line = (ax: number, az: number, bx: number, bz: number, nx: number, nz: number) => {
      const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / step));
      for (let i = 0; i < n; i++) P.push({ x: ax + (bx - ax) * i / n, z: az + (bz - az) * i / n, nx, nz });
    };
    const arc = (cx: number, cz: number, a0: number, a1: number) => {
      for (let i = 0; i < 9; i++) { const a = a0 + (a1 - a0) * i / 9; P.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, nx: Math.cos(a), nz: Math.sin(a) }); }
    };
    line(x0 + r, z1, x1 - r, z1, 0, 1); arc(x1 - r, z1 - r, Math.PI / 2, 0);
    line(x1, z1 - r, x1, z0 + r, 1, 0); arc(x1 - r, z0 + r, 0, -Math.PI / 2);
    line(x1 - r, z0, x0 + r, z0, 0, -1); arc(x0 + r, z0 + r, -Math.PI / 2, -Math.PI);
    line(x0, z0 + r, x0, z1 - r, -1, 0); arc(x0 + r, z1 - r, Math.PI, Math.PI / 2);
    return P;
  };
  const OUTL = outline();
  // swell of the balcony band: broad S-curved bulges on the two long faces, shifted floor by floor (diagonal rhythm of the render)
  const swell = (p: OP, f: number) => {
    const w = Math.abs(p.nx) ** 2; if (w < 0.01) return 0;
    const t = 0.5 + 0.5 * Math.cos((p.z / 12.5) * Math.PI * 2 + f * 2.1 + (p.nx > 0 ? 2.6 : 0));
    return sstep(0.3, 0.92, t) * w;
  };
  const offAt = (p: OP, f: number) => 0.28 + 0.14 * Math.abs(p.nx) + swell(p, f) * (p.nx < 0 ? 1.3 : 0.9);
  const shapeOf = (pts: OP[], off: (p: OP) => number) => new THREE.Shape(pts.map(p => { const o = off(p); return new THREE.Vector2(p.x + p.nx * o, -(p.z + p.nz * o)); }));
  const roundRect = (x0: number, x1: number, z0: number, z1: number, r: number) => {
    const s = new THREE.Shape(); s.moveTo(x0 + r, -z1);
    s.lineTo(x1 - r, -z1); s.absarc(x1 - r, -(z1 - r), r, Math.PI / 2, 0, true);
    s.lineTo(x1, -(z0 + r)); s.absarc(x1 - r, -(z0 + r), r, 0, -Math.PI / 2, true);
    s.lineTo(x0 + r, -z0); s.absarc(x0 + r, -(z0 + r), r, -Math.PI / 2, -Math.PI, true);
    s.lineTo(x0, -(z1 - r)); s.absarc(x0 + r, -(z1 - r), r, Math.PI, Math.PI / 2, true);
    return s;
  };
  const extrude = (s: THREE.Shape, y0: number, h: number, m: THREE.Material, bevel = 0, shadow = true) => {
    const geo = new THREE.ExtrudeGeometry(s, { depth: h - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 6 });
    geo.rotateX(-Math.PI / 2); disposables.push(geo);
    const me = new THREE.Mesh(geo, m); me.position.y = y0 + bevel; me.castShadow = shadow; me.receiveShadow = true; g.add(me); return me;
  };
  // vertical glass ribbon along a polyline of (x,z) points (two-sided), for balustrades
  const ribbon = (pts: [number, number][], ya: number, yb: number, m: THREE.Material) => {
    const pos: number[] = [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      pos.push(ax, ya, az, bx, ya, bz, bx, yb, bz, ax, ya, az, bx, yb, bz, ax, yb, az);
    }
    if (!pos.length) return;
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals(); disposables.push(geo);
    g.add(new THREE.Mesh(geo, m));
  };
  type Face = "-x" | "+x" | "+z" | "-z";
  const WP = 0.35;                                       // wall plane inset from the footprint edge
  // box on a facade: u along the face, o = distance out of the wall plane (negative = into the wall)
  const fbox = (face: Face, u0: number, u1: number, ya: number, yb: number, o0: number, o1: number, m: THREE.Material, shadow = false) => {
    if (face === "-x") return box(g, m, X0 + WP - o1, X0 + WP - o0, ya, yb, u0, u1, shadow);
    if (face === "+x") return box(g, m, X1 - WP + o0, X1 - WP + o1, ya, yb, u0, u1, shadow);
    if (face === "+z") return box(g, m, u0, u1, ya, yb, Z1 - WP + o0, Z1 - WP + o1, shadow);
    return box(g, m, u0, u1, ya, yb, Z0 + WP - o1, Z0 + WP - o0, shadow);
  };
  const pickGlass = () => rnd() < 0.2 ? M.glassWarm : M.glass;
  const windowAt = (face: Face, u: number, w: number, ya: number, yb: number) => {
    fbox(face, u - w / 2 - 0.07, u + w / 2 + 0.07, ya - 0.07, yb + 0.07, -0.02, 0.1, M.frame);
    fbox(face, u - w / 2, u + w / 2, ya, yb, 0.05, 0.16, pickGlass());
    fbox(face, u - 0.025, u + 0.025, ya, yb, 0.1, 0.19, M.frame);            // centre mullion
  };
  const finsAt = (face: Face, u: number, ya: number, yb: number, n = 6) => {  // dark vertical louvre panel
    for (let k = 0; k < n; k++) { const c = u + (k - (n - 1) / 2) * 0.21; fbox(face, c - 0.045, c + 0.045, ya, yb, 0.02, 0.4, M.louvre); }
    fbox(face, u - n * 0.105 - 0.04, u + n * 0.105 + 0.04, ya, yb, -0.05, 0.05, M.frame);
  };

  // ---------------------------------------------------------------- ground floor: double-height glass retail podium + lobby
  box(g, M.stone, X0 - 0.4, X1 + 0.4, 0, 0.35, Z0 - 0.4, Z1 + 0.4);
  extrude(roundRect(X0 + 0.5, X1 - 0.5, Z0 + 0.5, Z1 - 0.5, R - 0.5), 0.35, GROUND_H - 1.25, M.glassWarm, 0, false);
  const GT = GROUND_H - 0.9;                                                  // underside of the podium band
  const flatsX = [X0 + R, X1 - R], flatsZ = [Z0 + R, Z1 - R];
  for (let u = flatsX[0] + 0.3; u <= flatsX[1] - 0.2; u += 1.4) { box(g, M.frame, u - 0.04, u + 0.04, 0.35, GT, Z1 - 0.56, Z1 - 0.44, false); box(g, M.frame, u - 0.04, u + 0.04, 0.35, GT, Z0 + 0.44, Z0 + 0.56, false); }
  for (let u = flatsZ[0] + 0.3; u <= flatsZ[1] - 0.2; u += 1.4) for (const [x, s] of [[X0, -1], [X1, 1]] as [number, number][]) box(g, M.frame, x - s * 0.52 - 0.06, x - s * 0.52 + 0.06, 0.35, GT, u - 0.04, u + 0.04, false);
  for (const [x0, x1, z0, z1] of [[X0 + R, X1 - R, Z1 - 0.56, Z1 - 0.44], [X0 + R, X1 - R, Z0 + 0.44, Z0 + 0.56], [X0 + 0.44, X0 + 0.56, Z0 + R, Z1 - R], [X1 - 0.56, X1 - 0.44, Z0 + R, Z1 - R]] as number[][])
    box(g, M.frame, x0, x1, 3.35, 3.45, z0, z1, false);                      // transom line at mezzanine height
  for (let u = flatsX[0]; u <= flatsX[1] + 0.1; u += 5.5) { box(g, M.stone, u - 0.35, u + 0.35, 0.35, GT, Z1 - 0.95, Z1 - 0.45); box(g, M.stone, u - 0.35, u + 0.35, 0.35, GT, Z0 + 0.45, Z0 + 0.95); }
  for (let u = flatsZ[0]; u <= flatsZ[1] + 0.1; u += 5.7) { box(g, M.stone, X0 + 0.45, X0 + 0.95, 0.35, GT, u - 0.35, u + 0.35); box(g, M.stone, X1 - 0.95, X1 - 0.45, 0.35, GT, u - 0.35, u + 0.35); }
  // entrance lobby on the long (30') side: warm lit double-height glazing framed by dark stone portal
  box(g, M.glow, X0 + 0.46, X0 + 0.5, 0.5, GT - 0.1, -5.6, -0.4, false);
  for (const z of [-6.0, -3.0, 0.0]) box(g, M.stone, X0 - 0.2, X0 + 0.6, 0.35, GT, z - 0.3, z + 0.3);
  box(g, M.stone, X0 - 0.2, X0 + 0.6, GT - 0.55, GT, -6.3, 0.3);
  for (let z = -5.4; z < -0.2; z += 1.2) box(g, M.frame, X0 + 0.38, X0 + 0.48, 0.5, GT - 0.1, z - 0.03, z + 0.03, false);
  // podium band (wavy lip, like the slabs) carrying the name boards
  extrude(shapeOf(OUTL, p => 0.55 + 0.12 * swell(p, 0.4)), GT, 0.9, M.slab, 0.04);
  // entrance canopy on the 30' entry road side, with the lit name board
  const ex0 = X0 - 7.0, ez0 = -18.5, ez1 = -9.5;
  box(g, M.stone, ex0, X0, 0, 0.18, ez0, ez1);
  box(g, M.louvre, ex0, X0, 4.6, 5.4, ez0, ez1);
  box(g, M.wood, ex0 + 0.1, X0, 4.45, 4.6, ez0 + 0.1, ez1 - 0.1, false);
  box(g, M.louvre, ex0, ex0 + 0.5, 0, 4.6, ez0, ez0 + 0.5); box(g, M.louvre, ex0, ex0 + 0.5, 0, 4.6, ez1 - 0.5, ez1);
  const signT = labelTexture("SURREAL SHYAM"); disposables.push(signT);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 1.3), new THREE.MeshBasicMaterial({ map: signT }));
  sign.position.set(ex0 - 0.01, 5.0, (ez0 + ez1) / 2); sign.rotation.y = -Math.PI / 2; g.add(sign);
  const sign2 = sign.clone(); sign2.position.set(X0 - 0.62, GT + 0.45, 9.0); sign2.scale.set(0.9, 0.55, 1); g.add(sign2);
  const sign3 = sign.clone(); sign3.position.set(0, GT + 0.45, Z1 + 0.62); sign3.rotation.y = 0; sign3.scale.set(0.9, 0.55, 1); g.add(sign3);

  // ---------------------------------------------------------------- residential floors
  const F = 7;
  const yBase = floorY(1) - 0.35, yTop = floorY(F) + FLOOR_H;
  extrude(roundRect(X0 + WP, X1 - WP, Z0 + WP, Z1 - WP, R - WP), yBase, yTop - yBase, M.wall);   // plaster body
  const dl = new THREE.CircleGeometry(0.13, 7); dl.rotateX(Math.PI / 2); disposables.push(dl);   // soffit downlight (faces down)
  const lights: THREE.BufferGeometry[] = [];
  for (let f = 1; f <= F; f++) {
    const y0 = floorY(f), y1 = y0 + FLOOR_H;
    // facade bays
    const wy0 = y0 + 0.2, wy1 = y0 + 2.75;
    for (const face of ["-x", "+x"] as Face[]) {
      for (let i = 0, u = -16.5; u <= 16.6; i++, u += 3.0) {
        const win = (face === "-x" ? i % 2 === 0 : i % 2 === 1);
        if (win) windowAt(face, u, 1.35, wy0, wy1); else if (face === "-x" || i % 4 === 0) finsAt(face, u, y0 + 0.1, y1 - 0.2, 5); else fbox(face, u - 0.7, u + 0.7, y0 + 0.1, y1 - 0.25, 0, 0.06, M.wallDark);
      }
    }
    for (const face of ["+z", "-z"] as Face[]) {
      fbox(face, -2.2, 2.2, y0 - 0.25, y1 - 0.35, 0, 0.1, M.wallDark);                  // grey accent panel
      windowAt(face, 0, 1.3, wy0, wy1);
      fbox(face, -2.15, 2.15, y0 + 1.0, y0 + 1.04, 0.1, 0.16, M.frame); fbox(face, -2.15, 2.15, y0 + 2.0, y0 + 2.04, 0.1, 0.16, M.frame);
      for (const cx of [-3.9, 3.9]) {                                                  // projecting balconies with glass rails
        const hw = 1.45, D = 1.75, r = 0.85, loc = new THREE.Shape();
        loc.moveTo(cx - hw, -0.1); loc.lineTo(cx - hw, D - r); loc.absarc(cx - hw + r, D - r, r, Math.PI, Math.PI / 2, true);
        loc.lineTo(cx + hw - r, D); loc.absarc(cx + hw - r, D - r, r, Math.PI / 2, 0, true); loc.lineTo(cx + hw, -0.1); loc.lineTo(cx - hw, -0.1);
        const mapP = (v: THREE.Vector2): [number, number] => face === "+z" ? [v.x, Z1 - WP + v.y] : [v.x, Z0 + WP - v.y];
        const slabS = new THREE.Shape(loc.getPoints(6).map(v => { const [x, z] = mapP(v); return new THREE.Vector2(x, -z); }));
        extrude(slabS, y0 - 0.3, 0.5, M.slab, 0.03);
        const lp = loc.getPoints(6).filter(v => v.y > -0.05).map(mapP); lp.pop();
        ribbon(lp, y0 + 0.22, y0 + 1.15, M.rail);
        windowAt(face, cx, 2.0, y0 + 0.1, y0 + 2.7);
        fbox(face, cx - 0.12, cx + 0.12, y0 + 0.2, y0 + 2.7, 0.15, 0.2, M.frame);
      }
    }
    // wavy slab (thick curved lip wrapping the corners) + solid apron + glass rail on the bulges
    const sOff = (p: OP) => offAt(p, f);
    extrude(shapeOf(OUTL, sOff), y0 - 0.34, 0.5, M.slab, 0.035);
    const ap = outline(-0.12);
    extrude(shapeOf(ap, p => offAt({ ...p }, f) - 0.0), y0 + 0.16, 0.5, M.slab, 0);
    const bulge: [number, number][] = [];
    const flush = () => { if (bulge.length > 1) ribbon(bulge.slice(), y0 + 0.66, y0 + 1.4, M.rail); bulge.length = 0; };
    for (const p of ap) { const o = offAt(p, f) - 0.0; if (swell(p, f) > 0.4) bulge.push([p.x + p.nx * (o - 0.02), p.z + p.nz * (o - 0.02)]); else flush(); }
    flush();
    // warm downlights tucked under the swells
    for (const p of OUTL) { if (swell(p, f) > 0.55 && Math.abs(p.nx) > 0.99) { const o = offAt(p, f) * 0.62 + 0.2; lights.push(dl.clone().translate(p.x + p.nx * o, y0 - 0.355, p.z + p.nz * o)); } }
  }
  for (const l of lights) { const me = new THREE.Mesh(l, M.glow); g.add(me); disposables.push(l); }
  // roof: parapet ring, raised louvre screen on the long side, pergola, lift/stair core
  const roofY = yTop;
  const ring = roundRect(X0 - 0.25, X1 + 0.25, Z0 - 0.25, Z1 + 0.25, R + 0.25);
  const hole = roundRect(X0 + 0.45, X1 - 0.45, Z0 + 0.45, Z1 - 0.45, R - 0.45); ring.holes.push(hole as unknown as THREE.Path);
  extrude(ring, roofY - 0.34, 1.7, M.slab, 0.04);
  box(g, M.wall, X0 + 0.4, X1 - 0.4, roofY - 0.4, roofY + 0.05, Z0 + 0.4, Z1 - 0.4);
  box(g, M.slab, X0 - 0.25, X0 + 0.45, roofY + 1.3, roofY + 2.5, -15, 11);                          // raised screen wall on the 30' side
  for (let k = 0; k < 9; k++) box(g, M.louvre, X0 - 0.12, X0 + 0.2, roofY + 1.4 + k * 0.125, roofY + 1.4 + k * 0.125 + 0.07, -14.2, 10.2, false);
  box(g, M.wall, LOBBY[0] - 1, LOBBY[1] - 0.6, roofY + 0.9, roofY + 3.6, LOBBY[2] - 1, LOBBY[3] + 1);
  for (const px of [X0 + 1.2, X1 - 1.2]) for (const pz of [3.2, 10.4, 17.2]) box(g, M.slab, px - 0.17, px + 0.17, roofY + 0.9, roofY + 3.45, pz - 0.17, pz + 0.17);
  for (const pz of [3.2, 10.4, 17.2]) box(g, M.slab, X0 + 1.0, X1 - 1.0, roofY + 3.25, roofY + 3.5, pz - 0.14, pz + 0.14);
  for (let x = X0 + 1.4; x <= X1 - 1.3; x += 0.5) box(g, M.louvre, x - 0.07, x + 0.07, roofY + 3.5, roofY + 3.62, 3.0, 17.4, false);

  // ---------------------------------------------------------------- site: paving, roads, trees, neighbours
  const ground = new THREE.Mesh(new THREE.CircleGeometry(700, 48), M.grass); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true; g.add(ground);
  box(g, M.paving, X0 - 9.5, X1 + 6, -0.01, 0.02, Z0 - 6, Z1 + 4.5, false);
  box(g, M.road, -260, 260, -0.005, 0.03, Z1 + 4.5, Z1 + 4.5 + 24.4, false);               // 80' main road
  box(g, M.walk, -260, 260, 0, 0.12, Z1 + 2.0, Z1 + 4.5, false);
  box(g, M.road, X0 - 9.5 - 9.1, X0 - 9.5, -0.004, 0.031, -260, Z1 + 4.5, false);             // 30' entry road
  for (let x = -250; x < 250; x += 9) box(g, M.line, x, x + 4.5, 0.031, 0.036, Z1 + 16.6, Z1 + 16.8, false);
  for (let z = -250; z < Z1 + 4; z += 9) box(g, M.line, X0 - 14.1, X0 - 13.9, 0.032, 0.037, z, z + 4.5, false);
  // trees (low-poly crowns), more on the road edges like the render
  const crownG = new THREE.IcosahedronGeometry(1, 2), crownLo = new THREE.IcosahedronGeometry(1, 1); disposables.push(crownG, crownLo);
  const greens = [0x4d6b34, 0x5d7a3c, 0x3f5c2e, 0x6b8443].map(c => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, flatShading: false }); disposables.push(m); return m; });
  const tree = (x: number, z: number, s = 1, hi = false) => {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.18 * s, 2.6 * s, 6), M.trunk); t.position.set(x, 1.3 * s, z); t.castShadow = true; g.add(t);
    for (let k = 0; k < 4; k++) {
      const c = new THREE.Mesh(hi ? crownG : crownLo, greens[Math.floor(rnd() * greens.length)]);
      const r = (1.3 + rnd() * 0.7) * s; c.scale.set(r, r * 0.8, r);
      c.position.set(x + (rnd() - 0.5) * 1.8 * s, (3.0 + rnd() * 1.2) * s, z + (rnd() - 0.5) * 1.8 * s);
      c.castShadow = !opts.mobile; g.add(c);
    }
  };
  for (let x = -18; x <= 18; x += 5.2) tree(x, Z1 + 3.3, 0.9 + rnd() * 0.3);
  for (let z = -17; z <= 18; z += 5.6) tree(X0 - 8.4, z, 0.85 + rnd() * 0.3);
  // round-crowned trees in stone planters along the shopfronts, as in the render
  const planter = (x: number, z: number) => { box(g, M.stone, x - 1.0, x + 1.0, 0, 0.55, z - 1.0, z + 1.0); tree(x, z, 0.8, true); };
  for (const x of [-4.8, 0.6, 5.4]) planter(x, Z1 + 1.7);
  for (const z of [-15, -8.5, 6, 13.5]) planter(X0 - 1.8, z);
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
    const pad = 1.0, gx0 = a === X0 ? a - pad : a + 0.06, gx1 = b === X1 ? b + pad : b - 0.06;
    const gz0 = c === Z0 ? c - pad : c + 0.06, gz1 = d === Z1 ? d + pad : d - 0.06;
    const m = new THREE.MeshBasicMaterial({ color: 0xe8b25c, transparent: true, opacity: 0, depthWrite: false });
    const me = new THREE.Mesh(new THREE.BoxGeometry(gx1 - gx0, FLOOR_H - 0.12, gz1 - gz0), m);
    me.position.set((gx0 + gx1) / 2, floorY(f) + FLOOR_H / 2 - 0.2, (gz0 + gz1) / 2);
    me.userData = { floor: f, wing: w }; me.renderOrder = 10; g.add(me); picks.push(me);
    disposables.push(me.geometry, m);
  }
  return { group: g, picks, top: roofY + 3.6, dispose: () => disposables.forEach(d => d.dispose()) };
}
