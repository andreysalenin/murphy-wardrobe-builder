/* Page wiring: settings <-> model <-> viewer, summary, cut sheets, downloads, theme. */
(function () {
'use strict';
const C = window.MurphyCore, V = window.MurphyViewer;
const LS_KEY = 'murphy-wardrobe-builder.v3', LS_VIEW = 'murphy-wardrobe-builder.view.v1', LS_THEME = 'murphy-wardrobe-builder.theme';
const $ = (id) => document.getElementById(id);
const NUM_FIELDS = ['W', 'H', 'D', 'sideClear', 'backGap', 'frontSetback', 'mW', 'mL', 'mT', 'gapMx', 'gapMy', 'gapHydr', 'gapHolder', 'gapBelow', 'faceBelowFrame', 'faceOverhang',
  'hangClear', 'railDrop', 'runnerClear', 'runnerLen', 'boxLess', 'gap', 'gapAbove', 'frontGap', 'TfDrawer', 'TfSide', 'TfTop', 'headWell', 'T', 'Tb', 'Tback', 'Tsup', 'Tladder', 'Tplinth', 'Tpacker', 'Tledge', 'Thead',
  'pivotFromRail', 'pivotAboveHead', 'cabPivotZ', 'pinGap', 'springLowAlong', 'springLowOut', 'springUpFront', 'springUpZ', 'stopFront', 'stopBelowTop',
  'springD', 'springRodD', 'springEndD', 'springBodyL', 'studS', 'plateT', 'nutStack', 'stopD', 'stopH', 'legD',
  'railD', 'headRailD', 'footRailD', 'railR', 'legFromFoot', 'legFromTop', 'struts', 'ladderW',
  'ledgeClear', 'headAngle', 'headH', 'headGap', 'headLip', 'headClear', 'headDoorOpen', 'headGPO', 'headZone', 'upstand', 'steelH', 'steelT', 'twinSpacing', 'lockPinX', 'wallRail', 'kerf', 'trim'];
const SEL_FIELDS = ['kickCentre', 'doorHinge', 'lockType', 'headHinge'];
const CHK_FIELDS = ['topShelf', 'cableHoles', 'headStore', 'supportOffset', 'faceReveal', 'packer', 'ledge', 'headboard', 'edgeSteel', 'lockTab', 'grain'];

const readLS = (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } };
const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage off: settings just aren't remembered */ } };
const defaults = () => JSON.parse(JSON.stringify(C.DEFAULTS));
let params = Object.assign(defaults(), readLS(LS_KEY) || {});
// the bed-cabinet sides moved in to the kit's 11 mm gap, with no packers: saved settings still on the old 30 mm
// default with packers follow, once; a gap someone chose themselves stays
if (!readLS(LS_KEY + ':gap11')) {
  if (params.gapHydr === 30 && params.packer === true && params.Tpacker === 18) { params.gapHydr = 11; params.packer = false; }
  writeLS(LS_KEY + ':gap11', 1);
}
// the bed face now overhangs its rails 5 mm so the reveal beside it matches the other fronts: saved settings on the
// old flush face with the kit's gap follow, once
if (!readLS(LS_KEY + ':reveal6')) {
  if (params.faceOverhang === 0 && params.gapHydr === 11) params.faceOverhang = 5;
  writeLS(LS_KEY + ':reveal6', 1);
}
// the power points now run back in the services zones: saved settings on the old 70 mm clear depth follow, once
if (!readLS(LS_KEY + ':clear110')) {
  if (params.headClear === 70) params.headClear = 110;
  writeLS(LS_KEY + ':clear110', 1);
}
// the backrest now leans 10 (room for the power points) and its doors open all the way: saved old defaults follow, once
if (!readLS(LS_KEY + ':lean10')) {
  if (params.headAngle === 5) params.headAngle = 10;
  if (params.headDoorOpen === 30) params.headDoorOpen = 110;
  writeLS(LS_KEY + ':lean10', 1);
}
// fronts now default to 18 mm everywhere (12 stays a choice per kind): saved settings still on the brief all-12 default follow, once
if (!readLS(LS_KEY + ':fronts18')) {
  if ([params.TfDrawer, params.TfSide, params.TfTop].every(v => Number(v) === 12)) { params.TfDrawer = 18; params.TfSide = 18; params.TfTop = 18; }
  writeLS(LS_KEY + ':fronts18', 1);
}
// the power points now lie along the shelf (switches to the wall): their bodies want a 125 services zone, once
if (!readLS(LS_KEY + ':zone125')) {
  if (Number(params.headZone) === 100) params.headZone = 125;
  writeLS(LS_KEY + ':zone125', 1);
}
// the headboard compartments now sink 120 into the ledge by default (your pillows stand up): saved settings on 0 follow, once
if (!readLS(LS_KEY + ':well120')) {
  if (!Number(params.headWell)) params.headWell = 120;
  writeLS(LS_KEY + ':well120', 1);
}
// the carcass now stands 6 off the back wall (packers of 6 and 12 behind the rails): saved settings on the old 10 follow, once
if (!readLS(LS_KEY + ':back6')) {
  if (params.backGap === 10) params.backGap = 6;
  writeLS(LS_KEY + ':back6', 1);
}
// the bed stops now default to where the closed bed stands plumb (0): saved settings still on the kit's 7-3/8 in
// follow, once
if (!readLS(LS_KEY + ':stopPlumb')) {
  if (Math.abs((params.stopFront || 0) - 187.3) < 0.05) params.stopFront = 0;
  writeLS(LS_KEY + ':stopPlumb', 1);
}
params = C.normParams(params);
let model = null, summary = null, viewer = null, timer = null;
let viewOpts = Object.assign({ fronts: true, mattress: true, bedding: false, hw: true, section: false, bySheet: false }, readLS(LS_VIEW) || {});
const f0 = (v) => Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1);

