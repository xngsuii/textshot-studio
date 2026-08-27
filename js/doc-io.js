/* 이미지에 심을 「원본 정보」를 만들고, 꺼낸 정보를 상태에 되돌린다.

   담는 것 — 원문, 스타일, 자동 서식, 말풍선 프로필(이름·색·표시 설정)
   빼는 것 — 사진 데이터 전부. 프로필 사진도 배경 사진도 본문 사진도 안 담는다.
             한 장에 몇 MB 씩 붙어 파일이 감당 안 되기 때문이다.

   프로필 사진은 「이름이 같은 프로필이 지금 설정에 있으면 그 사진을 이어받는」
   방식으로 되살린다. 자기 브라우저에서 저장한 걸 자기 브라우저로 다시 부르는
   보통의 경우에는 사진까지 온전히 돌아온다. */

import {
  state, DEFAULT_STYLE, DEFAULT_FORMATS, DEFAULT_PROFILES,
  newProfile, normalizeSlots, MAX_SLOTS, RATIOS,
} from './store.js';

const APP = 'textshot-studio';
const HEX = /^#[0-9a-fA-F]{6}$/;

const clone = (o) => JSON.parse(JSON.stringify(o));
const appVersion = () => document.querySelector('meta[name="app-version"]')?.content || '';

/* ── 담기 ───────────────────────────────────── */

/* source 는 그 장에 실제로 담긴 원문. 여러 장이면 장마다 다르다. */
export function buildPayload(source) {
  const style = { ...state.text.style };
  delete style.bgImage;
  return {
    app: APP,
    v: 1,
    ver: appVersion(),
    at: new Date().toISOString(),
    source: String(source ?? ''),
    style,
    formats: { ...state.text.formats },
    profiles: state.text.profiles.map(({ avatar, ...rest }) => rest),
  };
}

export const isPayload = (p) => !!p && typeof p === 'object' && p.app === APP && typeof p.source === 'string';

/* ── 꺼낸 값 다듬기 ─────────────────────────── */

/* 남이 만든 이미지를 실수로 넣었을 때를 위해 한 번 거른다.
   스타일 값 일부는 CSS 로 곧장 들어가므로 생김새만 보고 받아들이면 안 된다. */
/* 숫자에 성한 범위를 정해 둔다. 캔버스 폭에 1e9 같은 값이 들어오면
   그리다 멈춰 버리므로, 모르는 파일에서 온 값은 여기에 가둔다. */
const RANGE = {
  fontSize: [6, 400], lineHeight: [0.5, 5], letterSpacing: [-20, 40],
  paraGap: [0, 400], squeeze: [20, 300],
  width: [200, 4000],
  padTop: [0, 1000], padRight: [0, 1000], padBottom: [0, 1000], padLeft: [0, 1000],
  bgOpacity: [0, 100], bgX: [0, 100], bgY: [0, 100], bgBlur: [0, 80], bgHeaderH: [0, 2000],
  bubbleRadius: [0, 200], bubbleAlpha: [0, 100], bubbleGap: [0, 400], nameGap: [0, 200],
  bubbleMaxWidth: [10, 100], bubblePadV: [0, 200], bubblePadH: [0, 200],
  signSize: [6, 200], signGap: [0, 600],
};
const DEFAULT_RANGE = [-2000, 2000];

function cleanStyle(raw) {
  const out = clone(DEFAULT_STYLE);
  for (const [k, def] of Object.entries(DEFAULT_STYLE)) {
    const v = raw?.[k];
    if (v === undefined || v === null) continue;
    if (typeof def === 'number') {
      const n = Number(v);
      if (!Number.isFinite(n)) continue;
      const [lo, hi] = RANGE[k] || DEFAULT_RANGE;
      out[k] = Math.min(hi, Math.max(lo, n));
    } else if (typeof def === 'boolean') {
      out[k] = !!v;
    } else if (typeof def === 'string') {
      if (typeof v !== 'string') continue;
      if (def.startsWith('#')) { if (HEX.test(v)) out[k] = v; }
      else if (v.length <= 120) out[k] = v;
    }
  }
  out.slots = normalizeSlots(raw?.slots).slice(0, MAX_SLOTS).map((s, i) => ({
    name: String(s.name || `색${i + 1}`).slice(0, 24),
    color: HEX.test(s.color) ? s.color : '#1F5D8C',
  }));
  if (!(out.ratio in RATIOS)) out.ratio = 'auto';
  return out;
}

