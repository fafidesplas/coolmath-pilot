// The object view (GDD 3.1, 3.5, 12): Three.js, orthographic camera, one merged
// mesh per sculpture (internal faces removed), thin rings for the allowed dials,
// the camera swing of the reveal. If WebGL is missing, a Canvas 2D painter's
// renderer draws the same faces sorted by depth (GDD 12 fallback).
// The rotation comes from pose.js, the same matrix the shadow uses.
import * as THREE from '../lib/three.module.min.js';
import { OBJ_ZONE, OBJ_CENTER, OBJ_RADIUS, RING_SCALE, CAM, PICTURE_COLORS, RING_COLORS } from './config.js';
import { SHAPES, edgeSide, sideFull } from './shadow.js';
import { matrix, poseMatrix, DEG } from './pose.js';

const OPP = { l: ['r', -1, 0], r: ['l', 1, 0], b: ['t', 0, -1], t: ['b', 0, 1] };
const QUAD_UV = [[0, 0], [1, 0], [1, 1], [0, 1]];

// Visible faces of a block sculpture relative to the pivot: [{ pts, n, color, uv }].
export function buildFaces(blocks, pivot) {
  const at = new Map(blocks.map(b => [`${b[0]},${b[1]},${b[2]}`, b]));
  const faces = [];
  for (const b of blocks) {
    const poly = SHAPES[b[4]];
    const P = poly.map(c => [b[0] + c[0] - pivot[0], b[1] + c[1] - pivot[1]]);
    const z0 = b[2] - pivot[2], z1 = z0 + 1, color = b[3];
    if (!at.has(`${b[0]},${b[1]},${b[2] + 1}`)) faces.push({ pts: P.map(p => [p[0], p[1], z1]), n: [0, 0, 1], color, uv: poly, front: true });
    if (!at.has(`${b[0]},${b[1]},${b[2] - 1}`)) faces.push({ pts: P.slice().reverse().map(p => [p[0], p[1], z0]), n: [0, 0, -1], color, uv: poly.slice().reverse() });
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], c = poly[(i + 1) % poly.length];
      const side = edgeSide(a, c);
      if (side) {
        const [o, dx, dy] = OPP[side];
        const nb = at.get(`${b[0] + dx},${b[1] + dy},${b[2]}`);
        if (nb && sideFull(nb[4], o)) continue;
      }
      const A = P[i], C = P[(i + 1) % poly.length];
      const ex = C[0] - A[0], ey = C[1] - A[1], l = Math.hypot(ex, ey);
      faces.push({ pts: [[A[0], A[1], z0], [C[0], C[1], z0], [C[0], C[1], z1], [A[0], A[1], z1]], n: [ey / l, -ex / l, 0], color, uv: QUAD_UV });
    }
  }
  return faces;
}

// Camera direction (towards the camera) for a swing amount k (0 = angled, 1 = straight down the light axis).
export function cameraDir(k) {
  const yaw = CAM.yaw * (1 - k) * DEG, pitch = CAM.pitch * (1 - k) * DEG;
  return [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
}

function cameraBasis(dir) {
  const f = [-dir[0], -dir[1], -dir[2]];
  let r = [-f[2], 0, f[0]];                       // f × (0, 1, 0)
  const rl = Math.hypot(r[0], r[2]) || 1;
  r = [r[0] / rl, 0, r[2] / rl];
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  return { r, u, d: dir };
}

function edgeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#5A5F80'; g.fillRect(0, 0, 64, 64);                 // dark seam
  g.fillStyle = '#FFFFFF'; g.fillRect(3, 3, 58, 58);                 // bright edge
  const grd = g.createRadialGradient(32, 32, 6, 32, 32, 34);
  grd.addColorStop(0, '#E6E6EE'); grd.addColorStop(1, '#C9CAD8');     // soft inner glow
  g.fillStyle = grd; g.fillRect(9, 9, 46, 46);
  return c;
}

