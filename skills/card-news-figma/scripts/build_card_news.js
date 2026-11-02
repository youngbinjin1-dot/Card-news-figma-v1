// Card news builder for Figma (use_figma / Plugin API).
// HOW TO USE: copy this whole file into a use_figma call. Edit ONLY the CONFIG block.
// Everything below CONFIG is generic and works for any topic, card count, size, and palette.
// Returns created node IDs so you can screenshot and fix afterwards.

const CONFIG = {
  name: '카드뉴스 · 주제 · YYYY.MM.DD',          // wrapper frame name on canvas
  size: { w: 1080, h: 1350 },                     // 1080x1350 (4:5 feed) | 1080x1080 | 1080x1920 (story)
  fontFamilies: ['Pretendard', 'Noto Sans KR', 'IBM Plex Sans KR', 'Inter'], // first available wins
  palette: {                                      // hex only; see SKILL.md palette presets
    paper: '#F4F2EC', ink: '#14161A', accent: '#2F4BFF', accentSoft: '#E4E8FF',
    muted: '#6B6F78', onDark: '#FFFFFF', onDarkMuted: '#AEB4C8', line: '#D6D3CA',
  },
  comfort: {                                      // eye-comfort variable modes (switchable in Figma after build)
    modes: ['sepia', 'dark'],                     // [] = Default mode only (previous behavior)
    preview: 'default',                           // 'default' | 'sepia' | 'dark' — mode shown on the wrapper
    sepia: {}, dark: {},                          // optional token overrides, e.g. { 'bg/paper': '#F2E8D0' }
  },
  brand: { header: 'BRAND · SERIES', footer: '작성자 · 채널명' },
  cover: {
    kicker: 'WEEKLY NOTE',
    title: '첫째 줄\n둘째 줄',                      // manual \n line breaks (Korean has no keep-all in Figma)
    subtitle: '2026.10.26 – 11.01',
    showIndex: true,                              // lists content-card titles on the cover
    indexTitles: null,                            // optional short titles for the index; defaults to card titles flattened
  },
  insightLabel: '핵심 관점',                       // label above the insight box on every content card
  cards: [
    {
      tag: '카테고리',
      title: '카드 제목 첫 줄\n둘째 줄',
      points: [                                   // 2–4 points; every card should use the same count
        { label: '62%', text: '포인트 설명 첫 줄\n둘째 줄' },
        { label: '키워드', text: '포인트 설명' },
        { label: '단계', text: '포인트 설명' },
      ],
      insight: '핵심 메시지 첫 줄\n둘째 줄',
      source: '출처: 매체(날짜) · 매체(날짜)',        // '' to hide
    },
  ],
  closing: {
    title: '마무리 한 줄\n임팩트 문장.',
    body: '보조 설명 첫 줄\n둘째 줄',
    cta: '저장하고 다음 편도 보기 →',
  },
};

// ======================= generic builder below =======================
const W = CONFIG.size.w, H = CONFIG.size.h;
const S = Math.min(1, H / 1350);                 // vertical scale for square formats
const PAD_X = Math.round(96 * (W / 1080)), PAD_Y = Math.round(88 * S);

// ---- font resolution (family + style fallbacks) ----
const avail = await figma.listAvailableFontsAsync();
const byFam = {};
for (const f of avail) { if (!byFam[f.fontName.family]) byFam[f.fontName.family] = new Set(); byFam[f.fontName.family].add(f.fontName.style); }
const FAM = CONFIG.fontFamilies.find(f => byFam[f]) || 'Inter';
const want = {
  regular: ['Regular'], medium: ['Medium', 'Regular'],
  semibold: ['SemiBold', 'Semi Bold', 'Medium', 'Bold'],
  bold: ['Bold', 'SemiBold', 'Semi Bold'],
  black: ['ExtraBold', 'Extra Bold', 'Black', 'Bold'],
};
const ST = {};
for (const [k, list] of Object.entries(want)) ST[k] = list.find(s => byFam[FAM]?.has(s)) || 'Regular';
await Promise.all([...new Set(Object.values(ST))].map(s => figma.loadFontAsync({ family: FAM, style: s })));

