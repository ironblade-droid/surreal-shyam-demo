// Photoreal real-time exterior: Blender-exported GLB (Draco) + baked AO + Poly Haven HDRI sky/IBL.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

export interface Photoreal { group: THREE.Group; picks: THREE.Mesh[]; top: number; ready: Promise<void>; setMode(m: "dusk" | "day"): void; mode: "dusk" | "day";
  build: BuildState; apply(): void; footprint: THREE.LineSegments | null; }
export interface BuildState { cut: number; skin: number; light: number; edge: number; stack: number; explode: number; foot: number; }
const CLIP_NAMES = /^(Building|WindowGlass|RailGlass|StoreGlass|Downlight|Lightpanel)/;
const WING_COL = [0xdcc7a1, 0xc4825d, 0xb3aa9c, 0x95a086];
const CX = 7.7, CY = 13.5;               // Blender building centre (x, y); three: x = bx - CX, z = -(by - CY)
const HDRI_ROT = 1.0472;                 // world mapping rotation in exterior.blend (both worlds)

export function buildPhotoreal(scene: THREE.Scene, renderer: THREE.WebGLRenderer, sun: THREE.DirectionalLight, hemi: THREE.HemisphereLight,
                               opts: { mobile: boolean; onChange: () => void }): Photoreal {
  const base = "../model/";
  const group = new THREE.Group(); group.position.set(-CX, 0, CY); scene.add(group);
  const picks: THREE.Mesh[] = [];
  const tl = new THREE.TextureLoader();
  const draco = new DRACOLoader().setDecoderPath(base + "draco/");
  const gl = new GLTFLoader().setDRACOLoader(draco);
  const pm = new THREE.PMREMGenerator(renderer);
  const envs: Record<string, THREE.Texture> = {}, skies: Record<string, THREE.Texture> = {};
  const winMats: THREE.MeshStandardMaterial[] = [], glowMats: THREE.MeshStandardMaterial[] = [];
  const winUniform = { value: 1.0 };
  const skyU = { tex: { value: null as THREE.Texture | null }, rot: { value: -HDRI_ROT }, dusk: { value: 1.0 }, k: { value: 0.5 } };
  const skyMat = new THREE.ShaderMaterial({ uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: "varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }",
    fragmentShader: `uniform sampler2D tex; uniform float rot, dusk, k; varying vec3 vD;
      #include <common>
      void main(){
        vec3 d = normalize(vD); float c = cos(rot), s = sin(rot); d = vec3(c*d.x + s*d.z, d.y, -s*d.x + c*d.z);
        vec2 uv = vec2(atan(d.z, d.x) / (2.0*PI) + 0.5, asin(clamp(d.y,-1.0,1.0)) / PI + 0.5);
        vec3 t = texture2D(tex, uv).rgb;
        float h = clamp(d.y, 0.0, 1.0);
        vec3 grad = mix(vec3(1.05,0.70,0.48), vec3(0.42,0.58,0.86), smoothstep(0.0, 0.22, h));
        grad = mix(grad, vec3(0.16,0.27,0.52), smoothstep(0.22, 0.85, h));
        float lum = dot(t, vec3(0.3,0.59,0.11));
        vec3 blue = mix(vec3(0.50,0.66,0.92), vec3(0.24,0.40,0.72), smoothstep(0.05, 0.6, h));
        float cl = smoothstep(0.9, 2.2, lum);           // cloud mask from the HDR
        vec3 dk = mix(blue * 0.55, vec3(0.78,0.80,0.88) * 0.62, cl * 0.6);
        dk += vec3(1.0,0.60,0.38) * (1.0 - smoothstep(0.0, 0.12, h)) * 0.22;
        vec3 col = mix(t, dk, dusk) * k;
        if (d.y < 0.0) col = mix(col, vec3(0.08,0.09,0.11), smoothstep(0.0, 0.08, -d.y));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), skyMat); skyDome.renderOrder = -10; skyDome.frustumCulled = false;
  scene.add(skyDome);
  const B: BuildState = { cut: 40, skin: 40, light: 40, edge: 0, stack: 40, explode: 0, foot: 0 };
  const U = { uCutY: { value: 40 }, uSkinY: { value: 40 }, uLightY: { value: 40 }, uEdge: { value: 0 }, uCapOn: { value: 0 } };
  const planeKeepBelow = new THREE.Plane(new THREE.Vector3(0, -1, 0), 40);   // keeps y < cut
  const planeKeepAbove = new THREE.Plane(new THREE.Vector3(0, 1, 0), -40);   // keeps y > stack
  const stackMats: THREE.MeshStandardMaterial[] = []; const edgeMats: THREE.LineBasicMaterial[] = [];
  const api: Photoreal = { group, picks, top: 28, ready: Promise.resolve(), mode: "dusk", setMode, build: B, apply, footprint: null };
  function apply() {
    U.uCutY.value = B.cut; U.uSkinY.value = B.skin; U.uLightY.value = B.light; U.uEdge.value = B.edge;
    U.uCapOn.value = B.cut < 33 ? 1 : 0;
    planeKeepBelow.constant = Math.min(B.cut, B.stack + 0.0) ; planeKeepAbove.constant = -B.stack;
    const showStack = B.stack < 33;
    for (const p of picks) {
      p.visible = showStack;
      const f = p.userData.floor as number, w = p.userData.wing as number;
      const wx = (w === 1 || w === 4 ? 1 : -1), wz = (w === 1 || w === 2 ? 1 : -1);
      p.position.set(p.userData.x0 + wx * B.explode * 1.6, p.userData.y0 + (f - 1) * B.explode * 2.4, p.userData.z0 - wz * B.explode * 1.6);
    }
    if (api.footprint) { api.footprint.visible = B.foot > 0.01; (api.footprint.material as THREE.LineBasicMaterial).opacity = B.foot; }
  }
  function injectBuild(m: THREE.Material, origDouble: boolean) {
    const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey();
    m.clippingPlanes = [planeKeepBelow]; m.side = THREE.DoubleSide;
    m.onBeforeCompile = (sh, r) => {
      prev.call(m, sh, r);
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vBW;")
        .replace("#include <project_vertex>", "#include <project_vertex>\nvBW = (modelMatrix * vec4(transformed,1.0)).xyz;");
      const back = origDouble ? "" : `if(!gl_FrontFacing){ if(uCapOn < 0.5) discard; gl_FragColor = vec4(0.30,0.27,0.24,1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          return; }`;
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vBW; uniform float uCutY, uSkinY, uLightY, uEdge, uCapOn;")
        .replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\n" + back + "\nfloat skC = smoothstep(uSkinY - 0.5, uSkinY + 0.5, vBW.y);")
        .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.60,0.575,0.54), skC); diffuseColor.a = mix(diffuseColor.a, diffuseColor.a * 0.25, skC);")
        .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.93, skC);")
        .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.0, skC);")
        .replace("#include <lights_physical_fragment>", `totalEmissiveRadiance *= 1.0 - smoothstep(uLightY - 0.4, uLightY + 0.4, vBW.y);
          float eC = (1.0 - smoothstep(0.0, 0.45, uCutY - vBW.y)) * uEdge;
          float eS = (1.0 - smoothstep(0.0, 0.7, abs(vBW.y - uSkinY))) * uEdge * step(uSkinY, 32.0);
          totalEmissiveRadiance += vec3(1.0, 0.68, 0.36) * (eC * 2.2 + eS * 0.5);
          #include <lights_physical_fragment>`);
    };
    m.customProgramCacheKey = () => prevKey + "|bld" + (origDouble ? "d" : "s");
    m.needsUpdate = true;
  }
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
  const poolU = { value: 1.0 };
  function pools(m: THREE.MeshStandardMaterial) {
    m.onBeforeCompile = sh => {
      sh.uniforms.uPool = poolU;
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWp2; varying vec3 vWn2;")
        .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWp2 = (modelMatrix * vec4(transformed,1.0)).xyz; vWn2 = normalize(mat3(modelMatrix) * objectNormal);");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vWp2; varying vec3 vWn2; uniform float uPool;")
        .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
          float fy = fract((vWp2.y - 5.2) / 3.2); float lvl = step(5.2, vWp2.y) * (1.0 - step(27.6, vWp2.y));
          float vert = 1.0 - abs(vWn2.y);
          float along = abs(vWn2.x) > abs(vWn2.z) ? vWp2.z : vWp2.x;
          float spot = pow(0.5 + 0.5 * cos(along * 6.2831 / 2.6), 3.0);
          float pool = smoothstep(0.55, 0.94, fy) * (1.0 - smoothstep(0.93, 0.99, fy)) * (0.35 + 0.65 * spot);
          totalEmissiveRadiance += vec3(1.0, 0.64, 0.34) * pool * lvl * vert * uPool * 0.8 * diffuseColor.rgb * 3.0;`);
    };
  }
  // Prakhar: drop the rooftop pergola screens/frames entirely (they read as big black screens in real-time).
  // They are the part of the Louvre primitive above the roof slab (y > 28.0 m; facade louvres stop at 27.3); strip those triangles.
  function stripRoof(mesh: THREE.Mesh) {
    const g = mesh.geometry as THREE.BufferGeometry; const pos = g.attributes.position as THREE.BufferAttribute;
    mesh.updateWorldMatrix(true, false); const v = new THREE.Vector3(); const hi: boolean[] = [];
    for (let i = 0; i < pos.count; i++) hi.push(v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).y > 28.0);
    const src = g.index ? Array.from(g.index.array as ArrayLike<number>) : [...Array(pos.count).keys()];
    const out: number[] = []; let dropped = 0;
    for (let i = 0; i < src.length; i += 3) { const [a, b, c] = [src[i], src[i + 1], src[i + 2]];
      if (hi[a] || hi[b] || hi[c]) { dropped++; continue; } out.push(a, b, c); }
    g.setIndex(out); g.computeBoundingBox(); g.computeBoundingSphere();
    console.info("roof screens removed: tris", dropped);
  }
  // the dark interior core box doubles as the roof deck; give its upward faces a light terrace-concrete tone
  function roofDeck(m: THREE.MeshStandardMaterial) {
    m.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying float vUp;")
        .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvUp = normalize(mat3(modelMatrix) * objectNormal).y;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vUp;")
        .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.50,0.48,0.45), step(0.6, vUp));")
        .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.9, step(0.6, vUp));");
    };
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
  const clipMats: THREE.MeshStandardMaterial[] = [];
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
        const sm = new THREE.MeshStandardMaterial({ color: WING_COL[+mm[2] - 1], roughness: 0.7, metalness: 0, emissive: WING_COL[+mm[2] - 1], emissiveIntensity: 0.12, clippingPlanes: [planeKeepAbove] });
        stackMats.push(sm); m.material = sm; m.castShadow = false; m.receiveShadow = true; m.visible = false;
        m.userData.x0 = m.position.x; m.userData.y0 = m.position.y; m.userData.z0 = m.position.z;
        const eg = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 30), new THREE.LineBasicMaterial({ color: 0xf3dcae, transparent: true, opacity: 0.75, clippingPlanes: [planeKeepAbove] }));
        edgeMats.push(eg.material as THREE.LineBasicMaterial); m.add(eg);
        picks.push(m); return;
      }
      m.castShadow = !/^(Ground|Asph|Pave|Walk|Mark|Soil|Far|FarSkyline)/.test(name); m.receiveShadow = true;
      if (CLIP_NAMES.test(name) || CLIP_NAMES.test(m.parent?.name || "")) {
        const cl = (mats as THREE.Material[]).map(x => { const c = x.clone(); c.onBeforeCompile = x.onBeforeCompile; return c; });
        m.material = Array.isArray(m.material) ? cl : cl[0];
        clipMats.push(...cl as THREE.MeshStandardMaterial[]);
      }
      for (const mat of (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshStandardMaterial[]) {
        mat.envMapIntensity = 1.0;
        if (name.startsWith("Building")) { mat.aoMap = ao; mat.aoMapIntensity = 1.6; }
        const mn = mat.name;
        if (mn === "WinGlass") { mat.roughness = 0.04; mat.metalness = 0.0; mat.envMapIntensity = 1.6; litWindows(mat); }
        if (mn === "RailGlass" || mn === "StoreGlass") { const p = mat as THREE.MeshPhysicalMaterial; p.transmission = 0; p.transparent = true; p.opacity = mn === "RailGlass" ? 0.28 : 0.45; p.roughness = 0.03; p.envMapIntensity = 1.5; p.depthWrite = false; }
        if (mn === "StoreGlass") { mat.emissive = new THREE.Color(1.0, 0.72, 0.42); mat.emissiveIntensity = 0.9; glowMats.push(mat); }
        if (mn === "FarBlocks" || mn === "NeighbourWall") { mat.color.multiplyScalar(0.55); mat.roughness = 0.95; }
        if (mn === "Asphalt") { mat.map = asph; mat.color.setScalar(0.55); worldUV(m, 4); }
        if (mn === "Paving" || mn === "Sidewalk") { mat.map = pave; mat.color.multiplyScalar(1.6); worldUV(m, 3); }
        if (mn === "SoffitWood") { mat.emissive = new THREE.Color(1.0, 0.66, 0.38); mat.emissiveIntensity = 0.35; glowMats.push(mat); }
        if (mn === "WallGrey" || mn === "BandWhite") { mat.color.multiply(new THREE.Color(1.04, 1.0, 0.94)); if (mn === "WallGrey") pools(mat); }
        if (mn === "Louvre") stripRoof(m);
        if (mn === "CoreDark") roofDeck(mat);
        if (mn === "SoffitWood") { mat.emissiveIntensity = 0.6; }
        if (/Downlight|LightPanel|LampHead|HeadLamp|TailLamp/.test(mn)) glowMats.push(mat);
        mat.needsUpdate = true;
      }
    });
    for (const cm of new Set(clipMats)) injectBuild(cm, cm.side === THREE.DoubleSide);
    const bb = new THREE.Box3(); picks.forEach(p => bb.expandByObject(p)); api.top = bb.max.y || 28;
    // ground footprint: floor-1 flat outlines flattened onto the site
    { const pts: number[] = []; const v = new THREE.Vector3();
      for (const p of picks) if (p.userData.floor === 1) { const eg = new THREE.EdgesGeometry(p.geometry, 30); const pa = eg.attributes.position as THREE.BufferAttribute;
        p.updateWorldMatrix(true, false); const inv = group.matrixWorld.clone().invert();
        for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i).applyMatrix4(p.matrixWorld).applyMatrix4(inv); pts.push(v.x, 0.09, v.z); } }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      const fp = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xf0c987, transparent: true, opacity: 0, depthWrite: false }));
      fp.renderOrder = 6; fp.visible = false; group.add(fp); api.footprint = fp; }
    apply();
    // a few Poly Haven island trees along the frontage
    try {
      const tree = (await gl.loadAsync(base + "tree.glb")).scene;
      tree.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true;
        for (const mat of (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshStandardMaterial[]) { mat.alphaTest = 0.3; mat.transparent = false; mat.side = THREE.DoubleSide; } } });
      const tb = new THREE.Box3().setFromObject(tree); const th = Math.max(0.01, tb.max.y - tb.min.y); const s = 9.5 / th;
      // canopy fill: a few lumpy leaf-coloured blobs inside the crown so the decimated foliage reads full
      const blobG = new THREE.IcosahedronGeometry(1, 4); const pa = blobG.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pa.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(pa, i);
        const n = 1 + 0.22 * Math.sin(v.x * 7.1 + v.y * 3.3) * Math.cos(v.z * 6.3 - v.y * 4.7) + 0.1 * Math.sin(v.x * 17 + v.z * 13);
        pa.setXYZ(i, v.x * n, v.y * n * 0.8, v.z * n); }
      blobG.computeVertexNormals();
      let leafMap: THREE.Texture | null = null;
      tree.traverse(o => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial; if (m && /leaves/.test(m.name) && m.map) leafMap = m.map; });
      const blobM = new THREE.MeshStandardMaterial({ color: 0x47632f, roughness: 0.92 });
      if (leafMap && false) { const lm = (leafMap as THREE.Texture).clone(); lm.wrapS = lm.wrapT = THREE.RepeatWrapping; lm.repeat.set(5, 3); lm.needsUpdate = true; blobM.map = lm; }
      const cx = (tb.min.x + tb.max.x) / 2, cz = (tb.min.z + tb.max.z) / 2, cw = Math.max(tb.max.x - tb.min.x, tb.max.z - tb.min.z);
      for (const [dx, dy, dz, r] of [[0, 0.68, 0, 0.23], [0.14, 0.6, 0.1, 0.17], [-0.13, 0.62, -0.08, 0.17], [0.02, 0.8, -0.05, 0.15]]) {
        const b = new THREE.Mesh(blobG, blobM); b.position.set(cx + dx * cw, tb.min.y + dy * th, cz + dz * cw);
        b.scale.setScalar(r * Math.min(th, cw * 1.3)); b.castShadow = true; b.receiveShadow = true; tree.add(b); }
      for (const [x, y, r, k] of [[-6, -5, 0.3, 1], [22, -6, 1.7, 0.85], [-7, 30, 2.4, 0.9], [23, 32, 4.1, 1.05], [-8, 13, 5, 0.8], [8, -9, 2.9, 0.75], [-10, 22, 1.1, 0.95]]) {
        const t = tree.clone(); t.scale.setScalar(s * k); t.position.set(x, 0, -y); t.rotation.y = r; group.add(t);
      }
    } catch (e) { console.warn("tree skipped", e); }
    setMode("dusk");
  })();
  function setMode(m: "dusk" | "day") {
    const go = () => {
      api.mode = m;
      scene.environment = envs[m]; scene.background = null; skyU.tex.value = skies[m];
      scene.environmentRotation.set(0, -HDRI_ROT, 0);
      skyU.dusk.value = m === "dusk" ? 1 : 0; skyU.k.value = m === "dusk" ? 1.0 : 0.75;
      const dusk = m === "dusk";
      scene.environmentIntensity = dusk ? 0.34 : 0.8; scene.backgroundIntensity = dusk ? 0.42 : 0.7;
      renderer.toneMappingExposure = dusk ? 0.95 : 0.9;
      sun.intensity = dusk ? 1.5 : 2.6; sun.color.set(dusk ? 0xffbd8a : 0xfff1dc);
      sun.position.set(dusk ? -70 : -45, dusk ? 30 : 60, dusk ? 35 : 60);
      poolU.value = dusk ? 1.0 : 0.0;
      hemi.intensity = dusk ? 0.08 : 0.25;
      winUniform.value = dusk ? 1.5 : 0.0;
      if (scene.fog) (scene.fog as THREE.Fog).color.set(dusk ? 0x3c4a63 : 0xc9d3de);
      for (const g of glowMats) g.emissiveIntensity = g.name === "SoffitWood" ? (dusk ? 0.6 : 0) : dusk ? (g.name === "StoreGlass" ? 1.2 : 2.0) : 0.15;
      opts.onChange();
    };
    if (envs[m]) go(); else loadEnv(m).then(go);
  }
  return api;
}