function cleanFormats(raw) {
  const out = clone(DEFAULT_FORMATS);
  for (const k of Object.keys(out)) if (typeof raw?.[k] === 'boolean') out[k] = raw[k];
  return out;
}

const COLOR_KEYS = ['bubbleBg', 'textColor', 'quoteColor', 'parenColor', 'nameColor'];

function cleanProfiles(raw, current) {
  const list = Array.isArray(raw) ? raw.filter(p => p && typeof p === 'object') : [];
  if (!list.length) return clone(DEFAULT_PROFILES);
  // 이름이 같은 프로필이 지금 있으면 그 사진을 그대로 물려받는다
  const mine = new Map(current.map(p => [p.name, p]));
  return list.slice(0, 60).map((p, i) => {
    const q = newProfile(i + 1);
    if (typeof p.name === 'string' && p.name.trim()) q.name = p.name.trim().slice(0, 40);
    q.side = p.side === 'right' ? 'right' : 'left';
    for (const k of COLOR_KEYS) if (HEX.test(p[k] || '')) q[k] = p[k];
    q.avatarColor = HEX.test(p.avatarColor || '') ? p.avatarColor : '';
    q.showName = !!p.showName;
    q.showAvatar = !!p.showAvatar;
    q.avatar = mine.get(q.name)?.avatar || '';
    return q;
  });
}

/* ── 되돌리기 ───────────────────────────────── */

/* mode: 'text' 본문만 / 'all' 서식까지.
   배경 사진은 담지 않았으므로 지금 쓰던 것을 그대로 둔다. */
export function applyPayload(p, mode) {
  if (mode === 'all') {
    const keepBg = state.text.style.bgImage;
    Object.assign(state.text.style, cleanStyle(p.style));
    state.text.style.bgImage = keepBg;
    Object.assign(state.text.formats, cleanFormats(p.formats));
    state.text.profiles = cleanProfiles(p.profiles, state.text.profiles);
    state.activeTemplate = null;
  }
  state.text.source = String(p.source ?? '');
}

/* ── 미리 알려 줄 것들 ──────────────────────── */

const IMG_MARK = /\[\[img:[a-z0-9]+\]\]/g;

/* 「본문만」 으로 가져올 때 어긋나는 것을 미리 찾는다.
   본문은 서식을 참조한다 — 「이름 | 대사」 는 그 이름의 프로필이 지금 있어야
   말풍선이 되고, {c1 …} 은 지금의 색 슬롯을 따라간다. */
export function textOnlyWarnings(p) {
  const src = String(p.source ?? '');
  const saved = new Set((p.profiles || []).map(x => x?.name).filter(Boolean));
  const mine = new Set(state.text.profiles.map(x => x.name));
  const missing = new Set();
  for (const line of src.split(/\r?\n/)) {
    const m = line.match(/^\s*(.{1,40}?)\s*\|\s/);
    if (m && saved.has(m[1]) && !mine.has(m[1])) missing.add(m[1]);
  }
  const notes = [];
  if (missing.size) {
    notes.push(`프로필 ${[...missing].map(n => `「${n}」`).join(' ')} 이(가) 지금 설정에 없습니다. `
      + '그 줄은 말풍선이 아니라 그냥 글로 나옵니다.');
  }
  const used = [...src.matchAll(/\{c([1-5])\s/g)].map(m => Number(m[1]));
  const top = used.length ? Math.max(...used) : 0;
  if (top > state.text.style.slots.length) {
    notes.push(`글이 색 ${top}번까지 쓰는데 지금은 ${state.text.style.slots.length}개뿐입니다.`);
  }
  return notes;
}

/* 어느 모드로 가져오든 알려 줄 것 */
export function commonWarnings(p) {
  const notes = [];
  const n = (String(p.source ?? '').match(IMG_MARK) || []).length;
  if (n) notes.push(`본문 사진 ${n}장은 담기지 않습니다. 자리는 남으니 사진만 다시 넣으세요.`);
  return notes;
}

/* 확인창에 보여 줄 한 줄 요약 */
export function summarize(p) {
  const src = String(p.source ?? '');
  const chars = src.replace(/\s/g, '').length;
  const when = (() => {
    const d = new Date(p.at);
    if (Number.isNaN(+d)) return '';
    const z = (x) => String(x).padStart(2, '0');
    return `${d.getFullYear()}.${z(d.getMonth() + 1)}.${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`;
  })();
  const names = (p.profiles || []).map(x => x?.name).filter(Boolean);
  return {
    when,
    chars,
    profiles: names.join(', '),
    count: names.length,
  };
}
