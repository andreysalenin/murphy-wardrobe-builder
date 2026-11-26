// Render a furniture module (see FORMAT.md) from five angles with three.js r128 in headless Chromium.
// node study/furniture/preview.js <module.js> <outPrefix> '<opt json>'
const fs = require('fs'), path = require('path');
const { chromium } = require(path.resolve(__dirname, '../../node_modules/playwright-core'));
const [modPath, outPrefix, optJson] = process.argv.slice(2);
const build = require(path.resolve(modPath));
const item = build(optJson ? JSON.parse(optJson) : {});
console.log(JSON.stringify(item.dims, null, 1));
const three = fs.readFileSync(path.resolve(__dirname, '../../node_modules/three/build/three.min.js'), 'utf8');
const html = `<!doctype html><html><body style="margin:0;background:#e9e6e0"><script>${three}</script><script>
const item = ${JSON.stringify(item)};
const W = 900, H = 700, r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setSize(W, H); r.outputEncoding = THREE.sRGBEncoding;
document.body.appendChild(r.domElement);
const sc = new THREE.Scene(); sc.background = new THREE.Color(0xe9e6e0);
sc.add(new THREE.HemisphereLight(0xffffff, 0x8a8680, 0.75)); const k = new THREE.DirectionalLight(0xffffff, 0.7); sc.add(k);
const f = new THREE.DirectionalLight(0xffffff, 0.25); f.position.set(-2000, -1500, 800); sc.add(f);
const col = (p) => new THREE.Color(p.color || (item.materials || {})[p.mat] || '#999999').convertSRGBToLinear();
const g = new THREE.Group(); sc.add(g);
for (const p of item.parts) {
  let geo;
  if (p.shape === 'box') { const s = [0, 1, 2].map(i => p.max[i] - p.min[i]); geo = new THREE.BoxGeometry(...s); geo.translate(...[0, 1, 2].map(i => (p.max[i] + p.min[i]) / 2)); }
  else if (p.shape === 'cyl') { const a = new THREE.Vector3(...p.a), b = new THREE.Vector3(...p.b), d = b.clone().sub(a); geo = new THREE.CylinderGeometry(p.d / 2, p.d / 2, d.length(), 24);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()); geo.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q)); const m = a.clone().add(b).multiplyScalar(0.5); geo.translate(m.x, m.y, m.z); }
  else { const sh = new THREE.Shape(p.pts.map(q => new THREE.Vector2(q[0], q[1]))); geo = new THREE.ExtrudeGeometry(sh, { depth: p.to - p.from, bevelEnabled: false }); geo.translate(0, 0, p.from);
    if (p.axis === 'x') geo.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1));   // (y,z,x) <- (u,v,w)
    if (p.axis === 'y') geo.applyMatrix4(new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1)); } // (x,z,y) <- (u,v,w)
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col(p), roughness: 0.6, metalness: 0.05, side: THREE.DoubleSide })); g.add(mesh);
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), new THREE.LineBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.35 })));
}
const bb = new THREE.Box3().setFromObject(g), c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3()), R = sz.length();
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 100000); cam.up.set(0, 0, 1);
window.shot = (dir) => { const d = new THREE.Vector3(...dir).normalize(); cam.position.copy(c).addScaledVector(d, R * 3); cam.lookAt(c);
  const h = R * 0.62, w = h * W / H; Object.assign(cam, { left: -w, right: w, top: h, bottom: -h }); cam.updateProjectionMatrix();
  k.position.copy(cam.position).add(new THREE.Vector3(300, 200, 1500)); r.render(sc, cam); return r.domElement.toDataURL('image/png'); };
</script></body></html>`;
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const pg = await b.newPage({ viewport: { width: 900, height: 700 } });
  pg.on('pageerror', e => console.error('page error:', e.message)); pg.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
  await pg.setContent(html);
  // the front is +y: views from the front-left-above, the front, the left side (+x end), above, and below
  const views = { iso: [0.55, 1, 0.55], front: [0, 1, 0.0001], side: [1, 0.0001, 0.0001], top: [0.0001, 0.0001, 1], below: [0.5, 0.9, -0.6] };
  for (const [n, d] of Object.entries(views)) { const url = await pg.evaluate((dd) => window.shot(dd), d); fs.writeFileSync(`${outPrefix}-${n}.png`, Buffer.from(url.split(',')[1], 'base64')); }
  await b.close();
})();