/* ---------------------------------------------------------------- theme */
function applyTheme(t) {
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  else document.documentElement.removeAttribute('data-theme');
  document.querySelectorAll('[data-theme-set]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.themeSet === (t || 'auto'))));
}
applyTheme(readLS(LS_THEME) || 'auto');

/* ---------------------------------------------------------------- inputs */
function fillInputs() {
  for (const k of NUM_FIELDS) if ($(k)) $(k).value = params[k];
  for (const k of SEL_FIELDS) if ($(k)) $(k).value = params[k];
  for (const k of CHK_FIELDS) if ($(k)) $(k).checked = !!params[k];
  drawerInputs();
  libRows();
  whenFields();
}
// fields that only matter with another option on: data-when="ledge headboard !headStore" or "lockType=twin"
function whenFields() {
  const ok = (t) => { const neg = t[0] === '!', k = neg ? t.slice(1) : t, [id, v] = k.split('='), el = $(id); if (!el) return true;
    const on = v !== undefined ? el.value === v : el.type === 'checkbox' ? el.checked : !!el.value; return neg ? !on : on; };
  document.querySelectorAll('.rail [data-when]').forEach(el => el.classList.toggle('off', !el.dataset.when.split(/\s+/).every(ok)));
}
const LS_TAB = 'murphy-wardrobe-builder.tab';
function showTab(t) {
  const tabs = [...document.querySelectorAll('.tabs [data-tab]')];
  if (!tabs.some(b => b.dataset.tab === t)) t = 'design';
  tabs.forEach(b => { b.setAttribute('aria-selected', String(b.dataset.tab === t)); b.tabIndex = b.dataset.tab === t ? 0 : -1; });
  document.querySelectorAll('.rail details.grp').forEach(d => { if (t === 'all' || d.dataset.tab === t) d.removeAttribute('data-tab-hidden'); else d.setAttribute('data-tab-hidden', ''); });
  writeLS(LS_TAB, t);
}
function readInputs() {
  for (const k of NUM_FIELDS) { const el = $(k); if (el && el.value !== '' && isFinite(Number(el.value))) params[k] = Number(el.value); }
  for (const k of SEL_FIELDS) if ($(k)) params[k] = $(k).value;
  for (const k of CHK_FIELDS) if ($(k)) params[k] = $(k).checked;
  params.drawers = [...document.querySelectorAll('#drawers input')].map(i => Number(i.value) || 180);
  params.sheets = [...document.querySelectorAll('#lib tr')].map(tr => ({ T: Number(tr.querySelector('[data-k=T]').value), L: Number(tr.querySelector('[data-k=L]').value), W: Number(tr.querySelector('[data-k=W]').value), n: Number(tr.querySelector('[data-k=n]').value) }));
}
function drawerInputs() {
  const box = $('drawers');
  box.innerHTML = '';
  params.drawers.forEach((h, i) => {
    const d = document.createElement('div');
    d.innerHTML = `<div class="dn">${i === 0 ? 'bottom' : i === params.drawers.length - 1 ? 'top' : 'no. ' + (i + 1)}</div><div class="num"><input type="number" id="dr-${i}" min="80" max="600" step="1" inputmode="numeric" aria-label="Drawer ${i + 1} front height" value="${h}"><span>mm</span></div>`;
    box.appendChild(d);
  });
  $('dr-out').textContent = params.drawers.length;
}
function libRows() {
  const tb = $('lib');
  tb.innerHTML = '';
  params.sheets.forEach((s, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><div class="num"><input id="lib-T-${i}" data-k="T" type="number" min="1" max="40" step="1" value="${s.T}" aria-label="Sheet thickness"></div></td>` +
      `<td><div class="num"><input id="lib-L-${i}" data-k="L" type="number" min="300" max="4000" step="10" value="${s.L}" aria-label="Sheet length"></div></td>` +
      `<td><div class="num"><input id="lib-W-${i}" data-k="W" type="number" min="200" max="2000" step="10" value="${s.W}" aria-label="Sheet width"></div></td>` +
      `<td><div class="num n"><input id="lib-n-${i}" data-k="n" type="number" min="0" max="99" step="1" value="${s.n}" aria-label="Sheets on hand"></div></td>` +
      `<td><button type="button" data-del="${i}" aria-label="Remove this sheet size">&times;</button></td>`;
    tb.appendChild(tr);
  });
}
function save() { writeLS(LS_KEY, params); }
function schedule(sync) { clearTimeout(timer); timer = setTimeout(() => rebuild(true, sync), 140); }
function rebuild(keepView, sync) {
  readInputs();
  params = C.normParams(params);
  if (sync) fillInputs();
  save();
  try {
    model = C.build(params);
    summary = C.summary(model);
  } catch (e) { console.error(e); status('That combination of sizes does not build: ' + e.message); return; }
  if (viewer) { viewer.setModel(model, keepView); viewer.set(viewState()); }
  renderSummary();
  renderSheets();
  renderReview();
  renderClearances();
  $('hdr-size').textContent = `${f0(params.W)} x ${f0(params.H)} x ${f0(params.D)}`;
}

/* ---------------------------------------------------------------- summary */
function renderSummary() {
  const { P, G } = model, S = summary;
  const st = S.sheets;
  const figs = [
    ['Bed bay, clear', `${f0(G.bayIn)} <small>wide</small>`],
    ['Tower inside', `${f0(G.towerIn)} x ${G.cDd === G.cDs ? f0(G.cDd) : f0(G.cDd) + ' / ' + f0(G.cDs)} <small>deep${G.cDd === G.cDs ? '' : ' (drawers / doors)'}</small>`],
    ['Drawer fronts', `${f0(G.doorW)} x ${P.drawers.map(f0).join(', ')}`],
    ['Hanging / top', `${f0(G.hangClear)} / ${f0(G.topClear)} <small>clear</small>`],
    ['Above the bed', `${f0(G.antClear)} <small>clear behind the flaps</small>`],
    ['Pivot', `${Math.round(G.pivot[1])} up, ${Math.round(P.D - G.pivot[0])} in <small>from the front</small>`],
    ['Bed open', `reaches ${Math.round(G.clear.open.reach)} <small>from the wall</small>`],
    ['Mattress top, open', `${f0(G.clear.open.mattTop)} <small>above the floor</small>`],
    ['Lowest swing point', `${Math.round(G.clear.minZ)} <small>above the floor</small>`],
    ['Ply', `${S.massPly.toFixed(0)} kg <small>bed frame ${S.massBed.toFixed(0)}</small>`],
    ...st.filter(s => s.used || s.have).map(s => [`${s.T} mm sheets`, `${isFinite(s.need) ? s.need : '?'} of ${s.have}` + (s.unplaced.length || s.need > s.have ? ' <small>short</small>' : ' <small>needed</small>')]),
  ];
  $('figs').innerHTML = figs.map(([k, v]) => `<div class="fig"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('');
  const short = st.filter(s => s.unplaced.length);
  const items = short.map(s => ({ level: 'bad', title: `Not enough ${s.T} mm sheets`, text: isFinite(s.need) ? `The parts need ${s.need}; the library has ${s.have}. ${s.unplaced.length} piece${s.unplaced.length > 1 ? 's' : ''} left over (${[...new Set(s.unplaced.map(u => u.mark))].join(', ')}).` : `Some ${s.T} mm parts are bigger than any sheet (${[...new Set(s.unplaced.map(u => u.mark))].join(', ')}).` }))
    .concat(model.checks);
  const order = { bad: 0, warn: 1, info: 2 };
  items.sort((a, b) => order[a.level] - order[b.level]);
  $('warns').innerHTML = items.map(c => `<div class="warn ${c.level === 'bad' ? 'bad' : c.level === 'info' ? 'info' : ''}"><span><b>${esc(c.title)}.</b> ${esc(c.text)}</span></div>`).join('');
  const nb = items.filter(i => i.level === 'bad').length, nw = items.filter(i => i.level === 'warn').length;
  $('sum-note').textContent = nb ? `${nb} problem${nb > 1 ? 's' : ''} to fix` : nw ? `${nw} to check` : 'no clashes';
  updateBedNote();
}
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
const TCLASS = (t) => t === 6 ? 't6' : t === 12 ? 't12' : t === 18 ? 't18' : 'tx';
function renderSheets() {
  const S = summary;
  $('stock').innerHTML = S.sheets.map(s => {
    const pct = s.have ? Math.min(100, (s.used / s.have) * 100) : 100;
    const over = s.unplaced.length > 0;
    return `<div class="s${over ? ' over' : ''}"><div class="h"><b>${s.T} mm</b><span>${s.used}${over && isFinite(s.need) ? ' (+' + (s.need - s.used) + ')' : ''} of ${s.have} sheets</span></div>` +
      `<div class="bar"><i style="width:${pct}%;background:var(--${TCLASS(s.T) === 'tx' ? 'tx' : TCLASS(s.T)})"></i></div>` +
      `<div class="hint">${s.area ? `${(s.area / 1e6).toFixed(2)} m² of parts, ${s.sheetArea ? Math.round(s.area / s.sheetArea * 100) : 0}% of the sheets used` : 'not used'}</div></div>`;
  }).join('');
  const html = [];
  for (const s of S.sheets) s.bins.forEach((b, i) => {
    const sc = 0.2;
    const W = b.L * sc, H = b.W * sc;
    const items = b.items.map(it => {
      const x = it.x * sc, y = (b.W - it.y - it.h) * sc, w = it.w * sc, h = it.h * sc;
      const fs = Math.max(7, Math.min(16, Math.min(w / (it.mark.length * 0.75 + 0.5), h * 0.55)));
      const lbl = w > 14 && h > 9 ? `<text x="${x + w / 2}" y="${y + h / 2 + fs * 0.35}" text-anchor="middle" font-size="${fs.toFixed(1)}">${esc(it.mark)}</text>` : '';
      return `<rect class="pc ${TCLASS(s.T)}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"><title>${esc(it.mark + ' ' + it.name + ', ' + f0(it.L) + ' x ' + f0(it.W))}</title></rect>${lbl}`;
    }).join('');
    html.push(`<div class="sheet"><div class="cap"><span>${s.T} mm, sheet ${i + 1}</span><span>${b.L} x ${b.W}</span></div><svg viewBox="-2 -2 ${W + 4} ${H + 4}" role="img" aria-label="${s.T} mm sheet ${i + 1} cutting layout"><rect class="board" x="0" y="0" width="${W}" height="${H}"/>${items}</svg></div>`);
  });
  $('sheets').innerHTML = html.join('');
  const totalUsed = S.sheets.reduce((a, s) => a + s.used, 0), totalHave = S.sheets.reduce((a, s) => a + s.have, 0);
  $('cut-note').textContent = `${totalUsed} of ${totalHave} sheets, ${S.cut.reduce((a, r) => a + r.qty, 0)} pieces, ${S.bandM.toFixed(0)} m of edge banding`;
  $('cut-table').innerHTML = '<thead><tr><th>Mark</th><th>Part</th><th class="n">Qty</th><th class="n">Thick</th><th class="n">Length</th><th class="n">Width</th><th>Grain</th></tr></thead><tbody>' +
    S.cut.map(r => `<tr><td class="m"><span class="chip" style="background:var(--${TCLASS(r.T)})"></span>${esc(r.mark)}</td><td>${esc(r.name)}</td><td class="n">${r.qty}</td><td class="n">${r.T}</td><td class="n">${f0(r.L)}</td><td class="n">${f0(r.W)}</td><td>${r.grain ? 'along length' : ''}</td></tr>`).join('') + '</tbody>';
}

function renderClearances() {
  const S = C.clearanceSchedule(model), rows = [];
  const fmt = (v) => typeof v === 'number' ? f0(v) : esc(v);
  for (const g of S.groups) {
    rows.push(`<tr class="grp"><td colspan="5">${esc(g.title.toLowerCase().replace(/^./, c => c.toUpperCase()))}</td></tr>`);
    for (const r of g.rows) rows.push(`<tr class="${r.st}"><td class="id"><span class="st ${r.st}" aria-label="${r.st === 'ok' ? 'enough' : r.st === 'tight' ? 'less than it needs' : r.st === 'clash' ? 'parts meet' : 'for information'}"></span>${r.id}</td><td>${esc(r.what)}</td><td class="r">${esc(r.need)}</td><td class="n">${fmt(r.here)}</td><td class="note">${esc(r.note)}</td></tr>`);
  }
  $('clr-table').innerHTML = '<thead><tr><th>Id</th><th>Clearance</th><th class="n">Needs</th><th class="n">Here</th><th>Note</th></tr></thead><tbody>' + rows.join('') + '</tbody>';
  const all = S.groups.flatMap(g => g.rows), nt = all.filter(r => r.st === 'tight').length, nc = all.filter(r => r.st === 'clash').length;
  $('clr-note').textContent = nc ? `${nc} where parts meet` : nt ? `${nt} less than ${nt > 1 ? 'they need' : 'it needs'}` : 'all clear';
  $('clr-measure').innerHTML = '<b>Measure on your kit and mattress:</b> ' + S.measure.map(([, what, used]) => `${esc(what.toLowerCase())} (${esc(used)})`).join('; ') + '. Enter the mattress under Mattress and bed, the rest under Create-A-Bed hardware.';
}
function renderReview() {
  const R = C.reviewNotes(model, summary);
  const li = (items) => items.map(([t, b]) => `<li><b>${esc(t)}.</b> ${esc(b)}</li>`).join('');
  $('rv-edits').innerHTML = li(R.edits);
  $('rv-open').innerHTML = li(R.open);
  $('rv-src').innerHTML = 'Hardware numbers from: ' + C.SOURCES.map(([t, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>`).join(', ') + '.';
}

/* ---------------------------------------------------------------- bed slider */
let bedAngle = 0, playing = null;
function viewState() {
  return { fronts: viewOpts.fronts, mattress: viewOpts.mattress, bedding: !!viewOpts.bedding, hw: viewOpts.hw, section: viewOpts.section, bySheet: viewOpts.bySheet, bed: bedAngle };
}
function updateBedNote() {
  if (!model) return;
  const G = model.G, th = bedAngle * Math.PI / 180;
  const fp = [[G.yFb, G.zF0], [G.yF, G.zF0], [G.yF, G.zF1], [G.yFb, G.zF1]].map(p => C.rot2(p, G.pivot, th));
  const low = Math.min(...fp.map(p => p[1])), reach = Math.max(...fp.map(p => p[0]));
  $('bed-out').textContent = `${Math.round(bedAngle)}°`;
  $('bed-note').textContent = bedAngle < 0.5 ? 'closed' : `${Math.round(reach)} from the wall, ${Math.round(Math.max(0, low))} off the floor`;
}
function setBed(a) {
  bedAngle = Math.max(0, Math.min(90, a));
  $('bed-angle').value = bedAngle;
  if (viewer) viewer.set({ bed: bedAngle });
  updateBedNote();
}
function playBed() {
  if (playing) { cancelAnimationFrame(playing); playing = null; return; }
  const from = bedAngle, to = bedAngle > 45 ? 0 : 90, dur = 2600 * Math.abs(to - from) / 90 + 200, t0 = performance.now();
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { setBed(to); return; }
  const step = (t) => {
    const k = Math.min(1, (t - t0) / dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    setBed(from + (to - from) * e);
    if (k < 1) playing = requestAnimationFrame(step); else playing = null;
  };
  playing = requestAnimationFrame(step);
}
// "Open fronts": ticked when every door, flap and drawer is open, clear when all are shut, greyed part-way
// when some have been opened by clicking them in the view. Clicking it opens or shuts the lot.
function showOpen(n, total) {
  const cb = $('v-open'), partial = n > 0 && n < total;
  cb.indeterminate = partial;
  cb.checked = total > 0 && n === total;
  cb.parentElement.classList.toggle('partial', partial);
  cb.parentElement.title = partial ? `${n} of ${total} open. Click to open them all.` : '';
}

/* ---------------------------------------------------------------- files */
let downloads = null;
if (window.claude && typeof window.claude.use === 'function') window.claude.use('downloads').then(d => { downloads = d; }).catch(() => {});
function status(txt, frac) {
  $('status').textContent = txt || '';
  $('prog').style.width = frac === undefined ? '0' : `${Math.round(frac * 100)}%`;
}
async function offer(name, data, mime) {
  if (downloads) {
    try { await downloads.save({ filename: name, data }); return 'saved'; }
    catch (e) { if (e && e.code === 'declined') return 'declined'; if (e && e.code === 'rate_limited') return 'busy'; throw e; }
  }
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 4000);
  return 'saved';
}
const baseName = (m) => `murphy-wardrobe-${Math.round(m.P.W)}x${Math.round(m.P.H)}x${Math.round(m.P.D)}`;
function stepText(m, opts) {
  const withAngle = $('step-angle').checked && bedAngle > 0;
  const mm = withAngle ? C.build(m.P, { bedAngle }) : m;
  const hw = $('step-hw').checked;
  return C.writeSTEP(mm, Object.assign({ name: 'MURPHY_WARDROBE', hardware: hw, mattress: hw }, opts || {}));
}
async function downloadStep() {
  const btn = $('dl-step'); btn.disabled = true;
  status('Writing the STEP file...', 0.3);
  await new Promise(r => setTimeout(r, 30));
  const m = model;
  try {
    const txt = stepText(m);
    const name = baseName(m) + '.step';
    let res;
    if (downloads) res = await offer(baseName(m) + '-step.zip', C.makeZip([{ name, data: new TextEncoder().encode(txt) }]));
    else res = await offer(name, txt, 'application/step');
    status(res === 'saved' ? `STEP saved: ${m.parts.length} parts, ${(txt.length / 1e6).toFixed(1)} MB${downloads ? ' (zipped)' : ''}.` : res === 'declined' ? 'STEP not saved.' : 'Another save is waiting; try again in a moment.', 1);
  } catch (e) { console.error(e); status('Could not write the STEP file: ' + (e.message || e.code)); }
  btn.disabled = false;
  setTimeout(() => { $('prog').style.width = '0'; }, 1500);
}
async function downloadPdf() {
  const btn = $('dl-pdf'); btn.disabled = true;
  const m = model, sm = summary;
  try {
    const doc = await window.MurphyDrawings.make(m, sm, (txt, f) => status(txt, f));
    const blob = doc.output('blob');
    const res = await offer(baseName(m) + '-drawings.pdf', blob, 'application/pdf');
    status(res === 'saved' ? `Drawings saved: ${doc.getNumberOfPages()} A3 sheets, ${(blob.size / 1e6).toFixed(1)} MB.` : res === 'declined' ? 'Drawings not saved.' : 'Another save is waiting; try again in a moment.', 1);
  } catch (e) { console.error(e); status('Could not make the drawings: ' + (e.message || e.code)); }
  btn.disabled = false;
  setTimeout(() => { $('prog').style.width = '0'; }, 1500);
}
function csvText(sm) {
  const q = (s) => /[",\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s);
  const rows = [['Mark', 'Part', 'Qty', 'Thickness mm', 'Length mm', 'Width mm', 'Grain along length', 'Edge band m']];
  for (const r of sm.cut) rows.push([r.mark, r.name, r.qty, r.T, f0(r.L), f0(r.W), r.grain ? 'yes' : '', (r.band / 1000).toFixed(2)]);
  rows.push([]);
  rows.push(['Sheet', 'Thickness mm', 'Size', 'Mark', 'Part', 'x mm', 'y mm', 'Length on sheet', 'Width on sheet', 'Turned']);
  for (const s of sm.sheets) s.bins.forEach((b, i) => { for (const it of b.items) rows.push([`${s.T}-${i + 1}`, s.T, `${b.L}x${b.W}`, it.mark, it.name, f0(it.x), f0(it.y), f0(it.w), f0(it.h), it.rot ? 'yes' : '']); });
  return rows.map(r => r.map(q).join(',')).join('\r\n') + '\r\n';
}
async function downloadCsv() {
  try { const res = await offer(baseName(model) + '-cutlist.csv', csvText(summary), 'text/csv'); status(res === 'saved' ? 'Cut list saved.' : 'Cut list not saved.'); }
  catch (e) { status('Could not save the cut list: ' + (e.message || e.code)); }
}

/* ---------------------------------------------------------------- events */
function bind() {
  const rail = document.querySelector('.rail');
  const edits = (e) => e.target.matches('input,select') && e.target.type !== 'file';
  rail.addEventListener('input', (e) => { if (edits(e)) schedule(false); });
  rail.addEventListener('change', (e) => { if (edits(e)) schedule(true); });
  rail.addEventListener('change', whenFields);
  const tabBar = document.querySelector('.tabs');
  tabBar.addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (!b) return; showTab(b.dataset.tab);
    if (rail.getBoundingClientRect().top < 0) rail.scrollIntoView({ block: 'start' }); else rail.scrollTop = 0; });
  tabBar.addEventListener('keydown', (e) => { if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return; const bs = [...tabBar.querySelectorAll('[data-tab]')], i = bs.findIndex(b => b.getAttribute('aria-selected') === 'true');
    const n = bs[(i + (e.key === 'ArrowRight' ? 1 : bs.length - 1)) % bs.length]; showTab(n.dataset.tab); n.focus(); e.preventDefault(); });
  showTab(readLS(LS_TAB) || 'design');
  $('dr-dec').addEventListener('click', () => { readInputs(); if (params.drawers.length > 1) params.drawers.pop(); drawerInputs(); schedule(true); });
  $('dr-inc').addEventListener('click', () => { readInputs(); if (params.drawers.length < 10) params.drawers.push(params.drawers[params.drawers.length - 1] || 180); drawerInputs(); schedule(true); });
  $('dr-equal').addEventListener('click', () => { readInputs(); params.drawers = params.drawers.map(() => params.drawers[0]); drawerInputs(); schedule(true); });
  $('lib-add').addEventListener('click', () => { readInputs(); params.sheets.push({ T: 18, L: 2440, W: 1220, n: 1 }); libRows(); schedule(true); });
  $('lib').addEventListener('click', (e) => { const b = e.target.closest('[data-del]'); if (!b) return; readInputs(); params.sheets.splice(Number(b.dataset.del), 1); libRows(); schedule(true); });
  document.querySelectorAll('.tools [data-view]').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.tools [data-view]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    if (viewer) viewer.view(b.dataset.view);
  }));
  const vopts = () => {
    viewOpts = { fronts: $('v-fronts').checked, mattress: $('v-mattress').checked, bedding: $('v-bedding').checked, hw: $('v-hw').checked, section: $('v-section').checked, bySheet: $('v-sheet').checked };
    writeLS(LS_VIEW, viewOpts);
    document.querySelector('.viewer').classList.toggle('by-sheet', viewOpts.bySheet);
    if (viewer) viewer.set(viewState());
  };
  $('v-fronts').checked = viewOpts.fronts !== false; $('v-mattress').checked = viewOpts.mattress !== false; $('v-bedding').checked = !!viewOpts.bedding; $('v-hw').checked = viewOpts.hw !== false;
  $('v-section').checked = !!viewOpts.section; $('v-sheet').checked = !!viewOpts.bySheet;
  ['v-fronts', 'v-mattress', 'v-bedding', 'v-hw', 'v-sheet'].forEach(id => $(id).addEventListener('change', vopts));
  $('v-section').addEventListener('change', () => {
    vopts();
    if ($('v-section').checked && viewer) { document.querySelectorAll('.tools [data-view]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.view === 'side'))); viewer.view('side'); }
  });
  $('v-open').addEventListener('change', () => { if (viewer) viewer.setAllOpen($('v-open').checked); });
  vopts();
  $('bed-angle').addEventListener('input', (e) => { if (playing) { cancelAnimationFrame(playing); playing = null; } setBed(Number(e.target.value)); });
  $('bed-play').addEventListener('click', playBed);
  $('dl-step').addEventListener('click', downloadStep);
  $('dl-pdf').addEventListener('click', downloadPdf);
  $('dl-csv').addEventListener('click', downloadCsv);
  $('save-json').addEventListener('click', async () => { const r = await offer('murphy-wardrobe-settings.json', JSON.stringify(params, null, 1), 'application/json').catch(e => 'error'); status(r === 'saved' ? 'Settings saved.' : 'Settings not saved.'); });
  $('load-json').addEventListener('click', () => $('load-file').click());
  $('load-file').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { params = C.normParams(JSON.parse(await f.text())); fillInputs(); rebuild(false); status('Settings loaded.'); }
    catch (err) { status('That file is not a settings file from this page.'); }
    e.target.value = '';
  });
  $('reset').addEventListener('click', () => { params = defaults(); fillInputs(); rebuild(false); status('Back to the sizes in murphy_bed.tikz, with the review edits.'); });
  document.querySelectorAll('[data-theme-set]').forEach(b => b.addEventListener('click', () => { applyTheme(b.dataset.themeSet); writeLS(LS_THEME, b.dataset.themeSet); themeBg(); }));
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  if (mq.addEventListener) mq.addEventListener('change', themeBg);
  new MutationObserver(themeBg).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  themeBg();
}
function themeBg() {
  const c = getComputedStyle(document.documentElement).getPropertyValue('--viewer').trim();
  if (c && viewer) viewer.setBackground(new window.THREE.Color(c).getHex());
}

function start() {
  fillInputs();
  try {
    viewer = new V.Viewer($('viewer'));
    viewer.onOrient = (t) => { $('front-tag').textContent = `${t}. Click a door, drawer, flap or the bed to open it, or a power point switch to flick it.`; };
    viewer.onOpenChange = showOpen;
    viewer.onPickBed = playBed;
  }
  catch (e) { console.error(e); $('front-tag').textContent = 'This browser could not start the 3D view (WebGL). The cut list, drawings and STEP file still work.'; }
  window.__murphy = { get model() { return model; }, get summary() { return summary; }, get viewer() { return viewer; }, get params() { return params; }, rebuild, setBed, stepText, csvText, downloadPdf };
  rebuild(false);
  bind();
  if (viewer) { viewer.view('iso'); viewer.set(viewState()); }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