export class Scene3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.k = 0;                 // camera swing
    this.pose = [0, 0, 0];
    this.rings = { turn: { on: false, a: 0 }, tip: { on: false, a: 0 }, spin: { on: false, a: 0 } };
    this.maxDpr = 2;
    this.lv = null;
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
      this.renderer.setClearColor(0x000000, 0);
    } catch (e) {
      this.renderer = null;
      this.ctx = canvas.getContext('2d');
      console.warn('WebGL unavailable, using the Canvas 2D block renderer', e && e.message);
    }
    this.mode = this.renderer ? 'webgl' : '2d';
    if (this.renderer) this.initThree();
  }

  initThree() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.3));
    const lamp = new THREE.DirectionalLight(0xfff1d6, 2.2);   // the warm lamp, from the front lower left
    lamp.position.set(-0.45, 0.35, 1);
    this.scene.add(lamp);
    const rim = new THREE.DirectionalLight(0x8fa0ff, 0.6);
    rim.position.set(0.6, 0.8, -0.4);
    this.scene.add(rim);
    const tex = new THREE.CanvasTexture(edgeTexture());
    tex.colorSpace = THREE.SRGBColorSpace;
    this.material = new THREE.MeshLambertMaterial({ vertexColors: true, map: tex, emissive: 0x161236 });
    this.ringMeshes = {};
    for (const name of ['turn', 'tip', 'spin']) {
      const mat = new THREE.MeshBasicMaterial({ color: RING_COLORS[name], transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending });
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 6, 128), mat);
      mesh.matrixAutoUpdate = false;
      mesh.visible = false;
      this.scene.add(mesh);
      this.ringMeshes[name] = mesh;
    }
  }

  setLevel(lv) {
    if (this.lv === lv) return;
    this.lv = lv;
    this.R = lv.frame.R;
    this.scale = OBJ_RADIUS / this.R;     // px per cell
    this.faces = buildFaces(lv.blocks, lv.frame.pivot);
    if (!this.renderer) return;
    if (this.mesh) { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); }
    const pos = [], nor = [], col = [], uv = [];
    const colors = PICTURE_COLORS.map(h => new THREE.Color(h));
    for (const f of this.faces) {
      const c = colors[f.color];
      for (let i = 1; i < f.pts.length - 1; i++) {
        for (const k of [0, i, i + 1]) {
          pos.push(...f.pts[k]); nor.push(...f.n); col.push(c.r, c.g, c.b); uv.push(...f.uv[k]);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.matrixAutoUpdate = false;
    this.scene.add(this.mesh);
    const rr = this.R * RING_SCALE;
    for (const name in this.ringMeshes) {
      const m = this.ringMeshes[name];
      m.geometry.dispose();
      m.geometry = new THREE.TorusGeometry(rr, this.R * 0.012, 6, 128);
    }
    this.updateCamera();
  }

  updateCamera() {
    const dir = cameraDir(this.k);
    this.basis = cameraBasis(dir);
    if (!this.renderer || !this.lv) return;
    const s = this.scale, z = OBJ_ZONE, c = OBJ_CENTER, cam = this.camera;
    cam.left = (z.x - c.x) / s; cam.right = (z.x + z.w - c.x) / s;
    cam.top = (c.y - z.y) / s; cam.bottom = -(z.y + z.h - c.y) / s;
    cam.near = 0.1; cam.far = this.R * 40;
    cam.position.set(dir[0] * this.R * 10, dir[1] * this.R * 10, dir[2] * this.R * 10);
    cam.up.set(0, 1, 0);
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
  }

  setView(k) {
    if (k === this.k && this.basis) return;
    this.k = k;
    this.updateCamera();
  }

  // pose: the display pose (may include the wobble); rings: { turn: alpha, … } (0 hides).
  setPose(pose) {
    this.pose = pose;
    if (!this.renderer || !this.mesh) return;
    const m = poseMatrix(pose);
    this.mesh.matrix.set(m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, 0, 0, 0, 1);
    this.mesh.matrixWorldNeedsUpdate = true;
  }

  // Ring transforms (GDD 3.5): Turn tilts with Tip, all rotate with Spin.
  ringMatrix(name, pose) {
    if (name === 'turn') return matrix(0, pose[1] + 90, pose[2]);
    if (name === 'tip') return matrix(90, 0, pose[2]);
    return matrix(0, 0, pose[2]);
  }

  setRing(name, alpha) {
    this.rings[name].a = alpha;
    if (!this.renderer) return;
    const mesh = this.ringMeshes[name];
    mesh.visible = alpha > 0.001;
    mesh.material.opacity = alpha;
    const m = this.ringMatrix(name, this.pose);
    mesh.matrix.set(m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, 0, 0, 0, 1);
    mesh.matrixWorldNeedsUpdate = true;
  }

  // Object-space point (relative to the pivot, already rotated) → view px.
  project(p) {
    const { r, u, d } = this.basis;
    return {
      x: OBJ_CENTER.x + (p[0] * r[0] + p[1] * r[1] + p[2] * r[2]) * this.scale,
      y: OBJ_CENTER.y - (p[0] * u[0] + p[1] * u[1] + p[2] * u[2]) * this.scale,
      depth: p[0] * d[0] + p[1] * d[1] + p[2] * d[2],
    };
  }

  // A point on a ring at angle a (radians) in view px. Turn and Tip rings: 0 is
  // the front, positive goes right (Turn) or down (Tip); Spin ring: 0 is the top.
  ringPoint(name, a) {
    const rr = this.R * RING_SCALE, p = this.pose;
    let v, m;
    if (name === 'turn') { v = [Math.sin(a) * rr, 0, Math.cos(a) * rr]; m = matrix(0, p[1], p[2]); }
    else if (name === 'tip') { v = [0, -Math.sin(a) * rr, Math.cos(a) * rr]; m = matrix(0, 0, p[2]); }
    else { v = [Math.sin(a) * rr, Math.cos(a) * rr, 0]; m = matrix(0, 0, p[2]); }
    return this.project([m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]);
  }

  resize(scale, dpr, ox, oy) {
    const z = OBJ_ZONE;
    const w = z.w * scale, h = z.h * scale;
    Object.assign(this.canvas.style, { left: `${ox + z.x * scale}px`, top: `${oy + z.y * scale}px`, width: `${w}px`, height: `${h}px` });
    this.cssW = w; this.cssH = h; this.last = [scale, dpr, ox, oy];
    const pr = Math.min(dpr, this.maxDpr);
    if (this.renderer) {
      this.renderer.setPixelRatio(pr);
      this.renderer.setSize(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), false);
    } else {
      this.canvas.width = Math.max(1, Math.round(w * pr));
      this.canvas.height = Math.max(1, Math.round(h * pr));
      this.px = pr * scale;
    }
  }

  setMaxDpr(v) { this.maxDpr = v; if (this.last) this.resize(...this.last); }

  setVisible(on) {
    if (this.visible === on) return;
    this.visible = on;
    this.canvas.style.visibility = on ? 'visible' : 'hidden';
  }

  render() {
    if (!this.lv) return;
    if (this.renderer) { this.renderer.render(this.scene, this.camera); return; }
    this.paint();
  }

  // ---- Canvas 2D fallback: painter's algorithm over the same faces ----------------

  paint() {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.px, 0, 0, this.px, -OBJ_ZONE.x * this.px, -OBJ_ZONE.y * this.px);
    const m = poseMatrix(this.pose), d = this.basis.d;
    const L = [-0.38, 0.3, 0.87];
    const list = [];
    for (const f of this.faces) {
      const n = [m[0] * f.n[0] + m[1] * f.n[1] + m[2] * f.n[2], m[3] * f.n[0] + m[4] * f.n[1] + m[5] * f.n[2], m[6] * f.n[0] + m[7] * f.n[1] + m[8] * f.n[2]];
      if (n[0] * d[0] + n[1] * d[1] + n[2] * d[2] <= 1e-6) continue;
      const pts = f.pts.map(p => this.project([m[0] * p[0] + m[1] * p[1] + m[2] * p[2], m[3] * p[0] + m[4] * p[1] + m[5] * p[2], m[6] * p[0] + m[7] * p[1] + m[8] * p[2]]));
      const depth = pts.reduce((s, p) => s + p.depth, 0) / pts.length;
      const lit = 0.55 + 0.55 * Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
      list.push({ pts, depth, lit, color: f.color });
    }
    list.sort((a, b) => a.depth - b.depth);
    ctx.lineJoin = 'round';
    for (const f of list) {
      ctx.beginPath();
      f.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.fillStyle = shade(PICTURE_COLORS[f.color], f.lit);
      ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(8,11,28,0.35)'; ctx.stroke();
    }
    for (const name of ['turn', 'tip', 'spin']) {
      const a = this.rings[name].a;
      if (a <= 0.001) continue;
      ctx.globalAlpha = a; ctx.strokeStyle = RING_COLORS[name]; ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i <= 64; i++) { const p = this.ringPoint(name, i / 64 * Math.PI * 2); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

function shade(hex, k) {
  const v = parseInt(hex.slice(1), 16);
  const c = s => Math.max(0, Math.min(255, Math.round(((v >> s) & 255) * k)));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}