// ---- color variables (reuse collection if it exists) ----
const hex = h => ({ r: parseInt(h.slice(1, 3), 16) / 255, g: parseInt(h.slice(3, 5), 16) / 255, b: parseInt(h.slice(5, 7), 16) / 255 });
const colName = 'CardNews/' + CONFIG.name;
let col = (await figma.variables.getLocalVariableCollectionsAsync()).find(c => c.name === colName);
if (!col) col = figma.variables.createVariableCollection(colName);
const existing = await Promise.all(col.variableIds.map(id => figma.variables.getVariableByIdAsync(id)));
const pal = CONFIG.palette;

// color math: mix, WCAG contrast, and nudging a color until it reaches a contrast target
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const toHex = a => '#' + a.map(x => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('').toUpperCase();
const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return toHex(A.map((x, i) => x + (B[i] - x) * t)); };
const lum = h => { const [r, g, b] = rgb(h).map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const ensure = (fg, bg, min, toward) => { let c = fg; for (let i = 0; i < 30 && contrast(c, bg) < min; i++) c = mix(c, toward, 0.1); return c; };

// token tables per mode. bg/ink vs text/ink and bg/accent vs text/accent are separate tokens so dark mode can split them.
function tokensFor(m) {
  if (m === 'default') return {
    'bg/canvas': '#E9E7E1', 'bg/paper': pal.paper, 'bg/ink': pal.ink, 'bg/accent': pal.accent, 'bg/accent-soft': pal.accentSoft,
    'text/ink': pal.ink, 'text/muted': pal.muted, 'text/accent': pal.accent,
    'text/on-dark': pal.onDark, 'text/on-dark-muted': pal.onDarkMuted, 'line/default': pal.line, 'line/on-dark': pal.onDark,
  };
  let t;
  if (m === 'sepia') {
    const paper = '#F4ECD8', ink = '#3B3229', onDark = '#F4ECD8';
    const base = mix(pal.accent, '#8B6F4E', 0.35);
    const accentSoft = mix(base, paper, 0.82);
    const accent = ensure(ensure(base, paper, 4.5, ink), accentSoft, 4.5, ink);
    const bgAccent = ensure(base, onDark, 5.5, ink);  // headroom so on-dark-muted can also reach 4.5
    t = {
      'bg/canvas': '#E8DFC9', 'bg/paper': paper, 'bg/ink': '#4A3F35', 'bg/accent': bgAccent, 'bg/accent-soft': accentSoft,
      'text/ink': ink, 'text/muted': '#7A6E60', 'text/accent': accent,
      'text/on-dark': onDark, 'text/on-dark-muted': '#CBBFA8', 'line/default': '#DDD2BA', 'line/on-dark': onDark,
    };
  } else {
    const paper = '#1C1D21', onDark = '#E4E1DA';
    const base = mix(pal.accent, '#FFFFFF', 0.2);
    const accentSoft = mix(base, paper, 0.8);
    const accent = ensure(ensure(base, paper, 4.5, '#FFFFFF'), accentSoft, 4.5, '#FFFFFF');
    const bgAccent = ensure(mix(accent, paper, 0.45), onDark, 5.5, paper);
    t = {
      'bg/canvas': '#121316', 'bg/paper': paper, 'bg/ink': '#2A2C31', 'bg/accent': bgAccent, 'bg/accent-soft': accentSoft,
      'text/ink': onDark, 'text/muted': '#9A9DA6', 'text/accent': accent,
      'text/on-dark': onDark, 'text/on-dark-muted': '#A8ABB3', 'line/default': '#33363C', 'line/on-dark': onDark,
    };
  }
  t = { ...t, ...(CONFIG.comfort[m] || {}) };
  t['text/muted'] = ensure(t['text/muted'], t['bg/paper'], 4.5, t['text/ink']);
  for (const bg of ['bg/ink', 'bg/accent']) t['text/on-dark-muted'] = ensure(t['text/on-dark-muted'], t[bg], 4.5, t['text/on-dark']);
  return t;
}

// modes: Default + requested comfort modes. If the plan limits modes, fall back to the preview mode's values in a single mode.
const MODE_NAMES = { default: 'Default', sepia: 'Sepia', dark: 'Dark' };
const comfortModes = (CONFIG.comfort.modes || []).filter(m => m === 'sepia' || m === 'dark');
const preview = MODE_NAMES[CONFIG.comfort.preview] ? CONFIG.comfort.preview : 'default';
let modesUnavailable = false;
const modeIds = {};
col.renameMode(col.modes[0].modeId, 'Default');
modeIds.default = col.modes[0].modeId;
for (const m of comfortModes) {
  const found = col.modes.find(x => x.name === MODE_NAMES[m]);
  if (found) { modeIds[m] = found.modeId; continue; }
  try { modeIds[m] = col.addMode(MODE_NAMES[m]); } catch (e) { modesUnavailable = true; break; }
}
const plan = modesUnavailable
  ? { default: tokensFor(preview) }
  : Object.fromEntries(Object.keys(modeIds).map(m => [m, tokensFor(m)]));

const V = {};
for (const name of Object.keys(plan.default)) {
  let v = existing.find(x => x && x.name === name);
  if (!v) v = figma.variables.createVariable(name, col, 'COLOR');
  for (const [m, t] of Object.entries(plan)) v.setValueForMode(modeIds[m], hex(t[name]));
  v.scopes = name.startsWith('text') ? ['TEXT_FILL'] : name.startsWith('line') ? ['STROKE_COLOR', 'SHAPE_FILL', 'FRAME_FILL'] : ['FRAME_FILL', 'SHAPE_FILL'];
  V[name] = v;
}
const P = (n, opacity = 1) => [figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity }, 'color', V[n])];

