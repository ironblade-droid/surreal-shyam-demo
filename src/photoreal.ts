// Photoreal real-time exterior: Blender-exported GLB (Draco) + baked AO + Poly Haven HDRI sky/IBL.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

export interface Photoreal { group: THREE.Group; picks: THREE.Mesh[]; top: number; ready: Promise<void>; setMode(m: "dusk" | "day"): void; mode: "dusk" | "day"; }
const CX = 7.7, CY = 13.5;               // Blender building centre (x, y); three: x = bx - CX, z = -(by - CY)
const HDRI_ROT = 1.0472;                 // world mapping rotation in exterior.blend (both worlds)

export function buildPhotoreal(scene: THREE.Scene, renderer: THREE.WebGLRenderer, sun: THREE.DirectionalLight, hemi: THREE.HemisphereLight,
                               opts: { mobile: boolean; onChange: () => void }): Photoreal {
  const base = "model/";
  const group = new THREE.Group(); group.position.set(-CX, 0, CY); scene.add(group);
  const picks: THREE.Mesh[] = [];
  const tl = new THREE.TextureLoader();
  const draco = new DRACOLoader().setDecoderPath(base + "draco/");
  const gl = new GLTFLoader().setDRACOLoader(draco);
  const pm = new THREE.PMREMGenerator(renderer);
  const envs: Record<string, THREE.Texture> = {}, skies: Record<string, THREE.Texture> = {};
  const winMats: THREE.MeshStandardMaterial[] = [], glowMats: THREE.MeshStandardMaterial[] = [];
  const winUniform = { value: 1.0 };
  const api: Photoreal = { group, picks, top: 28, ready: Promise.resolve(), mode: "dusk", setMode };
  const loadEnv = (m: string) => new Promise<void>(res => new RGBELoader().load(base + m + "-1k.hdr", t => {
    t.mapping = THREE.EquirectangularReflectionMapping; envs[m] = pm.fromEquirectangular(t).texture; skies[m] = t; res(); }));
  function worldUV(mesh: THREE.Mesh, scale: number) {
    const g = mesh.geometry, p = g.attributes.position, uv = new Float32Array(p.count * 2);
    mesh.updateWorldMatrix(true, false); const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld); uv[2 * i] = v.x / scale; uv[2 * i + 1] = v.z / scale; }
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  }
  function groundTex(name: string, rep: number) {
    const t = tl.load(base + name + ".webp"); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4; t.repeat.set(rep, rep); return t;
  }
  function litWindows(m: THREE.MeshStandardMaterial) {
    // per-window warm interior glow: hash of the window cell (world position) switches ~half the panes on
    m.emissive = new THREE.Color(1.0, 0.62, 0.30); m.emissiveIntensity = 1;
    m.onBeforeCompile = sh => {
      sh.uniforms.uWin = winUniform;
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWp;")
        .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed,1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vWp; uniform float uWin;\nfloat h31(vec3 p){p=fract(p*0.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}")
        .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
          vec3 cell = floor(vec3(vWp.x/1.7, (vWp.y-0.4)/3.2, vWp.z/1.7));
          float on = step(0.45, h31(cell + 7.0)) * step(5.0, vWp.y);
          float lv = 0.55 + 0.45 * h31(cell + 19.0);
          float lobby = 1.0 - step(5.0, vWp.y);
          totalEmissiveRadiance *= uWin * max(on * lv, lobby * 0.0);`);
    };
    winMats.push(m);
  }
  api.ready = (async () => {
    const aoP = new Promise<THREE.Texture>(res => tl.load(base + (opts.mobile ? "ao-1024.webp" : "ao-2048.webp"), t => { t.flipY = false; t.channel = 0; res(t); }));
    const [gltf, ao, , ] = await Promise.all([gl.loadAsync(base + "building.glb"), aoP, loadEnv("dusk")]);
    const root = gltf.scene; group.add(root); root.updateMatrixWorld(true);
    const asph = groundTex("asphalt_02", 1), pave = groundTex("concrete_pavement", 1);
    root.traverse(o => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      const name = m.name || "", mats = Array.isArray(m.material) ? m.material : [m.material];
      if (/^ID_F\d+W\d+/.test(name)) {
        const mm = /^ID_F(\d+)W(\d+)/.exec(name)!;
        m.userData = { floor: +mm[1], wing: +mm[2] };
        m.material = new THREE.MeshBasicMaterial({ color: 0xffe3ad, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
        m.renderOrder = 5; m.scale.multiplyScalar(1.0); picks.push(m); return;
      }
      m.castShadow = !/^(Ground|Asph|Pave|Walk|Mark|Soil|Far|FarSkyline)/.test(name); m.receiveShadow = true;
      for (const mat of mats as THREE.MeshStandardMaterial[]) {
        mat.envMapIntensity = 1.0;
        if (name.startsWith("Building")) { mat.aoMap = ao; mat.aoMapIntensity = 1.0; }
        const mn = mat.name;
        if (mn === "WinGlass") { mat.roughness = 0.04; mat.metalness = 0.0; mat.envMapIntensity = 1.6; litWindows(mat); }
        if (mn === "RailGlass" || mn === "StoreGlass") { const p = mat as THREE.MeshPhysicalMaterial; p.transmission = 0; p.transparent = true; p.opacity = mn === "RailGlass" ? 0.28 : 0.45; p.roughness = 0.03; p.envMapIntensity = 1.5; p.depthWrite = false; }
        if (mn === "StoreGlass") { mat.emissive = new THREE.Color(1.0, 0.72, 0.42); mat.emissiveIntensity = 0.9; glowMats.push(mat); }
        if (mn === "FarBlocks" || mn === "NeighbourWall") { mat.color.multiplyScalar(0.55); mat.roughness = 0.95; }
        if (mn === "Asphalt") { mat.map = asph; mat.color.setScalar(0.55); worldUV(m, 4); }
        if (mn === "Paving" || mn === "Sidewalk") { mat.map = pave; mat.color.multiplyScalar(1.6); worldUV(m, 3); }
        if (mn === "SoffitWood") { mat.emissive = new THREE.Color(1.0, 0.66, 0.38); mat.emissiveIntensity = 0.35; glowMats.push(mat); }
        if (mn === "WallGrey" || mn === "BandWhite") mat.color.multiply(new THREE.Color(1.04, 1.0, 0.94));
        if (/Downlight|LightPanel|LampHead|HeadLamp|TailLamp/.test(mn)) glowMats.push(mat);
        mat.needsUpdate = true;
      }
    });
    const bb = new THREE.Box3(); picks.forEach(p => bb.expandByObject(p)); api.top = bb.max.y || 28;
    // a few Poly Haven island trees along the frontage
    try {
      const tree = (await gl.loadAsync(base + "tree.glb")).scene;
      tree.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true;
        for (const mat of (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshStandardMaterial[]) { mat.alphaTest = 0.5; mat.transparent = false; mat.side = THREE.DoubleSide; } } });
      const tb = new THREE.Box3().setFromObject(tree); const s = 7.5 / Math.max(0.01, tb.max.y - tb.min.y);
      for (const [x, y, r, k] of [[-6, -5, 0.3, 1], [22, -6, 1.7, 0.85], [-7, 30, 2.4, 0.9], [23, 32, 4.1, 1.05], [-8, 13, 5, 0.8]]) {
        const t = tree.clone(); t.scale.setScalar(s * k); t.position.set(x, 0, -y); t.rotation.y = r; group.add(t);
      }
    } catch (e) { console.warn("tree skipped", e); }
    setMode("dusk");
    loadEnv("day");      // warm the day assets in the background
  })();
  function setMode(m: "dusk" | "day") {
    const go = () => {
      api.mode = m;
      scene.environment = envs[m]; scene.background = skies[m] || null;
      scene.backgroundRotation.set(0, -HDRI_ROT, 0); scene.environmentRotation.set(0, -HDRI_ROT, 0);
      const dusk = m === "dusk";
      scene.environmentIntensity = dusk ? 0.55 : 0.8; scene.backgroundIntensity = dusk ? 0.42 : 0.7;
      renderer.toneMappingExposure = dusk ? 0.95 : 0.9;
      sun.intensity = dusk ? 0.35 : 2.4; sun.color.set(dusk ? 0x9fb4d8 : 0xfff1dc);
      hemi.intensity = dusk ? 0.08 : 0.25;
      winUniform.value = dusk ? 1.5 : 0.0;
      if (scene.fog) (scene.fog as THREE.Fog).color.set(dusk ? 0x3c4a63 : 0xc9d3de);
      for (const g of glowMats) g.emissiveIntensity = g.name === "SoffitWood" ? (dusk ? 0.35 : 0) : dusk ? (g.name === "StoreGlass" ? 1.2 : 2.0) : 0.15;
      opts.onChange();
    };
    if (envs[m]) go(); else loadEnv(m).then(go);
  }
  return api;
}
