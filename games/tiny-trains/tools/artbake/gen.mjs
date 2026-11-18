// Emits bake jobs for one kit. node gen.mjs <kit> > jobs.json
const kit = process.argv[2];
const J = {}, PI = Math.PI;
const CELL = 160, OB = 0.5;
if (kit === 'voxel') {
  const T = 'dl_vox/ter/gltf/', V = 'dl_vox/veh/gltf/', U = 4.4, h = U / 2, R = [-h, -h, h, h];
  const st = sp => ({ items: [{ url: T + 'Tracks/track-straight.gltf', pos: [-1.6, 0, 0.6] }, { url: T + 'Tracks/track-straight.gltf', pos: [1.6, 0, 0.6] }], rect: R, px: [CELL, CELL], oblique: OB, spin: sp });
  J.track_h = st(0); J.track_v = st(PI / 2);
  for (let r = 0; r < 4; r++) J['curve' + r] = { items: [{ url: T + 'Tracks/track-curve.gltf', pos: [0.6, 0, 0.6] }], rect: R, px: [CELL, CELL], oblique: OB, spin: (1 - r) * PI / 2 };
  for (let i = 1; i <= 4; i++) J['ground' + i] = { items: [{ url: T + `Forest/forest-${i}.gltf` }], rect: [-1.6, -1.6, 1.6, 1.6], px: [128, 128] };
  const prop = (n, f) => ({ items: [{ url: T + f }], rect: [-0.35, -0.75, 0.35, 0.25], px: [96, 136], oblique: OB });
  for (let i = 1; i <= 4; i++) J['tree' + i] = prop('t', `Trees/tree-${i}.gltf`);
  for (let i = 1; i <= 3; i++) J['bush' + i] = prop('b', `Bushes/bush-${i}.gltf`);
  for (let i = 1; i <= 3; i++) J['stone' + i] = prop('s', `Stones/stone-${i}.gltf`);
  J.buffer = { items: [{ url: T + 'TrackEquip/track-equip-dead-end.gltf' }], rect: [-0.6, -0.8, 0.6, 0.4], px: [96, 96], oblique: OB };
  const cols = { red: 'red', blue: 'blue', yellow: 'yellow', green: 'green' };
  for (const [k, c] of Object.entries(cols)) for (let i = 0; i < 16; i++) J[`train_${k}_${i}`] = { items: [{ url: V + `Trains/train-v1-${c}.gltf`, rotY: PI - i * PI / 8 }], rect: R, px: [CELL, CELL], oblique: OB };
}
if (kit === 'probe-kenney') {
  const K = 'dl_kenney/train-kit/Models/GLB format/';
  for (const m of ['train-locomotive-a', 'train-locomotive-b', 'train-locomotive-c', 'train-diesel-a', 'train-diesel-b', 'train-diesel-c', 'train-electric-city-a', 'train-electric-square-a'])
    J[m] = { items: [{ url: K + m + '.glb', rotY: PI / 2 - 0.5 }], rect: [-2, -2, 2, 2], px: [160, 160], oblique: OB };
}
console.log(JSON.stringify(J));