// contrast check for comfort modes (Default keeps the preset as chosen)
const CHECKS = [
  ['text/ink', 'bg/paper', 4.5], ['text/muted', 'bg/paper', 4.5], ['text/accent', 'bg/paper', 4.5], ['text/accent', 'bg/accent-soft', 4.5],
  ['text/on-dark', 'bg/accent', 4.5], ['text/on-dark', 'bg/ink', 4.5], ['text/on-dark-muted', 'bg/ink', 4.5], ['text/on-dark-muted', 'bg/accent', 4.5],
];
const contrastWarnings = [];
for (const m of modesUnavailable ? (preview === 'default' ? [] : [preview]) : comfortModes) {
  const t = modesUnavailable ? plan.default : plan[m];
  for (const [fg, bg, min] of CHECKS) { const r = contrast(t[fg], t[bg]); if (r < min) contrastWarnings.push(`${MODE_NAMES[m]}: ${fg} on ${bg} = ${r.toFixed(2)} (< ${min})`); }
}

// ---- helpers ----
function T(chars, size, style, color, lh = 140) {
  const t = figma.createText();
  t.fontName = { family: FAM, style: ST[style] };
  t.characters = chars || ' ';
  t.fontSize = Math.round(size * (size > 40 ? S : 1));
  t.lineHeight = { unit: 'PERCENT', value: lh };
  t.letterSpacing = { unit: 'PERCENT', value: -2 };
  t.fills = P(color);
  return t;
}
function add(parent, node, fillW = false) {
  parent.appendChild(node);
  if (fillW) { if (node.type === 'TEXT') node.textAutoResize = 'HEIGHT'; node.layoutSizingHorizontal = 'FILL'; }
  return node;
}
const V_ = (name, gap = 0) => figma.createAutoLayout('VERTICAL', { name, itemSpacing: gap, fills: [] });
const H_ = (name, gap = 0) => figma.createAutoLayout('HORIZONTAL', { name, itemSpacing: gap, fills: [] });
function shell(node, bg) {
  node.layoutMode = 'VERTICAL'; node.resize(W, H);
  node.primaryAxisSizingMode = 'FIXED'; node.counterAxisSizingMode = 'FIXED';
  node.paddingTop = node.paddingBottom = PAD_Y; node.paddingLeft = node.paddingRight = PAD_X;
  node.itemSpacing = 0; node.fills = P(bg); node.clipsContent = true;
  return node;
}
function header(parent, right, dark) {
  const h = H_('Header'); add(parent, h, true);
  h.primaryAxisAlignItems = 'SPACE_BETWEEN'; h.counterAxisAlignItems = 'CENTER';
  const a = T(CONFIG.brand.header, 24, 'bold', dark ? 'text/on-dark' : 'text/ink'); a.letterSpacing = { unit: 'PERCENT', value: 8 };
  const b = T(right, 24, 'medium', dark ? 'text/on-dark-muted' : 'text/muted');
  h.appendChild(a); h.appendChild(b);
  return b;
}
const spacer = p => { const s = V_('Spacer'); add(p, s, true); s.layoutGrow = 1; return s; };

