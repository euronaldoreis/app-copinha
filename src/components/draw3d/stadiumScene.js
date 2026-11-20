// Sorteio dos grupos em 3D: estádio em pixel art (inspirado na Arena da Amazônia),
// caminhão de lixo, torcida e sorteio com a mesma sequência da tela antiga.
// Carregado sob demanda pela tela do sorteio, para o three.js não pesar no resto do app.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPixelatedPass } from "three/examples/jsm/postprocessing/RenderPixelatedPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { SKIN, HAIR, SHIRT, autoLook } from "@/lib/sprite";

/**
 * Monta a cena dentro de `container` e começa a abertura e o sorteio.
 * @param {import("./stadiumScene").DrawSceneOptions} options
 * @returns {import("./stadiumScene").DrawScene}
 */
export function createDrawScene({ container, tagsLayer, items, reducedMotion, insets, onBoard, onIntro, onDone }) {
  // ================= Dados do sorteio =================
  const DRAW = items.map((item) => ({ ...item }));
  const LABELS = [...new Set(DRAW.map((d) => d.groupLabel ?? ""))].sort();

  // Tempos do sorteio original
  const NAME_SPIN_MS = 1300, GROUP_SPIN_MS = 800, SHOW_MS = 900, SEED_SHOW_MS = 2400, TICK_MS = 85;

  // ================= Fonte pixel 5x7 (letreiros, placar, gramado) =================
  const RAW = {
    A:"01110 10001 10001 11111 10001 10001 10001", B:"11110 10001 10001 11110 10001 10001 11110", C:"01110 10001 10000 10000 10000 10001 01110",
    D:"11110 10001 10001 10001 10001 10001 11110", E:"11111 10000 10000 11110 10000 10000 11111", F:"11111 10000 10000 11110 10000 10000 10000",
    G:"01110 10001 10000 10111 10001 10001 01111", H:"10001 10001 10001 11111 10001 10001 10001", I:"01110 00100 00100 00100 00100 00100 01110",
    J:"00111 00010 00010 00010 00010 10010 01100", K:"10001 10010 10100 11000 10100 10010 10001", L:"10000 10000 10000 10000 10000 10000 11111",
    M:"10001 11011 10101 10101 10001 10001 10001", N:"10001 10001 11001 10101 10011 10001 10001", O:"01110 10001 10001 10001 10001 10001 01110",
    P:"11110 10001 10001 11110 10000 10000 10000", Q:"01110 10001 10001 10001 10101 10010 01101", R:"11110 10001 10001 11110 10100 10010 10001",
    S:"01111 10000 10000 01110 00001 00001 11110", T:"11111 00100 00100 00100 00100 00100 00100", U:"10001 10001 10001 10001 10001 10001 01110",
    V:"10001 10001 10001 10001 10001 01010 00100", W:"10001 10001 10001 10101 10101 10101 01010", X:"10001 10001 01010 00100 01010 10001 10001",
    Y:"10001 10001 01010 00100 00100 00100 00100", Z:"11111 00001 00010 00100 01000 10000 11111",
    0:"01110 10001 10011 10101 11001 10001 01110", 1:"00100 01100 00100 00100 00100 00100 01110", 2:"01110 10001 00001 00010 00100 01000 11111",
    3:"11110 00001 00001 01110 00001 00001 11110", 4:"00010 00110 01010 10010 11111 00010 00010", 5:"11111 10000 11110 00001 00001 10001 01110",
    6:"00110 01000 10000 11110 10001 10001 01110", 7:"11111 00001 00010 00100 01000 01000 01000", 8:"01110 10001 10001 01110 10001 10001 01110",
    9:"01110 10001 10001 01111 00001 00010 01100", "/":"00001 00010 00010 00100 01000 01000 10000", "?":"01110 10001 00001 00010 00100 00000 00100",
    ".":"00000 00000 00000 00000 00000 01100 01100", "-":"00000 00000 00000 11111 00000 00000 00000", " ":"00000 00000 00000 00000 00000 00000 00000",
  };
  const FONT = Object.fromEntries(Object.entries(RAW).map(([k, v]) => [k, v.split(" ")]));
  const norm = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  const textW = (t, s = 1) => norm(t).length * 6 * s - s;
  function pixText(g, text, x, y, s, color, align = "left") {
    const t = norm(text);
    let cx = align === "center" ? Math.round(x - textW(t, s) / 2) : align === "right" ? x - textW(t, s) : x;
    g.fillStyle = color;
    for (const ch of t) { const gl = FONT[ch] ?? FONT["?"]; for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (gl[r][c] === "1") g.fillRect(cx + c * s, y + r * s, s, s); cx += 6 * s; }
  }
  function pixTex(w, h, draw) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"); g.imageSmoothingEnabled = false; draw(g, w, h);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // ================= Cena =================
  const stage = container;
  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  stage.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  // Céu de noite com estrelas e lua (a câmera é fixa, então o fundo pode ser uma imagem)
  scene.background = pixTex(160, 100, (g, w, h) => {
    const sky = ["#050a1f", "#07102a", "#0a1534", "#0e1a3e", "#121f48", "#172552"];
    for (let y = 0; y < h; y++) { g.fillStyle = sky[Math.min(sky.length - 1, Math.floor((y / h) * sky.length))]; g.fillRect(0, y, w, 1); }
    for (let i = 0; i < 140; i++) { g.fillStyle = Math.random() < 0.2 ? "#ffffff" : "#8e9bc8"; g.fillRect(Math.floor(Math.random() * w), Math.floor(Math.random() * h * 0.7), 1, 1); }
    g.fillStyle = "#f4efd9"; for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) if (x * x + y * y <= 26) g.fillRect(22 + x, 14 + y, 1, 1);
    g.fillStyle = "#d9d2b8"; g.fillRect(20, 12, 2, 2); g.fillRect(24, 17, 2, 1);
  });
  scene.fog = new THREE.Fog("#121d45", 80, 170);

  // Câmera fixa em perspectiva, como numa transmissão
  const camera = new THREE.PerspectiveCamera(32, 1, 1, 500);
  const VIEW_DIR = new THREE.Vector3(0.55, 0.62, 1).normalize();
  const FACE_CAM = Math.atan2(VIEW_DIR.x, VIEW_DIR.z); // ângulo para o jogador olhar para a câmera

  // Noite: luz ambiente azulada e luar fraco; quem ilumina o campo são os refletores
  scene.add(new THREE.HemisphereLight("#6a7bc0", "#1a2a1c", 0.6));
  const moon = new THREE.DirectionalLight("#9fb2ff", 0.35);
  moon.position.set(-30, 50, -20);
  scene.add(moon);
  const glowMat = (hex, k = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), toneMapped: false });

  const mats = new Map();
  const mat = (color) => { if (!mats.has(color)) mats.set(color, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 1 })); return mats.get(color); };
  function box(w, h, d, m, x = 0, y = 0, z = 0, parent = scene) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof m === "string" ? mat(m) : m);
    mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  function flat(w, d, m, x, y, z, parent = scene) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, y, z); mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  let seed = 7; const srand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const sr = (a, b) => a + srand() * (b - a);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const tmp = new THREE.Object3D();

  // ---------- Layout (campo maior) ----------
  const FW = 36, FD = 21, FZ = -1.5;                  // alambrado
  const FRONT = FZ + FD / 2, BACK = FZ - FD / 2;      // z = 9 / -12
  const PW = 32, PD = 16.5;                           // linhas do campo
  const FH = 2.7;                                     // altura do alambrado
  const GATE_X = 0, GATE_W = 2.6;                    // portão por onde o jogador entra
  const ROAD_Z = FRONT + 8, TRUCK_X = GATE_X - 6.2;

  // ---------- Chão, rua e cascalho ----------
  function grassTex(base, size = 16) {
    const c = new THREE.Color(base), tones = [0.92, 1, 1, 1, 1.07, 1.13].map((k) => "#" + c.clone().multiplyScalar(k).getHexString());
    const t = pixTex(size, size, (g) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { g.fillStyle = tones[Math.floor(srand() * tones.length)]; g.fillRect(x, y, 1, 1); } });
    t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  const groundTex = grassTex("#6fae4f"); groundTex.repeat.set(500 / 2.2, 500 / 2.2);
  flat(500, 500, new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 }), 0, 0, 0);
  box(160, 0.1, 3.6, "#5a5b60", 0, 0.05, ROAD_Z);
  box(160, 0.22, 0.4, "#d6d1c4", 0, 0.11, ROAD_Z - 2);
  for (let i = 0; i < 30; i++) box(1.4, 0.02, 0.16, "#ecebe4", -60 + i * 4, 0.11, ROAD_Z + 0.2);

  const gravelTex = pixTex(32, 32, (g) => { const cs = ["#d3cfc5", "#c3beb3", "#dcd8cf", "#aea99e"]; for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { g.fillStyle = cs[srand() < 0.7 ? 0 : Math.floor(srand() * 4)]; g.fillRect(x, y, 1, 1); } });
  gravelTex.wrapS = gravelTex.wrapT = THREE.RepeatWrapping;
  function gravel(x0, x1, z0, z1) {
    const t = gravelTex.clone(); t.needsUpdate = true; t.repeat.set((x1 - x0) / 2.4, (z1 - z0) / 2.4);
    box(x1 - x0, 0.08, z1 - z0, new THREE.MeshStandardMaterial({ map: t, roughness: 1 }), (x0 + x1) / 2, 0.04, (z0 + z1) / 2).castShadow = false;
  }
  gravel(GATE_X - 1.2, GATE_X + 1.2, FRONT + 0.2, ROAD_Z - 2.2);

  // ---------- Gramado e linhas do campo ----------
  const apronTex = grassTex("#4b8f43"); apronTex.repeat.set((FW - 0.2) / 1.6, (FD - 0.2) / 1.6);
  box(FW - 0.2, 0.15, FD - 0.2, new THREE.MeshStandardMaterial({ map: apronTex, roughness: 1 }), 0, 0.075, FZ);
  const stripeMats = ["#5ea853", "#549c4a"].map((c) => { const t = grassTex(c, 8); t.repeat.set(PW / 16 / 0.9, (PD + 2) / 0.9); return new THREE.MeshStandardMaterial({ map: t, roughness: 1 }); });
  for (let i = 0; i < 16; i++) box(PW / 16, 0.02, PD + 2, stripeMats[i % 2], -PW / 2 + PW / 32 + (i * PW) / 16, 0.16, FZ).castShadow = false;
  const lineMat = mat("#f4f2ea");
  const line = (w, d, x, z, parent = scene) => { const l = box(w, 0.03, d, lineMat, x, 0.18, z, parent); l.castShadow = false; };
  line(PW, 0.14, 0, FZ - PD / 2); line(PW, 0.14, 0, FZ + PD / 2); line(0.14, PD, -PW / 2, FZ); line(0.14, PD, PW / 2, FZ);
    for (const sx of [-1, 1]) {
    line(0.14, 8, sx * (PW / 2 - 4), FZ); line(4, 0.14, sx * (PW / 2 - 2), FZ - 4); line(4, 0.14, sx * (PW / 2 - 2), FZ + 4);
    const gx = sx * (PW / 2 + 0.5);
    box(0.14, 1.5, 0.14, "#f4f2ea", gx, 0.9, FZ - 1.8); box(0.14, 1.5, 0.14, "#f4f2ea", gx, 0.9, FZ + 1.8); box(0.14, 0.14, 3.7, "#f4f2ea", gx, 1.65, FZ);
    box(0.06, 1.4, 3.6, "#d9d6cc", gx + sx * 1, 0.85, FZ).castShadow = false;
  }
  // Bandeirinhas de escanteio (balançam ao vento)
  const cornerFlags = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * PW / 2, z = FZ + sz * PD / 2;
    box(0.06, 1.5, 0.06, "#f4f2ea", x, 0.9, z);
    const f = new THREE.Group(); f.position.set(x, 1.5, z); scene.add(f);
    box(0.55, 0.36, 0.03, "#ffd23f", 0.28, 0, 0, f).castShadow = false;
    cornerFlags.push(f);
  }

  // ---------- Áreas dos grupos ----------
  // Até 3 grupos: faixas lado a lado. 4 ou mais: grade (2x2: A e B no fundo, C e D na frente).
  let zoneW = 0, zoneD = 0, zoneRows = 1, zones = [], zoneGroup = null;
  function buildZones() {
    if (zoneGroup) scene.remove(zoneGroup);
    zoneGroup = new THREE.Group(); scene.add(zoneGroup);
    const n = LABELS.length, cols = n <= 3 ? n : Math.ceil(n / 2);
    zoneRows = Math.ceil(n / cols); zoneW = PW / cols; zoneD = PD / zoneRows;
    for (let c = 1; c < cols; c++) for (let k = 0; k < 11; k++) line(0.14, 0.8, -PW / 2 + c * zoneW, FZ - PD / 2 + 0.7 + (k * (PD - 1.4)) / 10, zoneGroup);
    for (let r = 1; r < zoneRows; r++) for (let k = 0; k < 17; k++) line(0.8, 0.14, -PW / 2 + 0.8 + (k * (PW - 1.6)) / 16, FZ - PD / 2 + r * zoneD, zoneGroup);
    zones = LABELS.map((label, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = -PW / 2 + zoneW / 2 + col * zoneW, zc = FZ - PD / 2 + zoneD / 2 + row * zoneD;
      const labelZ = zc - zoneD / 2 + (zoneRows > 1 ? 1.3 : 1.6);
      const txt = `GRUPO ${label}`, tw = textW(txt) + 2;
      const tex = pixTex(tw, 9, (g) => pixText(g, txt, 1, 1, 1, "#f4f2ea"));
      const lw = Math.min(zoneW * 0.6, zoneRows > 1 ? 7.5 : 9.5);
      flat(lw, (lw * 9) / tw, new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.5, roughness: 1 }), x, 0.2, labelZ, zoneGroup);
      // placa alta com a letra do grupo, visível por cima dos jogadores
      const px = x - zoneW / 2 + 0.8;
      box(0.12, 3.4, 0.12, "#203127", px, 1.7, labelZ, zoneGroup);
      const sign = new THREE.Group(); sign.position.set(px, 3.7, labelZ); sign.rotation.y = FACE_CAM; zoneGroup.add(sign);
      box(1.7, 1.7, 0.14, "#16211a", 0, 0, 0, sign);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: pixTex(9, 9, (g) => { g.fillStyle = "#1c2a21"; g.fillRect(0, 0, 9, 9); pixText(g, label, 2, 1, 1, "#ffd23f"); }), toneMapped: false }));
      face.position.z = 0.08; sign.add(face);
      return { label, x, zc, members: DRAW.filter((d) => d.groupLabel === label) };
    });
  }
  buildZones();
  function spotOf(item) {
    const z = zones.find((zz) => zz.label === item.groupLabel);
    const idx = z.members.indexOf(item), m = z.members.length;
    if (zoneRows > 1) {
      // grade: o grupo fica em fila, lado a lado, alternando um passo à frente
      const sp = Math.min(3.3, zoneW / (m + 0.4));
      return new THREE.Vector3(z.x + (idx - (m - 1) / 2) * sp, 0.17, z.zc + 0.6 + (idx % 2) * 1.1);
    }
    const cols = 2, rows = Math.ceil(m / cols), col = idx % cols, row = Math.floor(idx / cols);
    const dz = rows > 1 ? Math.min(4.2, 8 / (rows - 1)) : 0;
    return new THREE.Vector3(z.x + (col - 0.5) * Math.min(5, zoneW / 2.3) + (row % 2) * 0.9, 0.17, z.zc + 2.2 + row * dz - ((rows - 1) * dz) / 2);
  }

  // ================= Arena (inspirada na Arena da Amazônia, Manaus) =================
  // Arquibancada contínua em volta do campo (retângulo de cantos arredondados), fachada e cobertura brancas
  // em "cesto de palha" com recortes em X que diminuem para o alto, e assentos amarelos, laranjas e vermelhos.
  // A frente é baixa (corte de maquete) para a câmera enxergar o campo; nela fica o túnel de entrada.
  const crowdColors = ["#c0453a", "#e0b44a", "#3d5f9e", "#e9e4d8", "#3f7f53", "#2a2d3a", "#9a6a4a", "#7a4f8f", "#e8732c", "#2f8fbf"];
  const skinTones = ["#f0c39a", "#d9a777", "#b07a4f", "#7f5233"];
  const SEAT_COLORS = ["#ffd23f", "#ffb400", "#ff9a1c", "#f2741b", "#e8502c", "#cf3a2a", "#a8242a"]; // as 7 cores das frutas
  const crowd = [];
  const colTmp = new THREE.Color();
  const RC = 2.5, A_HALF = FW / 2 - RC, B_HALF = FD / 2 - RC;
  const ROWS = 11, FRONT_ROWS = 3, ROW_D = 0.95, ROW_H = 0.6, ROW0 = 1.1;
  const D_OUT = ROW0 + ROWS * ROW_D + 0.2;          // pé da fachada
  const H_F = 0.5 + ROWS * ROW_H + 4.4;             // altura da fachada / cobertura
  const D_IN = 4.4;                                 // borda interna da cobertura (anel de luzes)
  const ROOF_IN_Y = H_F - 1.8;
  const TUNNEL_HALF = 4.3;                          // vão da frente por onde os jogadores entram
  // contorno: amostras em retas e arcos (posição para uma distância d do campo)
  function lineSamples(x0, z0, x1, z1, nx, nz, step = 0.6) {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / step)), out = [];
    for (let i = 0; i < n; i++) { const k = (i + 0.5) / n; out.push({ cx: x0 + (x1 - x0) * k, cz: z0 + (z1 - z0) * k, nx, nz, line: L / n }); }
    return out;
  }
  function arcSamples(cx, cz, a0, a1, dMax) {
    const n = Math.ceil(((RC + dMax) * Math.abs(a1 - a0)) / 0.6), out = [];
    for (let i = 0; i < n; i++) { const a = a0 + ((a1 - a0) * (i + 0.5)) / n; out.push({ cx, cz, a, da: Math.abs(a1 - a0) / n, nx: Math.cos(a), nz: Math.sin(a) }); }
    return out;
  }
  const at = (s, d) => (s.line ? { x: s.cx + s.nx * d, z: s.cz + s.nz * d, len: s.line } : { x: s.cx + Math.cos(s.a) * (RC + d), z: s.cz + Math.sin(s.a) * (RC + d), len: (RC + d) * s.da });
  const yawOf = (s) => Math.atan2(s.nx, s.nz);
  // "U" alto: lateral esquerda → canto → fundo → canto → lateral direita
  const TALL = [
    ...lineSamples(-FW / 2, FZ + B_HALF, -FW / 2, FZ - B_HALF, -1, 0),
    ...arcSamples(-A_HALF, FZ - B_HALF, Math.PI, Math.PI * 1.5, D_OUT + 1),
    ...lineSamples(-A_HALF, BACK, A_HALF, BACK, 0, -1),
    ...arcSamples(A_HALF, FZ - B_HALF, Math.PI * 1.5, Math.PI * 2, D_OUT + 1),
    ...lineSamples(FW / 2, FZ - B_HALF, FW / 2, FZ + B_HALF, 1, 0),
  ];
  const LOW = [
    ...arcSamples(A_HALF, FZ + B_HALF, 0, Math.PI / 2, 4),
    ...lineSamples(A_HALF, FRONT, -A_HALF, FRONT, 0, 1),
    ...arcSamples(-A_HALF, FZ + B_HALF, Math.PI / 2, Math.PI, 4),
  ];
  // degraus e assentos (instanciados)
  const tierList = [];
  for (const [list, rows, low] of [[TALL, ROWS, false], [LOW, FRONT_ROWS, true]]) for (const s of list) for (let i = 0; i < rows; i++) {
    const d = ROW0 + i * ROW_D, p = at(s, d);
    if (low && Math.abs(p.x - GATE_X) < TUNNEL_HALF && s.line) continue;
    tierList.push({ s, i, d, p, h: 0.5 + i * ROW_H, yaw: yawOf(s) });
  }
  const tiers = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1 }), tierList.length);
  const seats = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9 }), tierList.length);
  tiers.castShadow = tiers.receiveShadow = seats.receiveShadow = true;
  tierList.forEach((r, k) => {
    tmp.rotation.set(0, r.yaw, 0);
    tmp.position.set(r.p.x, r.h / 2, r.p.z); tmp.scale.set(r.p.len * 1.04, r.h, ROW_D * 1.01); tmp.updateMatrix(); tiers.setMatrixAt(k, tmp.matrix);
    tiers.setColorAt(k, colTmp.set(r.i % 2 ? "#8f959c" : "#9ca2a9"));
    const sp = at(r.s, r.d + 0.2);
    tmp.position.set(sp.x, r.h + 0.09, sp.z); tmp.scale.set(r.p.len * 1.02, 0.18, 0.42); tmp.updateMatrix(); seats.setMatrixAt(k, tmp.matrix);
    // mosaico de cores: mais amarelo embaixo, mais vermelho em cima, misturado
    const ci = Math.max(0, Math.min(6, Math.round((r.i / ROWS) * 4 + srand() * 3.2 - 0.6)));
    seats.setColorAt(k, colTmp.set(SEAT_COLORS[ci]));
    if (srand() < 0.7) crowd.push({ x: r.p.x, y: r.h + 0.4, z: r.p.z, r: r.yaw, tx: Math.cos(r.yaw), tz: -Math.sin(r.yaw), c: crowdColors[Math.floor(srand() * 10)], sk: skinTones[Math.floor(srand() * 4)], ph: srand() * 6.28 });
  });
  scene.add(tiers, seats);
  // faixas de malha (fachada e cobertura) seguindo o contorno
  function bandMesh(samples, profile, vs, material, uTile) {
    const pos = [], uv = [], idx = [], R = profile.length;
    let u = 0, prev = null;
    samples.forEach((s) => {
      const ref = at(s, profile[0][0]);
      if (prev) u += Math.hypot(ref.x - prev.x, ref.z - prev.z) / uTile;
      prev = ref;
      profile.forEach(([d, y], k) => { const p = at(s, d); pos.push(p.x, y, p.z); uv.push(u, vs[k]); });
    });
    for (let i = 0; i < samples.length - 1; i++) for (let k = 0; k < R - 1; k++) { const a = i * R + k, c = a + R; idx.push(a, c, a + 1, a + 1, c, c + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, material); m.castShadow = m.receiveShadow = true; scene.add(m); return m;
  }
  // fachada: membrana branca com recortes em X que diminuem para o alto (linhas de cima menores)
  const facadeTex = pixTex(48, 64, (g) => {
    let y0 = 0;
    for (const hgt of [4, 4, 8, 8, 12, 12, 16]) {
      for (let y = 0; y < hgt; y++) for (let x = 0; x < 48; x++) {
        const u = (x % hgt + 0.5) / hgt, v = (y + 0.5) / hgt, t = 0.13;
        const onX = Math.abs(u - v) < t || Math.abs(u + v - 1) < t;
        const edge = !onX && (Math.abs(u - v) < t + 1.2 / hgt || Math.abs(u + v - 1) < t + 1.2 / hgt);
        g.fillStyle = onX ? "rgba(20,26,40,0.2)" : edge ? "#c4c9d2" : "#eef0f2"; g.fillRect(x, y0 + y, 1, 1);
      }
      y0 += hgt;
    }
  });
  facadeTex.wrapS = THREE.RepeatWrapping;
  const facadeMat = new THREE.MeshStandardMaterial({ map: facadeTex, transparent: true, side: THREE.DoubleSide, roughness: 0.85, emissive: "#7d8aa6", emissiveMap: facadeTex, emissiveIntensity: 0.35 });
  bandMesh(TALL, [[D_OUT - 0.4, 0], [D_OUT + 1.1, H_F * 0.5], [D_OUT + 0.4, H_F]], [0, 0.5, 1], facadeMat, 7);
  // cobertura translúcida com a mesma malha (desce em direção ao campo)
  const roofTex = pixTex(32, 16, (g) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 32; x++) {
      const u = (x % 8 + 0.5) / 8, v = (y % 8 + 0.5) / 8, beam = Math.abs(u - v) < 0.14 || Math.abs(u + v - 1) < 0.14;
      g.fillStyle = beam ? "#d4d8df" : "rgba(238,240,244,0.62)"; g.fillRect(x, y, 1, 1);
    }
  });
  roofTex.wrapS = roofTex.wrapT = THREE.RepeatWrapping; roofTex.repeat.set(1, 3);
  const roofMat = new THREE.MeshStandardMaterial({ map: roofTex, transparent: true, side: THREE.DoubleSide, roughness: 0.8, emissive: "#8e98b2", emissiveMap: roofTex, emissiveIntensity: 0.28 });
  bandMesh(TALL, [[D_OUT + 0.4, H_F], [D_IN, ROOF_IN_Y]], [0, 1], roofMat, 3.5);
  // anel de luzes na borda interna da cobertura
  bandMesh(TALL, [[D_IN - 0.05, ROOF_IN_Y - 0.12], [D_IN + 0.5, ROOF_IN_Y - 0.06]], [0, 1], glowMat("#fff6dc", 2.4), 2).castShadow = false;
  // muros do fim do "U" (corte da maquete) e o muro de trás da frente baixa
  for (const s of [TALL[0], TALL[TALL.length - 1]]) {
    const p0 = at(s, ROW0 - 0.5), p1 = at(s, D_OUT);
    const wall = box(0.35, H_F * 0.62, Math.hypot(p1.x - p0.x, p1.z - p0.z), "#b4bac3", (p0.x + p1.x) / 2, (H_F * 0.62) / 2, (p0.z + p1.z) / 2);
    wall.rotation.y = yawOf(s);
  }
  for (const sx of [-1, 1]) {
    const x0 = GATE_X + sx * TUNNEL_HALF, x1 = sx * (A_HALF + 0.3);
    box(Math.abs(x1 - x0), 0.5 + FRONT_ROWS * ROW_H + 0.6, 0.3, "#7d838b", (x0 + x1) / 2, (0.5 + FRONT_ROWS * ROW_H + 0.6) / 2, FRONT + ROW0 + FRONT_ROWS * ROW_D - 0.3);
    box(0.5, 3.4, FRONT_ROWS * ROW_D + 0.6, "#8a9099", GATE_X + sx * (TUNNEL_HALF + 0.25), 1.7, FRONT + ROW0 + (FRONT_ROWS * ROW_D) / 2 - 0.3); // pilares do túnel
  }
  {
    // letreiro iluminado em cima da entrada
    const txt = "COPINHA DOS LIXOS", tw = textW(txt) + 6;
    const tex = pixTex(tw, 11, (g, w, h) => { g.fillStyle = "#0b0e12"; g.fillRect(0, 0, w, h); pixText(g, txt, 3, 2, 1, "#ffd23f"); });
    box(TUNNEL_HALF * 2 + 1, 0.9, 0.3, "#15181c", GATE_X, 3.75, FRONT + ROW0 + FRONT_ROWS * ROW_D - 0.1);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(TUNNEL_HALF * 2 + 0.6, 0.75), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(1.4, 1.4, 1.4) }));
    sign.position.set(GATE_X, 3.75, FRONT + ROW0 + FRONT_ROWS * ROW_D + 0.06); scene.add(sign);
  }
  // compatibilidade com o resto da cena (bandeiras, sinalizadores, papel picado, fogos)
  const BZ = BACK - ROW0, B_DEPTH = ROWS * ROW_D, LX = -FW / 2 - ROW0, L_LEN = 2 * B_HALF;

  // Placas de LED em volta do campo (no lugar do alambrado)
  function ledBoard(text, x0, z0, x1, z1) {
    const len = Math.hypot(x1 - x0, z1 - z0), alongX = z0 === z1, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    box(alongX ? len : 0.16, 0.95, alongX ? 0.16 : len, "#15181c", cx, 0.48, cz);
    const tw = Math.round(len / (0.85 / 11)), unit = textW(text) + 14, n = Math.max(1, Math.floor(tw / unit));
    const tex = pixTex(tw, 11, (g, w, h) => { g.fillStyle = "#0b0e12"; g.fillRect(0, 0, w, h); for (let k = 0; k < n; k++) pixText(g, text, Math.round(((k + 0.5) * w) / n), 2, 1, k % 2 ? "#5bd94f" : "#ffd23f", "center"); });
    const ledMat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(1.3, 1.3, 1.3) });
    for (const sg of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.85), ledMat);
      m.position.set(cx + (alongX ? 0 : sg * 0.085), 0.48, cz + (alongX ? sg * 0.085 : 0));
      m.rotation.y = alongX ? (sg > 0 ? 0 : Math.PI) : sg > 0 ? Math.PI / 2 : -Math.PI / 2;
      scene.add(m);
    }
  }
  ledBoard("BEM-VINDOS AO LIXÃO", -FW / 2, BACK, FW / 2, BACK);
  ledBoard("COPINHA", -FW / 2, BACK, -FW / 2, FRONT);
  ledBoard("COPINHA", FW / 2, BACK, FW / 2, FRONT);
  ledBoard("COPINHA DOS LIXOS", -FW / 2, FRONT, GATE_X - GATE_W / 2, FRONT);
  ledBoard("COPINHA DOS LIXOS", GATE_X + GATE_W / 2, FRONT, FW / 2, FRONT);

  const crowdBody = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.42, 0.26), new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1 }), crowd.length);
  const crowdHead = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1 }), crowd.length);
  const crowdArm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, 0.34, 0.09), new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1 }), crowd.length * 2);
  crowdBody.castShadow = true;
  const cc = new THREE.Color();
  crowd.forEach((p, i) => { crowdBody.setColorAt(i, cc.set(p.c)); crowdHead.setColorAt(i, cc.set(p.sk)); crowdArm.setColorAt(i * 2, cc.set(p.sk)); crowdArm.setColorAt(i * 2 + 1, cc.set(p.sk)); });
  scene.add(crowdBody, crowdHead, crowdArm);
  let cheer = 0;
  function updateCrowd(t) {
    const up0 = Math.min(1, cheer * 1.6);
    crowd.forEach((p, i) => {
      const wave = Math.max(0, Math.sin(t * 9 + p.ph));
      const barra = p.z < BACK - 2 && Math.abs(p.x) < 8 ? Math.max(0, Math.sin(t * 7.5 + p.x * 0.12)) * 0.26 : 0; // a barra pula sem parar
      const jump = Math.max(barra, wave * 0.3 * cheer) + Math.max(0, Math.sin(t * 1.7 + p.ph)) * 0.03;
      tmp.rotation.set(0, p.r, 0); tmp.scale.setScalar(1);
      tmp.position.set(p.x, p.y + jump, p.z); tmp.updateMatrix(); crowdBody.setMatrixAt(i, tmp.matrix);
      tmp.position.y += 0.32; tmp.updateMatrix(); crowdHead.setMatrixAt(i, tmp.matrix);
      // braços: abaixados ao lado do corpo, levantam e balançam quando a torcida vibra
      const up = up0 * (0.55 + 0.45 * wave);
      for (const side of [-1, 1]) {
        const off = side * (0.21 + up * 0.03);
        tmp.position.set(p.x + off * p.tx, p.y + jump + 0.02 + up * 0.46, p.z + off * p.tz);
        tmp.rotation.set(0, p.r, -side * up * (0.25 + 0.2 * Math.sin(t * 12 + p.ph)));
        tmp.updateMatrix(); crowdArm.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), tmp.matrix);
      }
    });
    crowdBody.instanceMatrix.needsUpdate = crowdHead.instanceMatrix.needsUpdate = crowdArm.instanceMatrix.needsUpdate = true;
  }

  // ---------- Árvores ----------
  const pines = [];
  for (let x = -44; x <= 44; x += 1.8) pines.push([x + sr(-0.3, 0.3), BZ - B_DEPTH - 4 + sr(-0.4, 0.4), sr(1.05, 1.5)]);
  for (let z = BACK - 8; z <= FRONT + 2; z += 1.9) pines.push([FW / 2 + 16 + sr(-0.3, 0.3), z, sr(0.9, 1.25)]);
  for (let z = BACK - 8; z <= FRONT - 2; z += 1.9) pines.push([LX - B_DEPTH - 5 + sr(-0.3, 0.3), z, sr(1, 1.4)]);
  for (let i = 0; i < 180; i++) {
    const a = srand() * Math.PI * 2, r = sr(40, 85), x = Math.cos(a) * r * 1.2, z = Math.sin(a) * r;
    if (z > ROAD_Z - 4 && Math.abs(x) < 60) continue; // frente livre (é onde fica a câmera)
    pines.push([x, z, sr(1, 1.6)]);
  }
  [[1.25, 2.6, 1.6, "#295f31"], [1.0, 2.3, 3.0, "#2f6d37"], [0.7, 2.0, 4.3, "#357a3d"]].forEach(([r, h, y, c], lvl) => {
    const im = new THREE.InstancedMesh(new THREE.ConeGeometry(r, h, 6), mat(c), pines.length);
    im.castShadow = true;
    pines.forEach(([x, z, s], i) => { tmp.position.set(x, y * s + 0.5, z); tmp.scale.setScalar(s); tmp.rotation.set(0, i + lvl, 0); tmp.updateMatrix(); im.setMatrixAt(i, tmp.matrix); });
    scene.add(im);
  });
  const rounds = [[-FW / 2 - 9, FRONT + 3.5], [-FW / 2 - 12, FRONT + 6], [FW / 2 + 4.5, FRONT + 5.5], [FW / 2 + 18, FRONT + 4], [-33, BACK - 6], [33, BACK - 8]];
  const canopy = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.4, 0), mat("#4f8f3e"), rounds.length);
  const trunk = new THREE.InstancedMesh(new THREE.BoxGeometry(0.32, 1.6, 0.32), mat("#6b4a2e"), rounds.length);
  canopy.castShadow = trunk.castShadow = true;
  rounds.forEach(([x, z], i) => { const s = sr(0.9, 1.25); tmp.scale.setScalar(1); tmp.rotation.set(0, 0, 0); tmp.position.set(x, 0.8, z); tmp.updateMatrix(); trunk.setMatrixAt(i, tmp.matrix); tmp.position.set(x, 2.2 * s + 0.4, z); tmp.scale.setScalar(s); tmp.rotation.set(sr(0, 1), sr(0, 6), 0); tmp.updateMatrix(); canopy.setMatrixAt(i, tmp.matrix); });
  scene.add(canopy, trunk);

  // ---------- Refletores, postes, bancos, bicicletas ----------
  // refletores presos no anel da cobertura, iluminando o campo
  [[0.2, true], [0.8, true], [0.04, false], [0.96, false]].forEach(([k, shadow]) => {
    const p = at(TALL[Math.floor(TALL.length * k)], D_IN + 0.2);
    const spot = new THREE.SpotLight("#fff1d2", 1.25, 0, 0.78, 0.55, 0);
    spot.position.set(p.x, ROOF_IN_Y - 0.3, p.z); spot.target.position.set(-p.x * 0.3, 0, FZ - (p.z - FZ) * 0.3);
    if (shadow) { spot.castShadow = true; spot.shadow.mapSize.set(2048, 2048); spot.shadow.camera.near = 3; spot.shadow.camera.far = 80; spot.shadow.bias = -0.0004; spot.shadow.normalBias = 0.03; }
    scene.add(spot, spot.target);
  });
  for (const x of [-20, -13, -8, 8, 13, 19]) { box(0.12, 2.3, 0.12, "#262826", x, 1.15, FRONT + 4.6); box(0.36, 0.3, 0.36, "#262826", x, 2.4, FRONT + 4.6); box(0.24, 0.1, 0.24, glowMat("#ffe2a0", 2.2), x, 2.2, FRONT + 4.6); }
  // luz da rua, para ver o caminhão e o jogador saindo
  const roadLight = new THREE.PointLight("#ffd9a0", 18, 18, 2); roadLight.position.set(GATE_X, 3.4, ROAD_Z - 2.6); scene.add(roadLight);
  function bench(x, z, sitters) {
    box(1.8, 0.12, 0.5, "#8a5b36", x, 0.5, z); box(1.8, 0.45, 0.1, "#8a5b36", x, 0.8, z - 0.25);
    for (const dx of [-0.75, 0.75]) box(0.1, 0.5, 0.45, "#2a2a2a", x + dx, 0.25, z);
    sitters.forEach((c, i) => { const sx = x - 0.4 + i * 0.8; box(0.36, 0.5, 0.28, c, sx, 0.85, z - 0.05); box(0.24, 0.24, 0.24, "#d9a777", sx, 1.25, z - 0.05); box(0.3, 0.14, 0.4, "#2f3b55", sx, 0.6, z + 0.15); });
  }
  bench(-16.5, FRONT + 4.2, ["#c0453a", "#3d5f9e"]); bench(10.2, FRONT + 4.2, ["#e0b44a"]); bench(15.6, FRONT + 4.2, ["#3f7f53", "#e9e4d8"]); 
  for (const [dx, frameC] of [[0, "#c0453a"], [0.9, "#3d5f9e"]]) {
    const bx = -10.6 + dx, bz = FRONT + 4 + dx * 0.4;
    for (const wx of [-0.45, 0.45]) { const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 4, 10), mat("#222222")); wheel.position.set(bx + wx, 0.35, bz); wheel.castShadow = true; scene.add(wheel); }
    box(0.9, 0.06, 0.06, frameC, bx, 0.6, bz);
  }

  // ---------- Caminhão coletor de lixo (cabine na frente, compactador e tampa traseira que levanta) ----------
  const truck = new THREE.Group(); truck.position.set(TRUCK_X, 0.1, ROAD_Z); scene.add(truck);
  const truckBody = new THREE.Group(); truck.add(truckBody);
  const glassMat = new THREE.MeshStandardMaterial({ color: "#35607e", roughness: 0.25, flatShading: true });
  box(9.4, 0.45, 2.2, "#2b2d3a", 0.1, 0.78, 0, truckBody);                                // chassi
  // cabine branca com faixa verde
  box(2.3, 2.4, 2.45, "#f2f0e8", -3.75, 2.2, 0, truckBody);
  box(2.32, 0.24, 2.47, "#2c7a3a", -3.75, 1.72, 0, truckBody);
  box(0.06, 1.0, 2.1, glassMat, -4.91, 2.78, 0, truckBody);                                // para-brisa
  for (const z of [-1.235, 1.235]) box(1.0, 0.85, 0.04, glassMat, -4.1, 2.75, z, truckBody); // janelas
  box(0.06, 0.5, 1.3, "#2b2d3a", -4.91, 1.4, 0, truckBody);                                // grade
  box(0.3, 0.3, 2.5, "#9a9fae", -4.98, 1.0, 0, truckBody);                                 // para-choque
  for (const z of [-1, 1]) { box(0.3, 0.05, 0.05, "#151518", -4.75, 2.9, z * 1.33, truckBody); box(0.08, 0.55, 0.07, "#151518", -4.85, 2.65, z * 1.45, truckBody); } // retrovisores
  for (const z of [-1, 1]) box(0.5, 0.08, 0.3, "#5d6170", -3.9, 0.72, z * 1.27, truckBody); // degraus
  const beaconMat = new THREE.MeshStandardMaterial({ color: "#ffb020", emissive: "#000000", flatShading: true });
  for (const z of [-0.7, 0.7]) box(0.35, 0.25, 0.35, beaconMat, -3.9, 3.52, z, truckBody); // giroflex
  for (const z of [-0.95, 0.95]) box(0.06, 0.3, 0.42, glowMat("#fff6d0", 3), -4.93, 1.42, z, truckBody).castShadow = false; // faróis
  box(0.16, 1.9, 0.16, "#5d6170", -2.5, 3.25, 1.05, truckBody);                           // escapamento
  // compactador: caixa verde alta com nervuras, faixa branca e letreiro
  box(5.05, 2.8, 2.5, "#3f9a4a", 0.08, 2.42, 0, truckBody);
  box(4.9, 0.28, 2.2, "#3f9a4a", 0.08, 3.94, 0, truckBody);
  box(5.06, 0.36, 2.55, "#2c7a3a", 0.08, 1.2, 0, truckBody);
  box(5.07, 0.16, 2.56, "#f2f0e8", 0.08, 1.56, 0, truckBody);
  for (let i = 0; i < 5; i++) box(0.1, 2.5, 2.57, "#368a42", -2.1 + i * 1.08, 2.55, 0, truckBody);
  {
    const tw = textW("COPINHA") + 4;
    const tex = pixTex(tw, 20, (g, w, h) => { g.fillStyle = "#2c7a3a"; g.fillRect(0, 0, w, h); pixText(g, "COPINHA", 2, 2, 1, "#ffffff"); pixText(g, "LIXO", w / 2, 11, 1, "#ffd23f", "center"); });
    const s = new THREE.Mesh(new THREE.PlaneGeometry(3.4, (3.4 * 20) / tw), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
    s.position.set(0.08, 2.75, 1.29); truckBody.add(s);
    const s2 = s.clone(); s2.position.z = -1.29; s2.rotation.y = Math.PI; truckBody.add(s2);
  }
  for (const z of [-1, 1]) box(1.3, 0.5, 0.3, "#9a9fae", -1.6, 1.0, z * 1.12, truckBody);  // caixas laterais
  // boca do compactador (aparece quando a tampa levanta) com sacos de lixo
  box(0.04, 2.3, 2.1, "#0c0c10", 2.63, 2.35, 0, truckBody);
  [[2.7, 1.55, -0.55, 0.55, "#1b1b1f"], [2.72, 1.6, 0.4, 0.6, "#2b2b31"], [2.68, 2.05, -0.1, 0.5, "#16161a"], [2.7, 1.5, 0.95, 0.4, "#3a6a3a"], [2.66, 2.2, 0.7, 0.35, "#c0453a"]].forEach(([x, y, z, sz, c]) => box(sz, sz, sz, c, x, y, z, truckBody));
  // tampa traseira (dobradiça no alto): chevrons de segurança, boca da caçamba, lanternas, estribos e alças
  const hatch = new THREE.Group(); hatch.position.set(2.6, 4.02, 0); truckBody.add(hatch);
  const chevTex = pixTex(16, 8, (g) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) { g.fillStyle = (x + y) % 8 < 4 ? "#ff8a1c" : "#151518"; g.fillRect(x, y, 1, 1); } });
  box(0.95, 1.5, 2.6, "#2c7a3a", 0.47, -0.75, 0, hatch);
  box(1.85, 1.45, 2.6, "#2c7a3a", 0.92, -2.25, 0, hatch);
  const chev = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshStandardMaterial({ map: chevTex, roughness: 1 }));
  chev.position.set(0.96, -0.75, 0); chev.rotation.y = Math.PI / 2; hatch.add(chev);
  box(0.05, 0.75, 2.05, "#0c0c10", 1.86, -2.0, 0, hatch);                                  // boca da caçamba
  box(0.3, 0.3, 0.3, "#1b1b1f", 1.75, -1.95, -0.5, hatch); box(0.26, 0.26, 0.26, "#c0453a", 1.78, -1.92, 0.3, hatch); // lixo aparecendo
  for (const z of [-1.1, 1.1]) { box(0.06, 0.24, 0.3, glowMat("#ff2a1a", 3), 1.87, -2.8, z, hatch).castShadow = false; box(0.06, 0.18, 0.22, glowMat("#ffb020", 2.4), 0.97, -0.2, z, hatch).castShadow = false; }
  for (const z of [-0.75, 0.75]) box(0.55, 0.08, 0.85, "#9a9fae", 2.05, -2.95, z, hatch);  // estribos dos garis
  for (const z of [-1.32, 1.32]) box(0.06, 1.2, 0.06, "#c9ccd6", 1.88, -1.6, z, hatch);    // alças
  box(0.6, 0.85, 0.6, "#1f6f35", 2.2, -2.35, -0.95, hatch); box(0.66, 0.1, 0.66, "#185c2b", 2.2, -1.88, -0.95, hatch); // contêiner verde no basculante
  const wheelGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.45, 10); wheelGeo.rotateX(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.47, 8); hubGeo.rotateX(Math.PI / 2);
  const wheels = [];
  // luz que acompanha o caminhão pelo lado da câmera (na rua escura ele precisa aparecer)
  const truckLight = new THREE.PointLight("#ffe6c0", 40, 22, 2); scene.add(truckLight);
  for (const x of [-3.6, 0.9, 2.2]) for (const z of [-1.1, 1.1]) {
    const wh = new THREE.Mesh(wheelGeo, mat("#151518")); wh.position.set(x, 0.62, z); wh.castShadow = true; truck.add(wh);
    const hb = new THREE.Mesh(hubGeo, mat("#9a9fae")); hb.position.set(x, 0.62, z); truck.add(hb);
    wheels.push(wh, hb);
  }
  for (const z of [-1, 1]) box(2.3, 0.12, 0.5, "#2b2d3a", 1.55, 1.3, z * 1.1, truckBody);   // para-lamas
  let hatchOpen = 0, hatchGoal = 0;
  // Desktop: caminhão à esquerda do portão. Celular em pé: virado e centralizado, com a tampa perto do portão.
  function placeTruck(portrait) {
    truck.position.x = portrait ? GATE_X + 6.4 : TRUCK_X;
    truck.rotation.y = portrait ? Math.PI : 0;
    truck.updateMatrixWorld(true);
    truckPark.copy(truck.position);
  }
  const truckPark = new THREE.Vector3();
  const EXHAUST = new THREE.Vector3(-2.5, 4.25, 1.05);

  // ---------- Partículas em pixel: "lit" (fumaça, papel, confete) e "glow" (faíscas, fogos) ----------
  function makeParticles(material, MAX) {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, MAX);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false;
    const list = Array.from({ length: MAX }, () => ({ alive: false }));
    tmp.scale.setScalar(0); tmp.position.set(0, -50, 0); tmp.rotation.set(0, 0, 0); tmp.updateMatrix();
    for (let i = 0; i < MAX; i++) { mesh.setMatrixAt(i, tmp.matrix); mesh.setColorAt(i, cc.set("#ffffff")); }
    scene.add(mesh);
    let idx = 0;
    return {
      emit(n, make) {
        for (let k = 0; k < n; k++) {
          const i = idx; idx = (idx + 1) % MAX;
          const q = Object.assign(list[i], { alive: true, life: 0, max: 1, g: -6, drag: 0, size: 0.15, grow: 0, spin: 0, rot: Math.random() * 6, flutter: 0, floor: true, flat: false, boost: 1 }, make(k));
          mesh.setColorAt(i, cc.set(q.color).multiplyScalar(q.boost));
        }
        mesh.instanceColor.needsUpdate = true;
      },
      update(dt) {
        for (let i = 0; i < MAX; i++) {
          const q = list[i]; if (!q.alive) continue;
          q.life += dt;
          if (q.life >= q.max) { q.alive = false; tmp.scale.setScalar(0); tmp.position.set(0, -50, 0); tmp.updateMatrix(); mesh.setMatrixAt(i, tmp.matrix); continue; }
          q.vel.y += q.g * dt;
          if (q.flutter) q.vel.x += Math.sin(q.life * 7 + q.rot) * q.flutter * dt;
          q.vel.multiplyScalar(Math.max(0, 1 - q.drag * dt));
          q.pos.addScaledVector(q.vel, dt);
          if (q.floor && q.pos.y < 0.2) { q.pos.y = 0.2; q.vel.set(0, 0, 0); q.spin = 0; }
          q.rot += q.spin * dt;
          const sz = Math.max(0, q.size + q.grow * q.life) * Math.min(1, (q.max - q.life) / (0.25 * q.max));
          tmp.position.copy(q.pos); tmp.rotation.set(q.rot, q.rot * 0.7, 0); tmp.scale.set(sz, q.flat ? sz * 0.25 : sz, sz);
          tmp.updateMatrix(); mesh.setMatrixAt(i, tmp.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
      },
    };
  }
  const lit = makeParticles(new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1 }), 1800);
  const glow = makeParticles(new THREE.MeshBasicMaterial({ toneMapped: false }), 1600);
  const emit = (n, make) => lit.emit(n, make);
  function updateParts(dt) { lit.update(dt); glow.update(dt); }
  const dust = (pos) => emit(12, () => ({ pos: pos.clone().add(new THREE.Vector3(rnd(-0.3, 0.3), 0.15, rnd(-0.3, 0.3))), vel: new THREE.Vector3(rnd(-1.8, 1.8), rnd(0.6, 1.5), rnd(-1.8, 1.8)), g: -3, drag: 2.5, size: rnd(0.16, 0.26), grow: -0.15, max: rnd(0.45, 0.75), color: pick(["#d9d2c2", "#c8c0ae", "#e6e0d2"]), floor: false }));
  const confetti = (pos, colors) => emit(30, () => ({ pos: pos.clone().add(new THREE.Vector3(0, 2.4, 0)), vel: new THREE.Vector3(rnd(-2.6, 2.6), rnd(4.5, 7.5), rnd(-2.6, 2.6)), g: -7, drag: 1.5, size: rnd(0.12, 0.18), max: rnd(1.4, 2), spin: rnd(-12, 12), flutter: 3, flat: true, color: pick(colors) }));
  const puff = (pos) => emit(1, () => ({ pos: pos.clone(), vel: new THREE.Vector3(rnd(-0.25, 0.25), rnd(0.7, 1.1), rnd(-0.25, 0.25)), g: 0.2, drag: 0.6, size: 0.2, grow: 0.45, max: rnd(0.9, 1.3), color: pick(["#9a9a9a", "#b5b5b5", "#8a8a8a"]), floor: false }));
  let rainLeft = 0;
  const RAIN_COLORS = ["#ffd23f", "#e23b2e", "#2f6fe0", "#ffffff", "#5bd94f", "#ff7ab6", "#f08a1c"];

  // ================= Clima de noite de copa =================
  const rowY = (s) => 0.5 + s * 0.6 + 0.45;
  // Se o aparelho engasgar, desliga o brilho e as sombras e solta menos partículas
  let lowQ = false, perfT = 0, perfN = 0;
  function degrade() {
    lowQ = true; bloomPass.enabled = false;
    scene.traverse((o) => { if (o.isSpotLight) o.castShadow = false; });
  }
  // Sinalizadores vermelhos na torcida: faíscas brilhando + fumaça subindo para o campo
  const flares = [
    { pos: new THREE.Vector3(-11, rowY(1), BZ - 0.95), wind: new THREE.Vector3(0.15, 0, 0.5) },
    { pos: new THREE.Vector3(-2.5, rowY(3), BZ - 2.85), wind: new THREE.Vector3(0.15, 0, 0.5) },
    { pos: new THREE.Vector3(6, rowY(2), BZ - 1.9), wind: new THREE.Vector3(0.15, 0, 0.5) },
    { pos: new THREE.Vector3(13, rowY(4), BZ - 3.8), wind: new THREE.Vector3(0.15, 0, 0.5) },
    { pos: new THREE.Vector3(LX - 0.95, rowY(1), FZ - 4), wind: new THREE.Vector3(0.5, 0, 0.15) },
    { pos: new THREE.Vector3(LX - 2.85, rowY(3), FZ + 5), wind: new THREE.Vector3(0.5, 0, 0.15) },
  ];
  flares.forEach((f, i) => {
    box(0.12, 0.5, 0.12, glowMat("#ff3020", 4), f.pos.x, f.pos.y + 0.1, f.pos.z).castShadow = false;
    f.smokeT = Math.random() * 0.1;
    if (i === 1 || i === 4) { f.light = new THREE.PointLight("#ff3a1e", 14, 11, 2); f.light.position.copy(f.pos).add(new THREE.Vector3(0, 0.8, 0.6)); scene.add(f.light); }
  });
  function updateFlares(dt, t) {
    for (const f of flares) {
      glow.emit(lowQ || f.street ? 1 : 2, () => ({ pos: f.pos.clone().add(new THREE.Vector3(rnd(-0.1, 0.1), 0.4, rnd(-0.1, 0.1))), vel: new THREE.Vector3(rnd(-0.7, 0.7), rnd(1.5, 3.2), rnd(-0.7, 0.7)), g: -2, drag: 1.5, size: rnd(0.1, 0.16), max: rnd(0.25, 0.5), color: pick(["#ff2a1a", "#ff6a2a", "#ffc890"]), boost: 3.2, floor: false }));
      if ((f.smokeT -= dt) <= 0) {
        f.smokeT = f.street ? (lowQ ? 0.3 : 0.15) : lowQ ? 0.16 : 0.06;
        lit.emit(1, () => ({ pos: f.pos.clone().add(new THREE.Vector3(0, 0.5, 0)), vel: new THREE.Vector3(rnd(-0.3, 0.3), rnd(1, 1.6), rnd(-0.3, 0.3)).add(f.wind), g: 0.12, drag: 0.3, size: f.street ? 0.13 : 0.2, grow: f.street ? 0.09 : 0.17, max: f.street ? rnd(1.4, 2) : rnd(2.6, 3.6), color: pick(["#c9585a", "#b5494d", "#d97a7a", "#a8444a"]), floor: false }));
      }
      if (f.light) f.light.intensity = 10 + Math.sin(t * 23 + f.pos.x) * 3 + Math.random() * 4;
    }
  }
  // Imprensa na entrada do estádio: repórteres, cinegrafistas, fotógrafos e
  // um painel de entrevista. Eles viram para acompanhar quem está chegando.
  // Ficam do lado do corredor oposto ao caminhão, para ele não tampar.
  const press = [], pressItems = [];
  const PRESS_Z = FRONT + 5.05;
  function placePress(portrait) {
    const sx = portrait ? -1 : 1;
    for (const it of pressItems) { it.obj.position.x = GATE_X + sx * it.dx; it.obj.rotation.y = sx * it.face; }
    for (const m of press) m.faceNow = sx * m.face;
  }
  function pressPerson(dx, z, face, kind, shirt, pants) {
    const g = new THREE.Group(); g.position.set(GATE_X + dx, 0.1, z); g.rotation.y = face; scene.add(g);
    pressItems.push({ obj: g, dx, face });
    const skin = skinTones[Math.floor(srand() * 4)], hair = ["#1d1a1a", "#4a2c17", "#8c5a2b"][Math.floor(srand() * 3)];
    for (const sx of [-0.13, 0.13]) { box(0.22, 0.7, 0.24, pants, sx, 0.4, 0, g); box(0.24, 0.1, 0.32, "#151518", sx, 0.05, 0.04, g); }
    box(0.6, 0.66, 0.34, shirt, 0, 1.08, 0, g);
    const head = new THREE.Group(); head.position.y = 1.64; g.add(head);
    box(0.42, 0.42, 0.4, skin, 0, 0, 0, head); box(0.44, 0.12, 0.42, hair, 0, 0.24, -0.01, head); box(0.44, 0.24, 0.1, hair, 0, 0.08, -0.2, head);
    for (const ex of [-0.09, 0.09]) box(0.06, 0.07, 0.02, "#151518", ex, 0.03, 0.205, head);
    const arm = (sx, rx) => { const a = new THREE.Group(); a.position.set(sx, 1.36, 0); a.rotation.x = rx; g.add(a); box(0.16, 0.5, 0.18, shirt, 0, -0.2, 0, a); box(0.14, 0.14, 0.15, skin, 0, -0.48, 0, a); return a; };
    let flashAt = null;
    if (kind === "camera") {
      // câmera de ombro, com a luz vermelha de gravando
      arm(-0.38, -0.25); const a = arm(0.38, -2.6); a.rotation.z = 0.25;
      const cam = new THREE.Group(); cam.position.set(0.3, 1.66, 0.12); g.add(cam);
      box(0.32, 0.34, 0.78, "#1b1b1f", 0, 0, 0, cam); box(0.22, 0.22, 0.22, "#2c2f38", 0, 0, 0.46, cam);
      box(0.18, 0.18, 0.04, glowMat("#9fd0ff", 1.3), 0, 0, 0.58, cam).castShadow = false;
      box(0.06, 0.06, 0.04, glowMat("#ff2a1a", 3), 0.1, 0.13, 0.4, cam).castShadow = false;
      box(0.08, 0.1, 0.4, "#2c2f38", 0, 0.22, -0.05, cam);
    } else if (kind === "reporter") {
      // repórter com o microfone esticado, com o cubo da emissora
      arm(-0.38, 0); const a = arm(0.38, -1.25);
      box(0.05, 0.32, 0.05, "#222226", 0, -0.62, 0.02, a); box(0.12, 0.12, 0.12, "#3a3d46", 0, -0.82, 0.02, a); box(0.16, 0.12, 0.16, "#ffd23f", 0, -0.66, 0.02, a);
    } else {
      // fotógrafo com a câmera no rosto
      const a = arm(-0.36, -1.5), b = arm(0.36, -1.5); a.rotation.z = -0.35; b.rotation.z = 0.35;
      box(0.32, 0.22, 0.18, "#1b1b1f", 0, 1.66, 0.3, g); box(0.14, 0.14, 0.2, "#2c2f38", 0, 1.64, 0.46, g);
      box(0.12, 0.08, 0.08, "#d9dde6", 0.08, 1.82, 0.3, g);
      flashAt = new THREE.Vector3(0.08, 1.86, 0.36);
    }
    g.traverse((o) => { if (o.isMesh && o.castShadow !== false) o.castShadow = true; });
    g.scale.setScalar(1.3);
    press.push({ g, head, face, faceNow: face, flashAt, next: Math.random() });
  }
  const TOWARD = -Math.PI / 2 + 0.3; // de frente para o caminho (e um pouco para a rua)
  pressPerson(3.7, PRESS_Z + 0.1, TOWARD, "reporter", "#7a3fd1", "#2b2d3a");
  pressPerson(5.1, PRESS_Z + 0.5, TOWARD + 0.1, "camera", "#2a2d3a", "#22262e");
  pressPerson(4.3, PRESS_Z - 0.65, TOWARD - 0.1, "photo", "#e9e4d8", "#2f3b55");
  pressPerson(6.1, PRESS_Z - 0.2, TOWARD + 0.15, "photo", "#3f7f53", "#22262e");
  pressPerson(3.5, PRESS_Z + 0.95, TOWARD + 0.35, "photo", "#c0453a", "#2f3b55");
  pressPerson(7.1, PRESS_Z + 0.7, TOWARD + 0.25, "camera", "#3a3a3a", "#22262e");
  // câmera no tripé com painel de luz
  {
    const g = new THREE.Group(); g.position.set(GATE_X + 6.9, 0.1, PRESS_Z - 0.55); g.rotation.y = TOWARD; scene.add(g);
    pressItems.push({ obj: g, dx: 6.9, face: TOWARD });
    for (const a of [0, 2.1, 4.2]) { const leg = box(0.06, 1.6, 0.06, "#2c2f38", Math.sin(a) * 0.25, 0.78, Math.cos(a) * 0.25, g); leg.rotation.set(Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3); }
    box(0.36, 0.36, 0.7, "#1b1b1f", 0, 1.78, 0.05, g); box(0.24, 0.24, 0.2, "#2c2f38", 0, 1.78, 0.48, g);
    box(0.05, 1.1, 0.05, "#2c2f38", 0.42, 2.3, -0.1, g);
    box(0.6, 0.42, 0.08, "#15171c", 0.42, 2.9, -0.1, g); box(0.52, 0.34, 0.02, glowMat("#fff6e0", 2.6), 0.42, 2.9, -0.05, g).castShadow = false;
    g.scale.setScalar(1.3);
  }
  // painel de entrevista atrás dos repórteres, com a marca repetida
  {
    const tex = pixTex(40, 30, (g2, w, h) => {
      g2.fillStyle = "#0f6b34"; g2.fillRect(0, 0, w, h);
      for (let row = 0; row < 3; row++) pixText(g2, row % 2 ? "LIXO" : "COPINHA", row % 2 ? 26 : 16, 1 + row * 10, 1, row % 2 ? "#ffd23f" : "#ffffff", "center");
    });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(2, 1);
    // de frente para a rua, atrás do grupo
    const wall = new THREE.Group(); wall.position.set(GATE_X + 5.4, 0, FRONT + 4.2); scene.add(wall);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(3, 2.4), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
    cloth.position.y = 1.3; cloth.castShadow = cloth.receiveShadow = true; wall.add(cloth);
    for (const dx of [-1.52, 1.52]) box(0.08, 2.6, 0.08, "#2c2f38", dx, 1.3, -0.03, wall);
    pressItems.push({ obj: wall, dx: 5.4, face: 0 });
  }
  const pressTmp = new THREE.Vector3();
  function updatePress(t, dt) {
    // quem está chegando agora (fora do campo): a imprensa vira para ele e os fotógrafos disparam o flash
    const target = walkers.find((w) => !w.done && w.p.position.z > FRONT - 0.5);
    for (const m of press) {
      let yaw = m.faceNow;
      if (target) yaw = Math.atan2(target.p.position.x - m.g.position.x, target.p.position.z - m.g.position.z);
      let diff = yaw - m.g.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      m.g.rotation.y += diff * Math.min(1, dt * 5);
      m.head.rotation.y = Math.sin(t * 0.8 + m.next * 6) * (target ? 0.05 : 0.3);
      if (m.flashAt && target && (m.next -= dt) <= 0) {
        m.next = rnd(0.25, 0.8);
        m.g.localToWorld(pressTmp.copy(m.flashAt));
        glow.emit(lowQ ? 3 : 7, () => ({ pos: pressTmp.clone(), vel: new THREE.Vector3(rnd(-1.5, 1.5), rnd(-1.5, 1.5), rnd(-1.5, 1.5)), g: 0, drag: 4, size: rnd(0.22, 0.34), grow: -0.5, max: rnd(0.08, 0.14), color: "#ffffff", boost: 4, floor: false }));
      }
    }
  }

  // Corredor de torcedores do lado de fora, pulando com sinalizadores, do caminhão até o portão
  const fans = [], FAN_S = 2.1;
  // 2 fileiras de cada lado, mais espaçadas: leve no celular
  for (const side of [-1, 1]) for (let row = 0; row < 2; row++) {
    const x = GATE_X + side * (1.9 + row * 0.8);
    for (let z = FRONT + 1.7 + (row % 2) * 0.45; z <= ROAD_Z - 2.3; z += 0.95) {
      fans.push({ x: x + sr(-0.1, 0.1), z: z + sr(-0.08, 0.08), side, c: crowdColors[Math.floor(srand() * 10)], sk: skinTones[Math.floor(srand() * 4)], ph: srand() * 6.28 });
    }
  }
  const fanParts = [["legs", [0.3, 0.45, 0.2]], ["body", [0.4, 0.45, 0.26]], ["head", [0.26, 0.26, 0.26]], ["arm", [0.1, 0.42, 0.1]]];
  const fanMesh = Object.fromEntries(fanParts.map(([k, [w, h, d]]) => {
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1 }), fans.length * (k === "arm" ? 2 : 1));
    scene.add(m); return [k, m];
  }));
  fans.forEach((f, i) => {
    fanMesh.legs.setColorAt(i, cc.set(pick(["#2f3b55", "#22262e", "#3a4a6a"]))); fanMesh.body.setColorAt(i, cc.set(f.c)); fanMesh.head.setColorAt(i, cc.set(f.sk));
    fanMesh.arm.setColorAt(i * 2, cc.set(f.sk)); fanMesh.arm.setColorAt(i * 2 + 1, cc.set(f.sk));
    // alguns da primeira fileira seguram sinalizador
    if (Math.abs(f.x - GATE_X) < 2.3 && i % 4 === 0) {
      f.flare = { pos: new THREE.Vector3(), wind: new THREE.Vector3(0, 0, -0.2), street: true, smokeT: Math.random() * 0.1 };
      f.stick = box(0.1, 0.35, 0.1, glowMat("#ff3020", 4), 0, -50, 0); f.stick.castShadow = false;
    }
  });
  // uma luz vermelha só para o corredor (cada luz pesa em todos os objetos da cena)
  const fanLights = [new THREE.PointLight("#ff3a1e", 16, 10, 2)];
  fanLights[0].position.set(GATE_X, 3, FRONT + 3.5); scene.add(...fanLights);
  function updateFans(t) {
    const S = FAN_S;
    fans.forEach((f, i) => {
      const y0 = 0.08 + Math.max(0, Math.sin(t * 8 + f.ph)) * (0.45 + 0.3 * cheer);
      tmp.rotation.set(0, 0, 0); tmp.scale.setScalar(S);
      tmp.position.set(f.x, y0 + 0.225 * S, f.z); tmp.updateMatrix(); fanMesh.legs.setMatrixAt(i, tmp.matrix);
      tmp.position.set(f.x, y0 + 0.675 * S, f.z); tmp.updateMatrix(); fanMesh.body.setMatrixAt(i, tmp.matrix);
      tmp.position.set(f.x, y0 + 1.03 * S, f.z); tmp.updateMatrix(); fanMesh.head.setMatrixAt(i, tmp.matrix);
      for (const sd of [-1, 1]) {
        const wave = f.flare && sd === 1 ? 0 : 0.25 + 0.25 * Math.sin(t * 11 + f.ph + sd);
        tmp.position.set(f.x + sd * 0.27 * S, y0 + 1.08 * S, f.z); tmp.rotation.set(0, 0, -sd * wave); tmp.updateMatrix();
        fanMesh.arm.setMatrixAt(i * 2 + (sd > 0 ? 1 : 0), tmp.matrix);
      }
      if (f.flare) { f.flare.pos.set(f.x + 0.27 * S, y0 + 1.32 * S, f.z); f.stick.position.copy(f.flare.pos); }
    });
    Object.values(fanMesh).forEach((m) => (m.instanceMatrix.needsUpdate = true));
    fanLights.forEach((l, k) => (l.intensity = 9 + Math.sin(t * 21 + k * 2) * 3 + Math.random() * 4));
  }
  fans.forEach((f) => f.flare && flares.push(f.flare));

  // Bandeiras tremulando na arquibancada
  const flagPairs = [["#ffd23f", "#0a1a52"], ["#e23b2e", "#ffffff"], ["#2fa04a", "#ffffff"], ["#111122", "#ffffff"], ["#6ea0f5", "#ffffff"], ["#ffd23f", "#2fa04a"]];
  const flags = [];
  [[-15, 2], [-7.5, 4], [-0.5, 1], [3.5, 5], [9.5, 3], [16, 1], [LX, 0, 2], [LX, 0, -6]].forEach(([x, row, zz], i) => {
    const onLeft = x === LX;
    const pos = onLeft ? new THREE.Vector3(LX - row * 0.95, rowY(row), FZ + zz) : new THREE.Vector3(x, rowY(row), BZ - row * 0.95);
    box(0.06, 2.4, 0.06, "#d9d6cc", pos.x, pos.y + 1.2, pos.z);
    const [c1, c2] = flagPairs[i % flagPairs.length];
    const tex = pixTex(12, 8, (g) => { g.fillStyle = c1; g.fillRect(0, 0, 12, 8); g.fillStyle = c2; g.fillRect(4, 0, 4, 8); });
    const pivot = new THREE.Group(); pivot.position.set(pos.x, pos.y + 2.3, pos.z); scene.add(pivot);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 1 }));
    cloth.position.set(0.8, -0.5, 0); cloth.castShadow = true; pivot.add(cloth);
    flags.push({ pivot, ph: Math.random() * 6, base: onLeft ? 0 : -Math.PI / 2 });
  });
  // Bandeirão gigante cobrindo parte da arquibancada do fundo, ondulando
  const bigTex = pixTex(64, 22, (g, w, h) => {
    for (let x = 0; x < w; x += 8) { g.fillStyle = (x / 8) % 2 ? "#1f8a3d" : "#ffffff"; g.fillRect(x, 0, 8, h); }
    g.fillStyle = "#0f6b34"; g.fillRect(3, 1, 58, 20);
    pixText(g, "COPINHA", 32, 3, 1, "#ffffff", "center");
    pixText(g, "DOS LIXOS", 32, 12, 1, "#ffffff", "center");
  });
  const bigGeo = new THREE.PlaneGeometry(13, 4.4, 26, 9);
  const bigBase = bigGeo.attributes.position.array.slice();
  const bigFlag = new THREE.Mesh(bigGeo, new THREE.MeshStandardMaterial({ map: bigTex, side: THREE.DoubleSide, roughness: 1, flatShading: true }));
  const slope = Math.atan2(0.6, 0.95);
  bigFlag.rotation.x = -(Math.PI / 2 - slope);
  bigFlag.position.set(-1, rowY(2) + 1.05, BZ - 1.9);
  bigFlag.castShadow = bigFlag.receiveShadow = true; scene.add(bigFlag);
  function updateBigFlag(t) {
    const a = bigGeo.attributes.position;
    for (let i = 0; i < a.count; i++) {
      const x = bigBase[i * 3], y = bigBase[i * 3 + 1];
      a.array[i * 3 + 2] = Math.sin(x * 0.9 + t * 3.2) * 0.22 + Math.sin(y * 1.6 + t * 2.1 + x * 0.3) * 0.14;
    }
    a.needsUpdate = true; bigGeo.computeVertexNormals();
  }
  // Tecidos da torcida: faixas compridas que descem do anel de cima até as
  // fileiras de baixo, por cima da galera, como nas arquibancadas sul-americanas.
  const CLOTH_COLORS = [["#ffffff", "#1f8a3d"], ["#c8102e", "#111111"], ["#ffd23f", "#0a2a6b"], ["#ffffff", "#c8102e"], ["#0a2a6b", "#ffffff"], ["#111111", "#ffffff"], ["#1f8a3d", "#ffd23f"]];
  const clothMats = CLOTH_COLORS.map(([c1, c2]) => new THREE.MeshStandardMaterial({
    map: pixTex(6, 2, (g) => { for (let x = 0; x < 6; x++) { g.fillStyle = x === 2 || x === 3 ? c2 : c1; g.fillRect(x, 0, 1, 2); } }),
    side: THREE.DoubleSide, roughness: 1, flatShading: true,
  }));
  const slopeLen = Math.hypot(ROW_D, ROW_H), LIFT_OUT = -ROW_H / slopeLen, LIFT_UP = ROW_D / slopeLen;
  const cloths = [];
  function addCloth(s, iTop, iBot, width, mat) {
    const N = Math.max(4, Math.round((iTop - iBot) * 1.3)), tx = -s.nz, tz = s.nx;
    const pos = [], uv = [], idx = [];
    for (let k = 0; k <= N; k++) {
      const i = iTop - ((iTop - iBot) * k) / N, d = ROW0 + i * ROW_D + 0.2, y = 0.5 + i * ROW_H + 1.05;
      const c = at(s, d);
      for (const side of [-1, 1]) { pos.push(c.x + tx * side * width / 2, y, c.z + tz * side * width / 2); uv.push(side < 0 ? 0 : 1, k / N); }
      if (k < N) { const a = k * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh);
    cloths.push({ geo, base: Float32Array.from(pos), N, lx: s.nx * LIFT_OUT, lz: s.nz * LIFT_OUT, ph: Math.random() * 6 });
  }
  const back = (x) => ({ cx: x, cz: BACK, nx: 0, nz: -1, line: 1 });
  const sideOf = (sx, z) => ({ cx: sx * FW / 2, cz: z, nx: sx, nz: 0, line: 1 });
  let ci = 0;
  for (const x of [-14, -11.3, -8.7, 7.6, 10.2, 12.9]) addCloth(back(x), ROWS - 1, 1, 2, clothMats[ci++ % clothMats.length]);
  for (const x of [-5.4, -2.4, 0.6, 3.6]) addCloth(back(x), ROWS - 1, 5.6, 1.9, clothMats[ci++ % clothMats.length]); // acima do bandeirão
  for (const sx of [-1, 1]) for (const z of [FZ - 6, FZ - 2.3, FZ + 1.4, FZ + 5.1]) addCloth(sideOf(sx, z), ROWS - 1, 1, 1.9, clothMats[ci++ % clothMats.length]);
  function updateCloths(t) {
    for (const c of cloths) {
      const a = c.geo.attributes.position, sway = 0.6 + 0.4 * Math.sin(t * 1.3 + c.ph);
      for (let k = 0; k <= c.N; k++) {
        const off = Math.sin(t * 2.4 + k * 0.6 + c.ph) * 0.17 * sway;
        for (let j = 0; j < 2; j++) {
          const v = (k * 2 + j) * 3, o = off + (j ? 0.03 : -0.03) * Math.sin(t * 3.1 + k);
          a.array[v] = c.base[v] + c.lx * o; a.array[v + 1] = c.base[v + 1] + LIFT_UP * o; a.array[v + 2] = c.base[v + 2] + c.lz * o;
        }
      }
      a.needsUpdate = true;
    }
  }
  // Fogos de artifício estourando atrás das arquibancadas
  const FIRE_COLORS = ["#ff3b3b", "#ffd23f", "#3fa9ff", "#5bd94f", "#ff7ab6", "#ffffff", "#c77dff", "#ff9a2a"];
  const rockets = [];
  function launchFirework(x, colors) {
    const side = x ?? (Math.random() < 0.5 ? -1 : 1) * rnd(8, 22);
    rockets.push({ pos: new THREE.Vector3(side, 1, BZ - B_DEPTH - 3), vel: new THREE.Vector3(rnd(-1, 1), rnd(19, 23), rnd(0.5, 1.5)), fuse: rnd(1, 1.3), colors: colors ?? [pick(FIRE_COLORS), pick(FIRE_COLORS)] });
  }
  function updateRockets(dt) {
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.fuse -= dt; r.vel.y -= 9 * dt; r.pos.addScaledVector(r.vel, dt);
      glow.emit(1, () => ({ pos: r.pos.clone(), vel: new THREE.Vector3(rnd(-0.3, 0.3), rnd(-1, 0), rnd(-0.3, 0.3)), g: -2, size: 0.16, max: 0.35, color: "#ffd9a0", boost: 2.5, floor: false }));
      if (r.fuse <= 0) {
        rockets.splice(i, 1);
        glow.emit(80, (k) => {
          const d = new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(4.5, 7.5));
          return { pos: r.pos.clone(), vel: d, g: -2.2, drag: 1.1, size: rnd(0.22, 0.32), grow: -0.06, max: rnd(1.3, 2.1), color: r.colors[k % 2], boost: 2.8, floor: false };
        });
        glow.emit(24, () => ({ pos: r.pos.clone(), vel: new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(1, 3)), g: -1, drag: 1, size: 0.14, max: rnd(0.8, 1.4), color: "#ffffff", boost: 3.5, floor: false }));
      }
    }
  }
  let fwTimer = 2, finale = 0;
  // Chuva de papel picado saindo das arquibancadas
  function paperShower(n) {
    lit.emit(n, () => {
      const left = Math.random() < 0.3;
      const pos = left ? new THREE.Vector3(LX - rnd(0, 3), rnd(4, 6.5), FZ + rnd(-L_LEN / 2, L_LEN / 2)) : new THREE.Vector3(rnd(-FW / 2, FW / 2), rnd(4.5, 7), BZ - rnd(0, 3.5));
      const vel = left ? new THREE.Vector3(rnd(0.8, 2), rnd(0, 1), rnd(-0.4, 0.4)) : new THREE.Vector3(rnd(-0.4, 0.4), rnd(0, 1), rnd(0.8, 2));
      return { pos, vel, g: -1.3, drag: 0.8, size: rnd(0.14, 0.2), max: rnd(3, 4.5), spin: rnd(-10, 10), flutter: 2.5, flat: true, color: pick(["#ffffff", "#f4f2ea", "#e9e4d8", "#ffffff"]) };
    });
  }

  // ---------- Jogadores 3D detalhados (com a aparência de cada um) ----------
  const tagsEl = tagsLayer;

  // ================= Uniformes dos times reais =================
  // p = padrão: solid (lisa), stripes (listras verticais), hoops (horizontais), sash (faixa diagonal),
  // band (faixa vertical no meio), hband (faixa horizontal no meio), checks (xadrez), tricolor, spband (faixa tricolor no peito)
  // c = cor principal, a/a2 = cores do padrão, t = gola e punhos, sl = manga, s = calção, m = meião
  const KITS = [
    [["atletico mineiro", "atletico mg", "galo"], { c: "#111111", a: "#f4f4f4", p: "stripes", t: "#f4f4f4", s: "#111111", m: "#f4f4f4" }],
    [["internacional", "inter"], { c: "#d0141e", t: "#ffffff", p: "solid", s: "#ffffff", m: "#d0141e" }],
    [["mirassol"], { c: "#ffd400", t: "#0f7a3a", p: "solid", s: "#0f7a3a", m: "#ffd400" }],
    [["alaves", "deportivo alaves"], { c: "#1f4fb4", a: "#ffffff", p: "stripes", t: "#1f4fb4", s: "#1f4fb4", m: "#1f4fb4" }],
    [["holanda", "paises baixos", "netherlands"], { c: "#f36c21", t: "#111111", p: "solid", s: "#f36c21", m: "#f36c21" }],
    [["flamengo", "mengao"], { c: "#c8102e", a: "#111111", p: "hoops", t: "#111111", s: "#ffffff", m: "#111111" }],
    [["espanha", "spain"], { c: "#c60b1e", t: "#ffc400", p: "solid", s: "#0b2a6b", m: "#0b2a6b" }],
    [["bangu"], { c: "#d0141e", a: "#ffffff", p: "stripes", t: "#ffffff", s: "#ffffff", m: "#d0141e" }],
    [["real madrid"], { c: "#f6f6f6", t: "#c9a227", p: "solid", s: "#f6f6f6", m: "#f6f6f6" }],
    [["corinthians", "timao"], { c: "#f6f6f6", t: "#111111", p: "solid", s: "#111111", m: "#111111" }],
    [["psg", "paris saint germain", "paris"], { c: "#0b1f4b", a: "#d0141e", p: "band", t: "#ffffff", s: "#0b1f4b", m: "#0b1f4b" }],
    [["liverpool"], { c: "#c8102e", t: "#f6eb61", p: "solid", s: "#c8102e", m: "#c8102e" }],
    [["bayern", "bayern de munique", "bayern munich"], { c: "#dc052d", t: "#ffffff", p: "solid", s: "#dc052d", m: "#dc052d" }],
    [["vasco", "vasco da gama"], { c: "#111111", a: "#f6f6f6", p: "sash", t: "#f6f6f6", s: "#111111", m: "#111111" }],
    [["milan", "ac milan"], { c: "#c8102e", a: "#111111", p: "stripes", t: "#111111", s: "#ffffff", m: "#111111" }],
    [["al hilal"], { c: "#1446a0", t: "#ffffff", p: "solid", s: "#1446a0", m: "#1446a0" }],
    [["al nassr"], { c: "#f5e000", t: "#0a2a6b", p: "solid", s: "#0a2a6b", m: "#f5e000" }],
    [["brasil", "brazil", "selecao"], { c: "#ffdc02", t: "#0a8a3a", p: "solid", s: "#1c3faa", m: "#ffffff" }],
    [["argentina"], { c: "#75aadb", a: "#ffffff", p: "stripes", t: "#111111", s: "#111111", m: "#ffffff" }],
    [["franca", "france"], { c: "#1b2a5c", t: "#ffffff", p: "solid", s: "#ffffff", m: "#d0141e" }],
    [["alemanha", "germany"], { c: "#f6f6f6", t: "#111111", p: "solid", s: "#111111", m: "#f6f6f6" }],
    [["italia", "italy"], { c: "#1f5bd8", t: "#ffffff", p: "solid", s: "#ffffff", m: "#1f5bd8" }],
    [["inglaterra", "england"], { c: "#f6f6f6", t: "#1b2a5c", p: "solid", s: "#1b2a5c", m: "#f6f6f6" }],
    [["portugal"], { c: "#c8102e", t: "#0a7a3a", p: "solid", s: "#0a7a3a", m: "#c8102e" }],
    [["belgica", "belgium"], { c: "#c8102e", t: "#f6d300", p: "solid", s: "#c8102e", m: "#c8102e" }],
    [["uruguai", "uruguay"], { c: "#5aaee3", t: "#111111", p: "solid", s: "#111111", m: "#111111" }],
    [["croacia", "croatia"], { c: "#ffffff", a: "#d0141e", p: "checks", t: "#1b2a5c", s: "#ffffff", m: "#1b2a5c" }],
    [["colombia"], { c: "#fcd116", t: "#003893", p: "solid", s: "#003893", m: "#ce1126" }],
    [["mexico"], { c: "#006847", t: "#ffffff", p: "solid", s: "#ffffff", m: "#d0141e" }],
    [["japao", "japan"], { c: "#0b2a8c", t: "#ffffff", p: "solid", s: "#0b2a8c", m: "#0b2a8c" }],
    [["marrocos", "morocco"], { c: "#c1272d", t: "#006233", p: "solid", s: "#006233", m: "#c1272d" }],
    [["barcelona", "barca"], { c: "#a50044", a: "#004d98", p: "stripes", t: "#edbb00", s: "#004d98", m: "#a50044" }],
    [["atletico de madrid", "atletico madrid"], { c: "#cb3524", a: "#ffffff", p: "stripes", t: "#272e61", s: "#272e61", m: "#cb3524" }],
    [["juventus", "juve"], { c: "#111111", a: "#ffffff", p: "stripes", t: "#ffffff", s: "#ffffff", m: "#111111" }],
    [["inter de milao", "inter milan", "internazionale"], { c: "#0a3d91", a: "#111111", p: "stripes", t: "#111111", s: "#111111", m: "#111111" }],
    [["napoli"], { c: "#12a0d7", t: "#ffffff", p: "solid", s: "#ffffff", m: "#12a0d7" }],
    [["roma"], { c: "#8e1f2f", t: "#f0bc42", p: "solid", s: "#ffffff", m: "#8e1f2f" }],
    [["chelsea"], { c: "#034694", t: "#ffffff", p: "solid", s: "#034694", m: "#ffffff" }],
    [["manchester city", "man city"], { c: "#6cabdd", t: "#ffffff", p: "solid", s: "#ffffff", m: "#6cabdd" }],
    [["manchester united", "man united", "united"], { c: "#da291c", t: "#111111", p: "solid", s: "#ffffff", m: "#111111" }],
    [["arsenal"], { c: "#ef0107", t: "#ffffff", sl: "#ffffff", p: "solid", s: "#ffffff", m: "#ef0107" }],
    [["tottenham", "spurs"], { c: "#ffffff", t: "#132257", p: "solid", s: "#132257", m: "#ffffff" }],
    [["borussia dortmund", "dortmund", "bvb"], { c: "#fde100", t: "#111111", p: "solid", s: "#111111", m: "#fde100" }],
    [["ajax"], { c: "#ffffff", a: "#d2122e", p: "band", t: "#d2122e", s: "#ffffff", m: "#ffffff" }],
    [["benfica"], { c: "#e3001b", t: "#ffffff", p: "solid", s: "#ffffff", m: "#e3001b" }],
    [["porto", "fc porto"], { c: "#00428c", a: "#ffffff", p: "stripes", t: "#00428c", s: "#00428c", m: "#00428c" }],
    [["sporting"], { c: "#00804f", a: "#ffffff", p: "hoops", t: "#ffffff", s: "#111111", m: "#00804f" }],
    [["celtic"], { c: "#018749", a: "#ffffff", p: "hoops", t: "#ffffff", s: "#ffffff", m: "#ffffff" }],
    [["boca", "boca juniors"], { c: "#0a2a6b", a: "#ffd400", p: "hband", t: "#ffd400", s: "#0a2a6b", m: "#0a2a6b" }],
    [["river", "river plate"], { c: "#ffffff", a: "#d0141e", p: "sash", t: "#d0141e", s: "#111111", m: "#ffffff" }],
    [["fluminense", "flu"], { c: "#7a1631", a: "#0a6e3a", a2: "#ffffff", p: "tricolor", t: "#ffffff", s: "#ffffff", m: "#ffffff" }],
    [["botafogo", "fogao"], { c: "#111111", a: "#ffffff", p: "stripes", t: "#ffffff", s: "#111111", m: "#111111" }],
    [["palmeiras", "verdao"], { c: "#006437", t: "#ffffff", p: "solid", s: "#ffffff", m: "#006437" }],
    [["sao paulo", "spfc"], { c: "#ffffff", a: "#d0141e", a2: "#111111", p: "spband", t: "#d0141e", s: "#ffffff", m: "#ffffff" }],
    [["santos", "peixe"], { c: "#ffffff", t: "#111111", p: "solid", s: "#ffffff", m: "#ffffff" }],
    [["gremio"], { c: "#0d80bf", a: "#111111", a2: "#ffffff", p: "tricolor", t: "#ffffff", s: "#111111", m: "#ffffff" }],
    [["cruzeiro"], { c: "#0a3d91", t: "#ffffff", p: "solid", s: "#ffffff", m: "#0a3d91" }],
    [["athletico paranaense", "athletico pr", "furacao"], { c: "#c8102e", a: "#111111", p: "hoops", t: "#111111", s: "#111111", m: "#c8102e" }],
    [["bahia"], { c: "#ffffff", t: "#0a3d91", p: "solid", s: "#0a3d91", m: "#ffffff" }],
    [["fortaleza"], { c: "#0a3d91", a: "#d0141e", a2: "#ffffff", p: "tricolor", t: "#ffffff", s: "#0a3d91", m: "#0a3d91" }],
    [["sport", "sport recife"], { c: "#c8102e", a: "#111111", p: "hoops", t: "#ffd400", s: "#111111", m: "#111111" }],
    [["ceara"], { c: "#111111", a: "#ffffff", p: "stripes", t: "#ffffff", s: "#111111", m: "#ffffff" }],
    [["inter miami"], { c: "#f5b6cd", t: "#111111", p: "solid", s: "#f5b6cd", m: "#f5b6cd" }],
  ];
  const teamKey = (t) => (t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const KIT_BY_NAME = new Map(KITS.flatMap(([names, kit]) => names.map((n) => [teamKey(n), kit])));
  function kitFor(item, look) {
    const kit = KIT_BY_NAME.get(teamKey(item.teamName));
    if (kit) return kit;
    // time fora da lista: usa as cores da camisa do avatar
    const [shirt, trim] = SHIRT[look.shirt];
    return { c: shirt, t: trim, p: "solid", s: trim === "#ffffff" ? "#1a2670" : trim, m: "#f4f2ea" };
  }
  const shirtMats = new Map();
  function shirtMat(k) {
    const key = JSON.stringify(k);
    if (!shirtMats.has(key)) {
      const tex = pixTex(8, 8, (g) => {
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
          let col = k.c;
          if (k.p === "stripes" && x % 4 >= 2) col = k.a;
          if (k.p === "hoops" && y % 4 >= 2) col = k.a;
          if (k.p === "sash" && Math.abs(x - y) <= 1) col = k.a;
          if (k.p === "band" && (x === 3 || x === 4)) col = k.a;
          if (k.p === "hband" && (y === 3 || y === 4)) col = k.a;
          if (k.p === "checks" && ((x >> 1) + (y >> 1)) % 2) col = k.a;
          if (k.p === "tricolor") col = [k.c, k.a2, k.a][Math.floor(x / 2) % 3];
          if (k.p === "spband") col = y === 3 ? k.a : y === 4 ? "#ffffff" : y === 5 ? k.a2 : k.c;
          g.fillStyle = col; g.fillRect(x, y, 1, 1);
        }
      });
      shirtMats.set(key, new THREE.MeshStandardMaterial({ map: tex, roughness: 1, flatShading: true }));
    }
    return shirtMats.get(key);
  }

  // Troféu dourado, sem brilho próprio (só a luz da cena)
  const trophyGold = new THREE.MeshStandardMaterial({ color: "#e6b53a", metalness: 0.15, roughness: 0.45, flatShading: true });
  function buildTrophy() {
    const g = new THREE.Group();
    box(0.34, 0.14, 0.34, "#3a2614", 0, 0.07, 0, g);
    box(0.37, 0.04, 0.37, trophyGold, 0, 0.16, 0, g);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.18, 6), trophyGold); stem.position.y = 0.27; g.add(stem);
    box(0.15, 0.06, 0.15, trophyGold, 0, 0.37, 0, g);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.12, 0.38, 8), trophyGold); cup.position.y = 0.58; g.add(cup);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 8), trophyGold); rim.position.y = 0.78; g.add(rim);
    for (const sx of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.035, 4, 8), trophyGold); h.position.set(sx * 0.31, 0.6, 0); g.add(h); }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  }
  // campeão segura o troféu erguido acima da cabeça; "pump" sobe e desce
  function holdTrophy(wk, t, pump = 0) {
    if (!wk.trophy) return;
    wk.arms.forEach((a, i) => { a.sh.rotation.x = -3.02 + pump * 0.3; a.sh.rotation.z = i ? -0.16 : 0.16; a.el.rotation.x = 0; });
    wk.trophy.position.y = 1.0 - pump * 0.14;
    wk.trophy.rotation.y = Math.sin(t * 1.4) * 0.35;
  }
  function buildPlayer(item) {
    const look = item.avatar ?? autoLook(item.playerName);
    const skin = SKIN[look.skin], hair = HAIR[look.hair];
    const kit = kitFor(item, look), shirt = shirtMat(kit), sleeve = kit.sl ?? kit.c;
    const sockStripe = kit.t === kit.m ? (kit.a ?? kit.c) : kit.t;
    const p = new THREE.Group();                         // raiz nos pés
    const body = new THREE.Group(); body.position.y = 0.8; p.add(body); // pivô no quadril
    box(0.6, 0.26, 0.36, kit.s, 0, 0.02, 0, body);
    const legs = [];
    for (const x of [-0.15, 0.15]) {
      const thigh = new THREE.Group(); thigh.position.set(x, 0, 0); body.add(thigh);
      box(0.25, 0.3, 0.27, kit.s, 0, -0.1, 0, thigh);
      box(0.2, 0.12, 0.22, skin, 0, -0.3, 0, thigh);
      const knee = new THREE.Group(); knee.position.y = -0.36; thigh.add(knee);
      box(0.21, 0.24, 0.23, kit.m, 0, -0.12, 0, knee);          // meião
      box(0.22, 0.05, 0.24, sockStripe, 0, -0.03, 0, knee);     // listra do meião
      box(0.24, 0.13, 0.36, "#151518", 0, -0.37, 0.05, knee);   // chuteira
      legs.push({ thigh, knee });
    }
    const torso = new THREE.Group(); torso.position.y = 0.14; body.add(torso);
    box(0.62, 0.58, 0.36, shirt, 0, 0.29, 0, torso);             // camisa com o padrão do time
    if (kit.p === "solid") { box(0.08, 0.58, 0.37, kit.t, -0.27, 0.29, 0, torso); box(0.08, 0.58, 0.37, kit.t, 0.27, 0.29, 0, torso); }
    box(0.28, 0.07, 0.38, kit.t, 0, 0.56, 0, torso);             // gola
    const arms = [];
    for (const side of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(side * 0.41, 0.52, 0); torso.add(sh);
      box(0.19, 0.22, 0.21, sleeve, 0, -0.08, 0, sh);
      box(0.2, 0.05, 0.22, kit.t, 0, -0.19, 0, sh);
      const el = new THREE.Group(); el.position.y = -0.22; sh.add(el);
      box(0.15, 0.2, 0.17, skin, 0, -0.1, 0, el);
      box(0.16, 0.12, 0.18, skin, 0, -0.25, 0.01, el);
      arms.push({ sh, el, side });
    }
    const head = new THREE.Group(); head.position.y = 0.86; torso.add(head);
    box(0.5, 0.48, 0.46, skin, 0, 0, 0, head);
    box(0.06, 0.14, 0.12, skin, -0.27, -0.02, 0, head); box(0.06, 0.14, 0.12, skin, 0.27, -0.02, 0, head); // orelhas
    for (const ex of [-0.11, 0.11]) { box(0.1, 0.1, 0.02, "#ffffff", ex, 0.02, 0.235, head); box(0.05, 0.08, 0.02, "#151518", ex + 0.02, 0.01, 0.245, head); box(0.12, 0.03, 0.02, hair, ex, 0.11, 0.235, head); }
    box(0.14, 0.035, 0.02, "#8a3b2a", 0, -0.13, 0.235, head);
    // Cabelo: 0 curto, 1 comprido, 2 careca, 3 topete
    if (look.style !== 2) { box(0.54, 0.15, 0.5, hair, 0, 0.29, -0.01, head); box(0.54, 0.3, 0.12, hair, 0, 0.1, -0.24, head); box(0.08, 0.16, 0.42, hair, -0.26, 0.17, -0.03, head); box(0.08, 0.16, 0.42, hair, 0.26, 0.17, -0.03, head); }
    if (look.style === 1) { box(0.12, 0.5, 0.48, hair, -0.29, -0.04, -0.02, head); box(0.12, 0.5, 0.48, hair, 0.29, -0.04, -0.02, head); box(0.54, 0.62, 0.12, hair, 0, -0.06, -0.26, head); }
    if (look.style === 3) { box(0.3, 0.2, 0.3, hair, 0, 0.44, 0.06, head); box(0.2, 0.12, 0.2, hair, 0, 0.56, 0.1, head); }
    p.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    let trophy = null;
    if (item.champion) { trophy = buildTrophy(); trophy.position.set(0, 1.0, 0.02); torso.add(trophy); }
    p.scale.setScalar(1.35);
    scene.add(p);
    const tag = document.createElement("div");
    tag.className = item.champion ? "d3-tag is-champ" : "d3-tag";
    tag.textContent = (item.champion ? "🏆 " : "") + item.playerName; tagsEl.appendChild(tag);
    return { p, body, torso, head, legs, arms, tag, trophy, colors: [kit.c, kit.a ?? kit.t, "#ffd23f"], seed: Math.random() * 6 };
  }
  function pose(w, o) {
    w.legs.forEach((l, i) => { l.thigh.rotation.x = o.thigh?.[i] ?? 0; l.knee.rotation.x = o.knee?.[i] ?? 0; });
    w.arms.forEach((a, i) => { a.sh.rotation.x = o.shX?.[i] ?? 0; a.sh.rotation.z = o.shZ?.[i] ?? 0; a.el.rotation.x = o.el?.[i] ?? 0; });
    w.body.rotation.x = o.lean ?? 0; w.body.position.y = 0.8 + (o.bob ?? 0); w.body.scale.set(1, o.squash ?? 1, 1);
    w.head.rotation.set(o.headX ?? 0, o.headY ?? 0, 0); w.torso.scale.y = 1;
  }
  // corrida: coxa, joelho e cotovelo dobram, corpo inclina e sobe/desce
  function runPose(w, ph) {
    const s = Math.sin(ph), c = Math.cos(ph);
    pose(w, {
      thigh: [-s * 0.8, s * 0.8], knee: [Math.max(0, c) * 1.3, Math.max(0, -c) * 1.3],
      shX: [s * 0.9, -s * 0.9], shZ: [-0.08, 0.08], el: [-0.9, -0.9],
      lean: -0.18, bob: Math.abs(s) * 0.09, headX: 0.12,
    });
  }
  // comemoração: pula com os braços para cima balançando
  function cheerPose(w, k, t) {
    const air = Math.abs(Math.sin(k * Math.PI * 2));
    pose(w, {
      thigh: [-0.5 * air, -0.5 * air], knee: [1 * air, 1 * air],
      shX: [-2.9, -2.9], shZ: [-0.25 - Math.sin(t * 16) * 0.2, 0.25 + Math.sin(t * 16) * 0.2], el: [0, 0],
      bob: 0, headX: -0.15,
    });
    return air;
  }

  // ================= Sorteio (mesma sequência do original) =================
  let placed = 0, phase = "name", tick = 0, timers = [], walkers = [];
  const reduced = reducedMotion;

  function renderBoard() {
    const done = placed >= DRAW.length, cur = DRAW[placed];
    const pool = DRAW.slice(placed);
    const shown = phase === "name" ? (pool.length ? pool[(tick * 3 + 1) % pool.length] : null) : cur;
    const letter = phase === "name" ? "?" : phase === "group" ? LABELS[tick % LABELS.length] : cur?.groupLabel ?? "?";
    onBoard({ placed, total: DRAW.length, phase, tick, done, name: shown?.playerName ?? "", team: cur?.teamName ?? "", letter, champion: Boolean(cur?.champion) });
  }
  function clearTimers() { timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); timers = []; }
  function runPhase() {
    clearTimers(); renderBoard();
    if (placed >= DRAW.length) return finish();
    if (phase === "show") {
      enter(DRAW[placed]);
      timers.push(setTimeout(() => { placed++; phase = "name"; runPhase(); }, DRAW[placed].champion && !reduced ? SEED_SHOW_MS : SHOW_MS));
      return;
    }
    const quick = reduced || DRAW.length - placed === 1;
    const wait = phase === "name" ? (quick ? 350 : NAME_SPIN_MS) : quick ? 300 : GROUP_SPIN_MS;
    timers.push(setInterval(() => { tick++; renderBoard(); }, TICK_MS));
    timers.push(setTimeout(() => {
      if (phase === "name") phase = "group"; else phase = "show";
      runPhase();
    }, wait));
  }
  function finish() { onDone(); cheer = 1; if (!reduced) { rainLeft = 2.6; finale = 3.2; paperShower(160); } }

  // Jogador sai do caminhão: a tampa abre, ele pula na rua, entra pelo portão e corre até o lugar.
  function enter(item, instant = false) {
    const w = buildPlayer(item);
    const spot = spotOf(item);
    const zone = zones.find((z) => z.label === item.groupLabel);
    Object.assign(w, { item, anchor: 2.55 + (zone.members.indexOf(item) % 2) * 0.8 });
    if (instant || reduced) { w.p.position.copy(spot); w.p.rotation.y = FACE_CAM; walkers.push(Object.assign(w, { done: true, celebrate: 0 })); if (item.champion) addRing(w); return; }
    hatchGoal = 1;
    if (item.champion) { seedSpotOn = w; w.spotLeft = 99; cheer = 1; }
    const start = truck.localToWorld(new THREE.Vector3(2.4, 2.0, 0));
    const land = truck.localToWorld(new THREE.Vector3(5.6, 0, 0)); land.set(land.x, 0.12, ROAD_Z - 0.6);
    const path = [
      land,
      new THREE.Vector3(GATE_X, 0.12, FRONT + 3.4),
      new THREE.Vector3(GATE_X, 0.15, FRONT + 0.2),
      new THREE.Vector3(GATE_X, 0.17, FRONT - 1.4),
      spot,
    ];
    w.p.position.copy(start);
    walkers.push(Object.assign(w, { t: 0, jumpFrom: start, path, seg: 0, done: false, landed: false, ph: 0 }));
    cheer = Math.max(cheer, 0.6);
  }
  function clearWalkers() { walkers.forEach((w) => { scene.remove(w.p); w.tag.remove(); if (w.ring) scene.remove(w.ring); }); walkers = []; seedSpotOn = null; }
  // anel dourado no gramado marcando o lugar do atual campeão
  const ringGeo = new THREE.RingGeometry(0.9, 1.15, 16); ringGeo.rotateX(-Math.PI / 2);
  const ringMat = glowMat("#ffd23f", 1.6);
  function addRing(w) { w.ring = new THREE.Mesh(ringGeo, ringMat); w.ring.position.set(w.p.position.x, 0.21, w.p.position.z); scene.add(w.ring); }
  // holofote dourado que segue o atual campeão
  const seedSpot = new THREE.SpotLight("#ffc94a", 0, 0, 0.13, 0.5, 0); scene.add(seedSpot, seedSpot.target);
  let seedSpotOn = null;

  function reset() {
    clearTimers(); clearWalkers();
    placed = 0; phase = "name"; tick = 0; hatchGoal = 0; rainLeft = 0; finale = 0;
    startIntro();
  }

  // ================= Abertura: câmera acompanha o caminhão pela rua e depois revela o estádio =================
  const T_DRIVE = 4, T_HOLD = 0.5, T_CRANE = 3.2, DRIVE_DIST = 58;
  let intro = { active: false, t: 0 }, finalCam = null;
  const ease3 = (k) => 1 - Math.pow(1 - k, 3);
  const easeIO = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  function startIntro() {
    if (reduced) { endIntro(); return; }
    intro = { active: true, t: 0, fired: false };
    onIntro(true);
  }
  function applyFinalCam() {
    if (!finalCam) return;
    camera.position.copy(finalCam.pos); camera.lookAt(finalCam.target);
    camera.setViewOffset(innerWidth, innerHeight, finalCam.offX, finalCam.offY, innerWidth, innerHeight);
    camera.updateProjectionMatrix();
  }
  function endIntro() {
    intro.active = false;
    truck.position.copy(truckPark); wheels.forEach((w) => (w.rotation.z = 0));
    applyFinalCam();
    onIntro(false);
    runPhase();
  }
  function updateIntro(dt) {
    intro.t += dt;
    const t = intro.t, portrait = innerWidth < innerHeight;
    const fwdX = -Math.cos(truck.rotation.y);                 // para onde a cabine aponta
    const k = Math.min(1, t / T_DRIVE), left = DRIVE_DIST * (1 - ease3(k));
    truck.position.set(truckPark.x - fwdX * left, truckPark.y, truckPark.z);
    const speed = (3 * DRIVE_DIST * Math.pow(1 - k, 2)) / T_DRIVE;
    wheels.forEach((w) => (w.rotation.z += (speed * dt) / 0.62));
    // câmera baixa, ao lado e um pouco atrás do caminhão, com o estádio iluminado ao fundo
    const sc = portrait ? 2.6 : 1.9;
    const tp = truck.position;
    const camTrack = new THREE.Vector3(tp.x - fwdX * 6 * sc, 1.6 + 0.9 * sc, tp.z + 9 * sc);
    const lookTrack = new THREE.Vector3(tp.x + fwdX * 3, 3.2, tp.z - 6);
    if (t < T_DRIVE + T_HOLD) {
      camera.clearViewOffset(); camera.position.copy(camTrack); camera.lookAt(lookTrack); camera.updateProjectionMatrix();
      return;
    }
    // grua: sobe e se afasta até o enquadramento fixo do sorteio
    const c = easeIO(Math.min(1, (t - T_DRIVE - T_HOLD) / T_CRANE));
    if (!intro.fired) { intro.fired = true; cheer = 1; launchFirework(-14); launchFirework(15); onIntro(false, true); }
    camera.position.lerpVectors(camTrack, finalCam.pos, c).add(new THREE.Vector3(0, Math.sin(c * Math.PI) * 5, 0));
    camera.lookAt(new THREE.Vector3().lerpVectors(lookTrack, finalCam.target, c));
    camera.setViewOffset(innerWidth, innerHeight, finalCam.offX * c, finalCam.offY * c, innerWidth, innerHeight);
    camera.updateProjectionMatrix();
    if (c >= 1) endIntro();
  }
  function skip() {
    seedSpotOn = null;
    if (intro.active) { intro.active = false; truck.position.copy(truckPark); applyFinalCam(); onIntro(false); }
    clearTimers();
    for (const w of walkers) if (!w.done) { w.p.position.copy(spotOf(w.item)); w.p.rotation.y = FACE_CAM; w.done = true; w.celebrate = 0; pose(w, {}); if (w.item.champion) addRing(w); }
    for (let i = walkers.length; i < DRAW.length; i++) enter(DRAW[i], true);
    placed = DRAW.length; hatchGoal = 0; renderBoard(); finish();
  }


  // ================= Render em pixel art: contornos + paleta com pontilhado =================
  const composer = new EffectComposer(renderer);
  const pixelPass = new RenderPixelatedPass(2, scene, camera, { normalEdgeStrength: 0.45, depthEdgeStrength: 0.85 });
  composer.addPass(pixelPass);
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.25, 0.86); // brilho dos refletores, sinalizadores e fogos
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
  const paletteShader = {
    uniforms: { tDiffuse: { value: null }, pixel: { value: 2 }, levels: { value: 26 } },
    vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float pixel; uniform float levels; varying vec2 vUv;
      float b2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
      float b4(vec2 a) { return b2(0.5 * a) * 0.25 + b2(a); }
      void main() {
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        c = mix(vec3(l), c, 1.12);                                   // cor um pouco mais viva
        float d = b4(floor(gl_FragCoord.xy / pixel)) - 0.47;          // pontilhado alinhado aos pixels
        c = floor(c * levels + 0.5 + d * 0.6) / levels;              // paleta reduzida
        gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
      }`,
  };
  const palettePass = new ShaderPass(paletteShader);
  composer.addPass(palettePass);

  // Enquadramento fixo: aproxima ao máximo sem cortar o que importa, entre o placar e os botões.
  const tv = new THREE.Vector3();
  function frame() {
    const w = innerWidth, h = innerHeight, portrait = w < h;
    const pr = Math.min(devicePixelRatio || 1, 2);
    // tamanho do "pixel" do pixel art em pixels do aparelho: celular retina = 2 (1 ponto), desktop retina = 3, tela comum = 2
    const px = pr >= 2 ? (portrait ? 2 : 3) : 2;
    renderer.setPixelRatio(pr); renderer.setSize(w, h, false);
    composer.setPixelRatio(pr); composer.setSize(w, h);
    pixelPass.setPixelSize(px); palettePass.uniforms.pixel.value = px;
    placeTruck(portrait);
    placePress(portrait);
    const pts = [];
    if (portrait) {
      // celular em pé: fecha no campo, no portão e na traseira do caminhão
      const ex = Math.min(PW / 2, Math.max(...DRAW.map((d) => Math.abs(spotOf(d).x))) + 1.6);
      for (const x of [-ex, ex]) for (const z of [FZ - PD / 2, FZ + PD / 2]) pts.push([x, 0, z], [x, 2.8, z]);
      pts.push([GATE_X, 0, FRONT + 1], [0, ROOF_IN_Y, BACK - D_IN]);
      for (const lx of [-5.0, 4.5]) for (const ly of [0, 4.2]) { const v = truck.localToWorld(new THREE.Vector3(lx, ly, 1.3)); pts.push([v.x, v.y, v.z]); }
    } else {
      for (const x of [-FW / 2, FW / 2]) for (const z of [BACK, FRONT]) pts.push([x, 0, z], [x, FH, z]);
      pts.push([0, H_F, BACK - D_OUT], [-(FW / 2 + D_IN), ROOF_IN_Y, FZ + B_HALF], [FW / 2 + D_IN, ROOF_IN_Y, FZ + B_HALF]);
      pts.push([TRUCK_X + 4.5, 0, ROAD_Z + 1.3], [TRUCK_X - 5, 4.2, ROAD_Z + 1.2]);
    }
    const { top, bottom } = insets();
    const side = portrait ? 0 : 20;
    const availW = w - side * 2, availH = Math.max(100, h - top - bottom);
    const center = new THREE.Vector3();
    pts.forEach((p) => center.add(tv.set(...p))); center.divideScalar(pts.length);
    camera.aspect = w / h; camera.clearViewOffset(); camera.updateProjectionMatrix();
    const bounds = (dist) => {
      camera.position.copy(center).addScaledVector(VIEW_DIR, dist);
      camera.lookAt(center); camera.updateMatrixWorld();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of pts) { tv.set(...p).project(camera); x0 = Math.min(x0, tv.x); x1 = Math.max(x1, tv.x); y0 = Math.min(y0, tv.y); y1 = Math.max(y1, tv.y); }
      return { x0, x1, y0, y1 };
    };
    let lo = 10, hi = 500;
    for (let i = 0; i < 32; i++) {
      const mid = (lo + hi) / 2, b = bounds(mid);
      if (b.x1 - b.x0 <= (2 * availW) / w && b.y1 - b.y0 <= (2 * availH) / h) hi = mid; else lo = mid;
    }
    const b = bounds(hi);
    scene.fog.near = hi + 30; scene.fog.far = hi + 120;
    const targetY = 1 - (2 * (top + availH / 2)) / h;
    finalCam = { pos: camera.position.clone(), target: center.clone(), offX: (((b.x0 + b.x1) / 2) * w) / 2, offY: -((((b.y0 + b.y1) / 2 - targetY) * h) / 2) };
    if (intro.active) { truck.position.x = truckPark.x; } else applyFinalCam();
  }
  addEventListener("resize", frame);
  const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => frame());
  resizeObserver?.observe(container);

  // ================= Loop =================
  const clock = new THREE.Clock();
  const hv = new THREE.Vector3();
  let puffT = 0;
  function updateWalker(wk, dt, t) {
    if (wk.done) {
      wk.p.rotation.y += (FACE_CAM - wk.p.rotation.y) * Math.min(1, dt * 8);
      if (wk.spotLeft > 0 && (wk.spotLeft -= dt) <= 0 && seedSpotOn === wk) seedSpotOn = null;
      if (wk.celebrate > 0) {
        wk.celebrate -= dt;
        const air = cheerPose(wk, 1 - wk.celebrate / 1.1, t);
        holdTrophy(wk, t, Math.max(0, Math.sin(t * 10)));
        wk.p.position.y = 0.17 + air * 0.55;
        if (wk.celebrate <= 0) pose(wk, {});
        return;
      }
      // parado: respira, olha em volta e pula quando a torcida vibra
      const hop = Math.max(0, Math.sin(t * 9 + wk.seed)) * 0.16 * cheer;
      const armsUp = cheer > 0.45;
      pose(wk, {
        shX: armsUp ? [-2.8, -2.8] : [0.05, 0.05], shZ: armsUp ? [-0.3, 0.3] : [-0.06, 0.06], el: armsUp ? [0, 0] : [-0.15, -0.15],
        bob: Math.sin(t * 2.2 + wk.seed) * 0.012, headY: Math.sin(t * 0.7 + wk.seed) * 0.35, headX: Math.sin(t * 0.5 + wk.seed) * 0.05,
      });
      wk.torso.scale.y = 1 + Math.sin(t * 2.2 + wk.seed) * 0.02;
      holdTrophy(wk, t, Math.max(0, Math.sin(t * 3)) * 0.6);
      wk.p.position.y = 0.17 + hop;
      return;
    }
    const isChamp = wk.item.champion;
    if (isChamp && wk.t < 0.6) dt *= 0.38;                     // câmera lenta no pulo do atual campeão
    wk.t += dt;
    if (isChamp && wk.t > 0.3) glow.emit(1, () => ({ pos: wk.p.position.clone().add(new THREE.Vector3(rnd(-0.4, 0.4), rnd(0.3, 2.4), rnd(-0.4, 0.4))), vel: new THREE.Vector3(0, rnd(0.4, 1.2), 0), g: 0, drag: 1, size: rnd(0.08, 0.14), max: rnd(0.5, 0.9), color: pick(["#ffd23f", "#fff2b0", "#ffb020"]), boost: 2.6, floor: false }));
    if (wk.t < 0.6) {
      // pulo para fora do caminhão, encolhido e de braços para cima
      const k = wk.t / 0.6;
      wk.p.position.lerpVectors(wk.jumpFrom, wk.path[0], k);
      wk.p.position.y = wk.jumpFrom.y * (1 - k) + 0.12 * k + Math.sin(k * Math.PI) * 1.4;
      wk.p.rotation.y = truck.rotation.y + Math.PI / 2;
      pose(wk, { thigh: [-1, -0.7], knee: [1.5, 1.2], shX: [-2.7, -2.5], shZ: [-0.3, 0.3], lean: 0.1 });
      holdTrophy(wk, t);
      return;
    }
    if (!wk.landed) { wk.landed = true; wk.squash = 0.18; dust(wk.p.position); }
    const target = wk.path[Math.min(wk.seg + 1, wk.path.length - 1)];
    const pos = wk.p.position, dir = target.clone().sub(pos); dir.y = 0;
    const speed = 7, d = dir.length();
    if (d < speed * dt) {
      pos.x = target.x; pos.z = target.z; wk.seg++;
      if (wk.seg >= wk.path.length - 1) {
        wk.done = true; wk.celebrate = 1.1; cheer = Math.max(cheer, 0.9); confetti(pos, wk.colors); paperShower(40);
        if (isChamp) {
          confetti(pos, ["#ffd23f", "#fff2b0", "#ffffff"]); paperShower(80); addRing(wk); wk.spotLeft = 2.2; cheer = 1;
          launchFirework(-12, ["#ffd23f", "#fff2b0"]); launchFirework(12, ["#ffd23f", "#ffb020"]);
        } else launchFirework();
        return;
      }
    } else {
      pos.addScaledVector(dir.normalize(), speed * dt);
      let diff = Math.atan2(dir.x, dir.z) - wk.p.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      wk.p.rotation.y += diff * Math.min(1, dt * 12);
    }
    wk.ph += dt * 15;
    runPose(wk, wk.ph);
    holdTrophy(wk, t, Math.abs(Math.sin(wk.ph)) * 0.25);
    if (wk.squash > 0) { wk.squash = Math.max(0, wk.squash - dt * 1.2); wk.body.scale.y = 1 - wk.squash; }
    pos.y = target.y;
  }
  let rafId = 0, disposed = false;
  function loop() {
    if (disposed) return;
    const raw = clock.getDelta(), dt = Math.min(raw, 0.05), t = clock.elapsedTime;
    if (!lowQ && ++perfN > 30) { perfT += raw; if (perfN > 90) { if (perfT / 60 > 0.045) degrade(); perfN = 0; perfT = 0; } }
    for (const wk of walkers) updateWalker(wk, dt, t);
    if (phase !== "show" && walkers.every((w) => w.done || w.t > 0.9)) hatchGoal = 0;
    hatchOpen += (hatchGoal - hatchOpen) * Math.min(1, dt * 8);
    hatch.rotation.z = hatchOpen * 1.25;
    // caminhão ligado: treme de leve, solta fumaça e o giroflex pisca
    truckBody.position.y = Math.round(Math.sin(t * 38) * 1.5) * 0.02;
    beaconMat.emissive.set(Math.floor(t * 3) % 2 ? "#ff9a00" : "#000000");
    if ((puffT -= dt) <= 0) { puffT = 0.22; puff(truck.localToWorld(EXHAUST.clone())); }
    cornerFlags.forEach((f, i) => (f.rotation.y = Math.sin(t * 3 + i) * 0.35));
    if (rainLeft > 0) {
      rainLeft -= dt;
      emit(7, () => ({ pos: new THREE.Vector3(rnd(-PW / 2, PW / 2), rnd(10, 14), FZ + rnd(-PD / 2, PD / 2)), vel: new THREE.Vector3(rnd(-0.6, 0.6), rnd(-1.6, -0.6), rnd(-0.6, 0.6)), g: -1.1, drag: 0.9, size: rnd(0.13, 0.19), max: rnd(5, 7), spin: rnd(-8, 8), flutter: 2.5, flat: true, color: pick(RAIN_COLORS) }));
    }
    updateFans(t);
    updatePress(t, dt);
    updateFlares(dt, t);
    flags.forEach((f) => { f.pivot.rotation.y = f.base + Math.sin(t * 4 + f.ph) * 0.7; f.pivot.rotation.z = Math.sin(t * 2.3 + f.ph) * 0.25; });
    updateBigFlag(t);
    updateCloths(t);
    if (!reduced) {
      if ((fwTimer -= dt) <= 0) { fwTimer = rnd(2.2, 4); launchFirework(); }
      if (finale > 0) { finale -= dt; if (Math.random() < dt * 4) launchFirework(); }
    }
    if (intro.active) updateIntro(dt);
    truckLight.position.set(truck.position.x, 4.5, truck.position.z + 4.5);
    updateRockets(dt);
    updateParts(dt);
    cheer = Math.max(0, cheer - dt * 0.35);
    updateCrowd(t);
    if (seedSpotOn) {
      const q = seedSpotOn.p.position;
      seedSpot.position.set(q.x + 3, 16, q.z + 4); seedSpot.target.position.set(q.x, 0, q.z);
      seedSpot.intensity += (1.8 - seedSpot.intensity) * Math.min(1, dt * 6);
    } else seedSpot.intensity += (0 - seedSpot.intensity) * Math.min(1, dt * 4);
    ringMat.color.setRGB(1.6, 1.3, 0.4).multiplyScalar(0.8 + Math.sin(t * 4) * 0.2);
    composer.render();
    // etiquetas com o nome acompanham a cabeça de cada jogador
    const w = innerWidth, h = innerHeight;
    for (const wk of walkers) {
      hv.set(0, wk.done ? wk.anchor : 2.55, 0); wk.p.localToWorld(hv); hv.project(camera);
      wk.tag.style.transform = `translate(${Math.round(((hv.x + 1) / 2) * w)}px, ${Math.round(((1 - hv.y) / 2) * h)}px) translate(-50%, -100%)`;
    }
    rafId = requestAnimationFrame(loop);
  }

  frame(); reset(); rafId = requestAnimationFrame(loop);

  function dispose() {
    disposed = true;
    cancelAnimationFrame(rafId);
    clearTimers();
    removeEventListener("resize", frame);
    resizeObserver?.disconnect();
    walkers.forEach((w) => w.tag.remove());
    scene.traverse((o) => {
      o.geometry?.dispose();
      for (const m of [].concat(o.material ?? [])) { m.map?.dispose(); m.dispose(); }
    });
    scene.background?.dispose?.();
    composer.dispose?.();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  }

  return { skip, replay: reset, dispose };
}