const total = CONFIG.cards.length + 2;
const pg = i => `${String(i).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
const nPts = Math.max(...CONFIG.cards.map(c => c.points.length));

// clear position on canvas
let maxX = 0;
for (const c of figma.currentPage.children) maxX = Math.max(maxX, c.x + c.width);
const baseX = figma.currentPage.children.length ? maxX + 400 : 0;

// ---- content card component ----
const comp = figma.createComponent();
comp.name = 'Card/Content';
shell(comp, 'bg/paper');
comp.description = 'Card news content card. Edit number, tag, title, points, insight and source via text properties.';
const props = {};
const bind = (node, key, def) => { props[key] = comp.addComponentProperty(key, 'TEXT', def); node.componentPropertyReferences = { characters: props[key] }; };

bind(header(comp, pg(2), false), 'Page', pg(2));
const top = V_('Top', Math.round(28 * S)); add(comp, top, true); top.paddingTop = Math.round(64 * S);
const numRow = H_('NumberRow', 24); add(top, numRow, true); numRow.counterAxisAlignItems = 'CENTER';
const num = T('01', 120, 'black', 'text/accent', 100); numRow.appendChild(num); bind(num, 'Number', '01');
const pill = H_('Tag'); pill.paddingLeft = pill.paddingRight = 24; pill.paddingTop = pill.paddingBottom = 12; pill.cornerRadius = 999; pill.fills = P('bg/accent-soft');
numRow.appendChild(pill);
const tag = T('태그', 26, 'semibold', 'text/accent', 120); pill.appendChild(tag); bind(tag, 'Tag', '태그');
bind(add(top, T('제목', 68, 'bold', 'text/ink', 130), true), 'Title', '제목');

const dw = V_('DividerWrap'); dw.paddingTop = Math.round(48 * S); dw.paddingBottom = Math.round(40 * S); add(comp, dw, true);
const div = figma.createRectangle(); div.name = 'Divider'; div.resize(W - PAD_X * 2, 2); div.fills = P('line/default'); add(dw, div, true);

const pts = V_('Points', Math.round(32 * S)); add(comp, pts, true);
for (let i = 1; i <= nPts; i++) {
  const row = H_('Point ' + i, 28); add(pts, row, true);
  const lab = T('라벨', 40, 'black', 'text/accent', 120); row.appendChild(lab);
  lab.textAutoResize = 'HEIGHT'; lab.resize(190, lab.height); lab.layoutSizingHorizontal = 'FIXED';
  const txt = add(row, T('내용', 32, 'medium', 'text/ink', 140), true); txt.layoutGrow = 1;
  bind(lab, 'Label ' + i, '라벨'); bind(txt, 'Point ' + i, '내용');
}
spacer(comp);
const ins = V_('Insight', 12); add(comp, ins, true); ins.fills = P('bg/ink'); ins.cornerRadius = 28;
ins.paddingTop = ins.paddingBottom = Math.round(40 * S); ins.paddingLeft = ins.paddingRight = 44;
ins.appendChild(T(CONFIG.insightLabel, 24, 'bold', 'text/on-dark-muted', 120));
bind(add(ins, T('인사이트', 34, 'semibold', 'text/on-dark', 145), true), 'Insight', '인사이트');
const sw = V_('Source'); sw.paddingTop = Math.round(32 * S); add(comp, sw, true);
bind(add(sw, T('출처', 22, 'regular', 'text/muted', 140), true), 'Source', '출처');
comp.x = baseX; comp.y = -H - 300;

// ---- carousel wrapper ----
const wrap = figma.createAutoLayout('HORIZONTAL', { name: CONFIG.name, itemSpacing: 80 });
wrap.paddingTop = wrap.paddingBottom = wrap.paddingLeft = wrap.paddingRight = 80;
wrap.fills = P('bg/canvas');
wrap.x = baseX; wrap.y = 0;
if (!modesUnavailable && modeIds[preview]) wrap.setExplicitVariableModeForCollection(col, modeIds[preview]);

// cover
const cover = shell(figma.createFrame(), 'bg/accent'); cover.name = '01 Cover'; wrap.appendChild(cover);
header(cover, pg(1), true);
const ct = V_('CoverTitle', Math.round(32 * S)); add(cover, ct, true); ct.paddingTop = Math.round(120 * S);
add(ct, T(CONFIG.cover.kicker, 30, 'bold', 'text/on-dark-muted', 120), true);
add(ct, T(CONFIG.cover.title, 128, 'black', 'text/on-dark', 115), true);
if (CONFIG.cover.subtitle) add(ct, T(CONFIG.cover.subtitle, 40, 'semibold', 'text/on-dark', 120), true);
spacer(cover);
if (CONFIG.cover.showIndex) {
  const list = V_('Index'); add(cover, list, true);
  const titles = CONFIG.cover.indexTitles || CONFIG.cards.map(c => c.title.replace(/\n/g, ' '));
  titles.forEach((t, i) => {
    const r = H_('Index ' + (i + 1), 28); add(list, r, true); r.counterAxisAlignItems = 'CENTER';
    r.paddingTop = r.paddingBottom = Math.round(24 * S);
    r.strokes = P('line/on-dark', 0.3);
    r.strokeTopWeight = 2; r.strokeBottomWeight = 0; r.strokeLeftWeight = 0; r.strokeRightWeight = 0;
    r.appendChild(T(String(i + 1).padStart(2, '0'), 32, 'black', 'text/on-dark', 120));
    const tt = add(r, T(t, 32, 'semibold', 'text/on-dark', 130), true); tt.layoutGrow = 1;
  });
}
const cf = V_('CoverFooter'); cf.paddingTop = Math.round(40 * S); add(cover, cf, true);
add(cf, T(CONFIG.brand.footer, 24, 'medium', 'text/on-dark-muted', 130), true);

// content cards
const instIds = [];
CONFIG.cards.forEach((c, i) => {
  const inst = comp.createInstance(); wrap.appendChild(inst);
  const vals = { Page: pg(i + 2), Number: String(i + 1).padStart(2, '0'), Tag: c.tag, Title: c.title, Insight: c.insight, Source: c.source || ' ' };
  for (let k = 1; k <= nPts; k++) { const p = c.points[k - 1]; vals['Label ' + k] = p ? p.label : ' '; vals['Point ' + k] = p ? p.text : ' '; }
  const map = {}; for (const [k, v] of Object.entries(vals)) map[props[k]] = v;
  inst.setProperties(map);
  inst.name = `${String(i + 2).padStart(2, '0')} Card ${String(i + 1).padStart(2, '0')}`;
  instIds.push(inst.id);
});

// closing
const close = shell(figma.createFrame(), 'bg/ink'); close.name = `${String(total).padStart(2, '0')} Closing`; wrap.appendChild(close);
header(close, pg(total), true);
const cb = V_('ClosingBody', Math.round(40 * S)); add(close, cb, true); cb.paddingTop = Math.round(160 * S);
add(cb, T(CONFIG.closing.title, 104, 'black', 'text/on-dark', 120), true);
if (CONFIG.closing.body) add(cb, T(CONFIG.closing.body, 36, 'medium', 'text/on-dark-muted', 150), true);
spacer(close);
if (CONFIG.closing.cta) {
  const cta = H_('CTA'); cta.fills = P('bg/accent'); cta.cornerRadius = 999;
  cta.paddingLeft = cta.paddingRight = 44; cta.paddingTop = cta.paddingBottom = 28;
  close.appendChild(cta); cta.appendChild(T(CONFIG.closing.cta, 32, 'bold', 'text/on-dark', 120));
}
const clf = V_('ClosingFooter'); clf.paddingTop = Math.round(48 * S); add(close, clf, true);
add(clf, T(CONFIG.brand.footer, 24, 'medium', 'text/on-dark-muted', 130), true);

// overflow check: content taller than the card means text must be shortened
const overflow = [];
for (const f of [cover, close]) { const used = f.children.reduce((s, n) => s + (n.name === 'Spacer' ? 0 : n.height), 0) + PAD_Y * 2; if (used > H) overflow.push(f.name); }
for (const id of instIds) { const n = await figma.getNodeByIdAsync(id); const used = n.children.reduce((s, c) => s + (c.name === 'Spacer' ? 0 : c.height), 0) + PAD_Y * 2; if (used > H) overflow.push(n.name); }

return { font: `${FAM} (${Object.values(ST).join(', ')})`, wrapId: wrap.id, componentId: comp.id, coverId: cover.id, cardIds: instIds, closingId: close.id, overflow,
  modes: modesUnavailable ? [MODE_NAMES[preview] + ' (single mode)'] : Object.keys(modeIds).map(m => MODE_NAMES[m]), preview: MODE_NAMES[preview], modesUnavailable, contrastWarnings };
