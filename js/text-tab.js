/* 텍스트 발췌 탭 */

import {
  state, saveSoon, FONTS, fontById, DEFAULT_FORMATS, DEFAULT_STYLE,
  DEFAULT_OUTPUT, RATIOS, MAX_SLOTS,
} from './store.js';
import { splitChunks, hasSplit, renderChunk, renderWithSplitMarks, stripMarkers } from './markup.js';
import { ensureFont, isAvailable } from './fonts.js';
import { buildTemplateSection } from './templates.js';
import * as U from './ui.js';

const srcEl = () => document.getElementById('src');
const clone = (o) => JSON.parse(JSON.stringify(o));

/* ── 스타일을 스테이지에 입힌다 ─────────────── */
function applyStyle(stage) {
  const st = state.text.style;
  const f = fontById(st.font);
  ensureFont(st.font);

  Object.assign(stage.style, {
    position: 'relative',
    width: st.width + 'px',
    paddingTop: st.padTop + 'px',
    paddingRight: st.padRight + 'px',
    paddingBottom: st.padBottom + 'px',
    paddingLeft: st.padLeft + 'px',
    backgroundColor: st.transparent ? 'transparent' : st.bg,
    color: st.fg,
    fontFamily: f.stack,
    fontSize: st.fontSize + 'px',
    lineHeight: String(st.lineHeight),
    letterSpacing: st.letterSpacing + 'px',
    textAlign: st.align,
    display: 'flex',
    flexDirection: 'column',
    gap: st.paraGap + 'px',
    wordBreak: st.breakMode === 'char' ? 'break-all' : 'keep-all',
    overflowWrap: st.breakMode === 'char' ? 'break-word' : 'anywhere',
  });

  const r = RATIOS[st.ratio];
  stage.style.minHeight = r ? Math.round(st.width * r) + 'px' : '';

  const v = {
    '--c-action': st.actionColor,
    '--c-quote': st.quoteColor,
    '--c-paren': st.parenColor,
    '--c-divider': st.dividerColor,
    '--c-heading': st.headingColor,
    '--c-bq': st.bqColor,
    '--c-hl': st.hlColor,
    '--c-code-bg': st.codeBg,
    '--c-code-fg': st.codeFg,
    '--c-code-title': st.codeTitleColor,
  };
  for (const [k, val] of Object.entries(v)) stage.style.setProperty(k, val);
  (st.slots || []).forEach((s, i) => stage.style.setProperty(`--c-slot${i + 1}`, s.color));

  if (st.bgImage) {
    const layer = U.el('div', { class: 'stage-bg' });
    Object.assign(layer.style, {
      backgroundImage: `url("${st.bgImage}")`,
      backgroundSize: st.bgFit === 'tile' ? 'auto' : st.bgFit,
      backgroundRepeat: st.bgFit === 'tile' ? 'repeat' : 'no-repeat',
      backgroundPosition: 'center',
      opacity: String((st.bgOpacity ?? 100) / 100),
    });
    stage.prepend(layer);
  }
}

function makeStage(html) {
  const stage = U.el('div', { class: 'stage' });
  stage.innerHTML = html;
  applyStyle(stage);
  return stage;
}

export function buildExportStages() {
  const f = state.text.formats;
  return splitChunks(state.text.source).map(c => makeStage(renderChunk(c, f)));
}

/* ── 미리보기 ───────────────────────────────── */
export function renderPreview(host) {
  const src = state.text.source;
  const f = state.text.formats;
  const split = hasSplit(src);

  document.getElementById('splitSeg').hidden = !split;

  host.textContent = '';
  const stages = (split && state.splitView === 'after')
    ? splitChunks(src).map(c => makeStage(renderChunk(c, f)))
    : [makeStage(split ? renderWithSplitMarks(src, f) : renderChunk(src, f))];

  stages.forEach((s, i) => {
    const wrap = U.el('div', { class: 'stage-wrap' }, [s]);
    if (stages.length > 1) wrap.appendChild(U.el('div', { class: 'stage-label', text: `${i + 1} / ${stages.length}` }));
    host.appendChild(wrap);
  });

  return stages;
}

/* ── 색 슬롯 버튼 (입력칸 위) ───────────────── */
export function buildSlotBar(onChange) {
  const bar = document.getElementById('slotBar');
  bar.textContent = '';
  (state.text.style.slots || []).forEach((slot, i) => {
    const n = i + 1;
    const btn = U.el('button', {
      class: 'fmt-btn slot-btn', type: 'button',
      title: `${slot.name} — 선택한 글자에 이 색을 입힙니다 (다시 누르면 해제)`,
      onClick: () => wrapSelection(`{c${n} `, '}', onChange),
    }, [U.el('span', { class: 'slot-dot' }), U.el('span', { text: slot.name })]);
    btn.querySelector('.slot-dot').style.background = slot.color;
    bar.appendChild(btn);
  });
}

/* ── 설정 패널 ──────────────────────────────── */
const ICON = {
  format: '<path d="M8 2v12M2 8h12M4.2 4.2l7.6 7.6M11.8 4.2l-7.6 7.6"/>',
  body: '<path d="M2.5 4h11M2.5 8h7M2.5 12h9"/>',
  canvas: '<rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/><path d="M2.5 10.5l3-2.5 3 2.2 2.5-2 2.5 2"/>',
  color: '<path d="M8 2.2c2.7 3.3 4 5.2 4 6.9a4 4 0 0 1-8 0c0-1.7 1.3-3.6 4-6.9z"/>',
  output: '<path d="M8 2.5v7.5M5 7.2L8 10.2l3-3M2.8 13.2h10.4"/>',
  template: '<path d="M8 2.4l1.8 3.8 4.1.6-3 2.9.7 4.1L8 11.8l-3.6 1.9.7-4.1-3-2.9 4.1-.6z"/>',
};

const SET_TABS = [
  ['format', '자동 서식'],
  ['body', '본문·간격'],
  ['canvas', '캔버스'],
  ['color', '색상'],
  ['output', '출력'],
  ['template', '템플릿'],
];

let activeSetTab = 'body';

function icon(name) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 16 16');
  s.setAttribute('class', 'set-ico');
  s.innerHTML = ICON[name];
  return s;
}

function group(title, children) {
  return U.el('div', { class: 'grp' }, [
    title ? U.el('div', { class: 'grp-t', text: title }) : null,
    ...children.filter(Boolean),
  ]);
}

export function buildSettings(container, onChange) {
  const tabsHost = document.getElementById('setTabs');
  tabsHost.textContent = '';
  SET_TABS.forEach(([id, label]) => {
    const b = U.el('button', {
      class: `set-tab${activeSetTab === id ? ' is-active' : ''}`, type: 'button',
      onClick: () => { activeSetTab = id; buildSettings(container, onChange); },
    }, [icon(id), U.el('span', { text: label })]);
    tabsHost.appendChild(b);
  });

  container.textContent = '';
  container.appendChild(PANELS[activeSetTab](container, onChange));
  container.scrollTop = 0;
}

const PANELS = {
  format: panelFormat,
  body: panelBody,
  canvas: panelCanvas,
  color: panelColor,
  output: panelOutput,
  template: panelTemplate,
};

/* 자동 서식 */
function panelFormat(container, onChange) {
  const fm = state.text.formats;
  const rebuild = () => buildSettings(container, onChange);
  const items = [
    ['bold', '굵게', '**글자**'],
    ['action', '행동지문', '*글자*'],
    ['italic', '기울임', '_글자_'],
    ['quote', '대사', '"글자"'],
    ['highlight', '형광펜', '==글자=='],
    ['paren', '괄호', '(글자)'],
    ['heading', '제목', '#  ##'],
    ['blockquote', '인용구', '>  >2'],
    ['code', '코드블럭', '```'],
    ['divider', '구분선', '---'],
  ];
  return U.el('div', { class: 'panel' }, [
    group('', items.map(([k, label, mark]) =>
      U.el('label', { class: 'fmt-check' }, [
        (() => {
          const c = U.el('input', { type: 'checkbox', onChange: (e) => { fm[k] = e.target.checked; onChange(); } });
          c.checked = !!fm[k];
          return c;
        })(),
        U.el('span', { class: 'fmt-check-name', text: label }),
        U.el('code', { class: 'fmt-check-mark', text: mark }),
      ]))),
    U.el('div', { class: 'field-row' }, [
      U.el('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: '모두 켜기',
        onClick: () => { Object.assign(fm, DEFAULT_FORMATS); rebuild(); onChange(); } }),
      U.el('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: '모두 끄기',
        onClick: () => { for (const k of Object.keys(fm)) fm[k] = false; rebuild(); onChange(); } }),
    ]),
    U.el('div', { class: 'hint', text: '분할선 === 은 이 설정과 무관하게 늘 동작합니다. 코드블럭은 제목 없이 열고 안에 HTML/CSS를 넣으면 그려서 보여줍니다.' }),
  ]);
}

/* 본문·간격 */
function panelBody(container, onChange) {
  const st = state.text.style;
  const touch = () => { state.activeTemplate = null; onChange(); };

  const fontSel = U.select(st.font, FONTS.map(f => [f.id, f.label]), (v) => { st.font = v; touch(); });
  FONTS.filter(f => f.source === 'local').forEach(async (f) => {
    if (await isAvailable(f.id)) return;
    const opt = [...fontSel.options].find(o => o.value === f.id);
    if (opt) opt.textContent = `${f.label} — 파일 없음`;
  });

  return U.el('div', { class: 'panel' }, [
    group('글꼴', [
      U.field('폰트', fontSel),
      U.field('크기', U.stepper(st.fontSize, { min: 8, max: 96, step: 1, unit: 'px', onChange: (v) => { st.fontSize = v; touch(); } })),
    ]),
    group('간격', [
      U.field('행간', U.stepper(st.lineHeight, { min: 0.8, max: 5, step: 0.1, decimals: 2, onChange: (v) => { st.lineHeight = v; touch(); } })),
      U.field('자간', U.stepper(st.letterSpacing, { min: -3, max: 10, step: 0.5, decimals: 1, unit: 'px', onChange: (v) => { st.letterSpacing = v; touch(); } })),
      U.field('문단 간격', U.stepper(st.paraGap, { min: 0, max: 80, step: 1, unit: 'px', onChange: (v) => { st.paraGap = v; touch(); } })),
    ]),
    group('흐름', [
      U.field('정렬', U.seg(st.align, [['left', '왼쪽'], ['center', '가운데'], ['justify', '양쪽']], (v) => { st.align = v; touch(); })),
      U.field('줄바꿈', U.seg(st.breakMode, [['word', '단어 단위'], ['char', '글자 단위']], (v) => { st.breakMode = v; touch(); })),
      U.el('div', { class: 'hint', text: '단어 단위는 낱말이 잘리지 않게 넘깁니다. 좁은 폭에서 오른쪽이 들쭉날쭉하면 글자 단위로 바꿔 보세요.' }),
    ]),
  ]);
}

/* 캔버스 */
function panelCanvas(container, onChange) {
  const st = state.text.style;
  const touch = () => { state.activeTemplate = null; onChange(); };
  const rebuild = () => buildSettings(container, onChange);

  const fileInput = U.el('input', {
    type: 'file', accept: 'image/*', style: 'display:none',
    onChange: (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 3 * 1024 * 1024) U.toast('이미지가 3MB를 넘어 자동 저장에서 빠질 수 있습니다');
      const fr = new FileReader();
      fr.onload = () => { st.bgImage = fr.result; rebuild(); touch(); };
      fr.readAsDataURL(file);
      e.target.value = '';
    },
  });

  return U.el('div', { class: 'panel' }, [
    group('크기', [
      U.field('너비', U.stepper(st.width, { min: 200, max: 4000, step: 10, unit: 'px', onChange: (v) => { st.width = v; touch(); } })),
      U.field('비율', U.select(st.ratio, [
        ['auto', '자동 — 글 길이만큼'], ['1:1', '1 : 1'], ['a4', 'A4'], ['a5', 'A5'], ['b5', 'B5'],
      ], (v) => { st.ratio = v; touch(); })),
      U.el('div', { class: 'hint', text: '비율을 고르면 그 높이가 최소 높이가 됩니다. 글이 더 길면 잘리지 않고 아래로 늘어납니다.' }),
    ]),
    group('여백', [
      U.check('네 방향 동일', st.padLinked, (v) => { st.padLinked = v; }),
      U.padGrid(st, ['padTop', 'padRight', 'padBottom', 'padLeft'], () => st.padLinked, touch),
      U.el('div', { class: 'hint', text: '분할하면 각 장에 이 여백이 새로 들어갑니다.' }),
    ]),
    group('배경', [
      U.field('배경색', U.color(st.bg, (v) => { st.bg = v; touch(); })),
      U.check('배경 투명 (PNG 저장 시에만 적용)', st.transparent, (v) => { st.transparent = v; touch(); }),
      U.el('div', { class: 'field-row' }, [
        U.el('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: st.bgImage ? '이미지 바꾸기' : '이미지 넣기', onClick: () => fileInput.click() }),
        st.bgImage ? U.el('button', { class: 'btn btn-danger btn-sm', type: 'button', text: '이미지 빼기',
          onClick: () => { st.bgImage = ''; rebuild(); touch(); } }) : null,
        fileInput,
      ]),
      st.bgImage ? U.field('맞춤', U.seg(st.bgFit, [['cover', '꽉 채움'], ['contain', '전체 보임'], ['tile', '반복']], (v) => { st.bgFit = v; touch(); })) : null,
      st.bgImage ? U.field('불투명도', U.stepper(st.bgOpacity, { min: 0, max: 100, step: 5, unit: '%', onChange: (v) => { st.bgOpacity = v; touch(); } })) : null,
    ]),
  ]);
}

/* 색상 (색 슬롯 · 코드블럭 포함) */
function panelColor(container, onChange) {
  const st = state.text.style;
  const touch = () => { state.activeTemplate = null; onChange(); };
  const rebuild = () => buildSettings(container, onChange);

  const slotRows = (st.slots || []).map((slot, i) => U.el('div', { class: 'slot-row' }, [
    U.el('span', { class: 'slot-no', text: `${i + 1}` }),
    U.el('input', {
      type: 'text', value: slot.name, placeholder: `색${i + 1}`,
      onInput: (e) => { slot.name = e.target.value; buildSlotBar(onChange); saveSoon(); },
    }),
    U.color(slot.color, (v) => { slot.color = v; buildSlotBar(onChange); touch(); }),
    U.el('button', {
      class: 'tpl-act del', type: 'button', text: '삭제', title: '이 슬롯을 없앱니다',
      onClick: () => {
        st.slots.splice(i, 1);
        if (!st.slots.length) st.slots.push({ name: '색1', color: '#1F5D8C' });
        buildSlotBar(onChange); rebuild(); touch();
      },
    }),
  ]));

  return U.el('div', { class: 'panel' }, [
    group('본문', [
      U.field('글자', U.color(st.fg, (v) => { st.fg = v; touch(); })),
      U.field('제목', U.color(st.headingColor, (v) => { st.headingColor = v; touch(); })),
      U.field('행동지문', U.color(st.actionColor, (v) => { st.actionColor = v; touch(); })),
      U.field('대사', U.color(st.quoteColor, (v) => { st.quoteColor = v; touch(); })),
      U.field('괄호', U.color(st.parenColor, (v) => { st.parenColor = v; touch(); })),
      U.field('형광펜', U.color(st.hlColor, (v) => { st.hlColor = v; touch(); })),
      U.field('인용구', U.color(st.bqColor, (v) => { st.bqColor = v; touch(); })),
      U.field('구분선', U.color(st.dividerColor, (v) => { st.dividerColor = v; touch(); })),
    ]),
    group('색 슬롯', [
      ...slotRows,
      U.el('div', { class: 'field-row' }, [
        U.el('button', {
          class: 'btn btn-ghost btn-sm', type: 'button',
          text: `슬롯 추가 (${st.slots.length}/${MAX_SLOTS})`,
          disabled: st.slots.length >= MAX_SLOTS,
          onClick: () => {
            if (st.slots.length >= MAX_SLOTS) return;
            st.slots.push({ name: `색${st.slots.length + 1}`, color: '#2F6B4F' });
            buildSlotBar(onChange); rebuild(); touch();
          },
        }),
      ]),
      U.el('div', { class: 'hint', text: '입력칸 위에 이 이름으로 버튼이 생깁니다. 인용구도 > 뒤에 번호를 붙이면 (>2) 그 슬롯 색을 씁니다.' }),
    ]),
    group('코드블럭', [
      U.field('배경', U.color(st.codeBg, (v) => { st.codeBg = v; touch(); })),
      U.field('글자', U.color(st.codeFg, (v) => { st.codeFg = v; touch(); })),
      U.field('제목', U.color(st.codeTitleColor, (v) => { st.codeTitleColor = v; touch(); })),
    ]),
  ]);
}

/* 출력 */
function panelOutput(container, onChange) {
  const out = state.output;
  const rebuild = () => buildSettings(container, onChange);

  return U.el('div', { class: 'panel' }, [
    group('', [
      U.field('배율', U.seg(String(out.scale), [['1', '1x'], ['2', '2x'], ['3', '3x']], (v) => { out.scale = parseInt(v, 10); onChange(); })),
      U.field('포맷', U.seg(out.format, [['png', 'PNG'], ['jpg', 'JPG'], ['webp', 'WebP']], (v) => { out.format = v; rebuild(); onChange(); })),
      out.format === 'png' ? null
        : U.field('품질', U.stepper(out.quality, { min: 0.4, max: 1, step: 0.05, decimals: 2, onChange: (v) => { out.quality = v; onChange(); } })),
      U.field('파일 이름', U.el('input', { type: 'text', value: out.filename, onInput: (e) => { out.filename = e.target.value; saveSoon(); } })),
      U.el('div', { class: 'hint', text: '저장 시 날짜·시각이 자동으로 붙습니다. 여러 장이면 뒤에 번호가 붙습니다.' }),
    ]),
  ]);
}

/* 템플릿 */
function panelTemplate(container, onChange) {
  const tpl = buildTemplateSection(() => buildSlotBar(onChange), () => buildSettings(container, onChange));
  return U.el('div', { class: 'panel' }, [tpl.node]);
}

/* ── 설정 초기화 ────────────────────────────── */
export function resetSettings() {
  Object.assign(state.text.style, clone(DEFAULT_STYLE));
  Object.assign(state.text.formats, clone(DEFAULT_FORMATS));
  Object.assign(state.output, clone(DEFAULT_OUTPUT));
  state.activeTemplate = null;
}

/* ── 편집기 동작 ────────────────────────────── */
function wrapSelection(open, close, onChange) {
  const ta = srcEl();
  const s = ta.selectionStart, e = ta.selectionEnd;
  const sel = ta.value.slice(s, e);

  // 선택한 덩어리가 마커를 품고 있으면 벗긴다
  if (sel.length >= open.length + close.length && sel.startsWith(open) && sel.endsWith(close)) {
    ta.setRangeText(sel.slice(open.length, sel.length - close.length), s, e, 'select');
  }
  // 마커가 선택 바로 바깥에 있어도 벗긴다
  else if (sel
    && ta.value.slice(Math.max(0, s - open.length), s) === open
    && ta.value.slice(e, e + close.length) === close) {
    ta.setRangeText(sel, s - open.length, e + close.length, 'select');
  }
  // 아니면 감싼다. 마커를 뺀 안쪽만 선택해 두어 한 번 더 누르면 해제되게 한다.
  else {
    const body = sel || '내용';
    ta.setRangeText(open + body + close, s, e, 'end');
    ta.setSelectionRange(s + open.length, s + open.length + body.length);
  }

  state.text.source = ta.value;
  ta.focus();
  onChange();
}

function prefixLines(prefix, onChange) {
  const ta = srcEl();
  const s = ta.selectionStart, e = ta.selectionEnd;
  const start = ta.value.lastIndexOf('\n', s - 1) + 1;
  const endNl = ta.value.indexOf('\n', e);
  const end = endNl === -1 ? ta.value.length : endNl;

  const lines = ta.value.slice(start, end).split('\n');
  const allHave = lines.every(l => l.startsWith(prefix));
  const next = lines
    .map(l => (allHave ? l.slice(prefix.length) : prefix + l.replace(/^\s*(#{1,2}\s+|>[1-5]?\s?)/, '')))
    .join('\n');

  ta.setRangeText(next, start, end, 'select');
  state.text.source = ta.value;
  ta.focus();
  onChange();
}

function insertFence(onChange) {
  const ta = srcEl();
  const s = ta.selectionStart, e = ta.selectionEnd;
  const sel = ta.value.slice(s, e) || '내용';
  const before = ta.value.slice(0, s);
  const lead = before.length && !before.endsWith('\n') ? '\n' : '';
  ta.setRangeText(`${lead}\`\`\`제목\n${sel}\n\`\`\`\n`, s, e, 'end');
  state.text.source = ta.value;
  ta.focus();
  onChange();
}

export function bindEditor(onChange) {
  const ta = srcEl();
  ta.value = state.text.source;

  ta.addEventListener('input', () => { state.text.source = ta.value; onChange(); });

  document.querySelectorAll('.fmt-btn[data-wrap]').forEach((btn) => {
    const m = btn.dataset.wrap;
    btn.addEventListener('click', () => wrapSelection(m, m, onChange));
  });

  document.querySelectorAll('.fmt-btn[data-prefix]').forEach((btn) => {
    btn.addEventListener('click', () => prefixLines(btn.dataset.prefix, onChange));
  });

  document.querySelector('.fmt-btn[data-fence]').addEventListener('click', () => insertFence(onChange));

  document.querySelectorAll('.fmt-btn[data-line]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mark = btn.dataset.line;
      const pos = ta.selectionStart;
      const before = ta.value.slice(0, pos);
      const insert = (before.length && !before.endsWith('\n') ? '\n' : '') + mark + '\n';
      ta.setRangeText(insert, pos, ta.selectionEnd, 'end');
      state.text.source = ta.value;
      ta.focus();
      onChange();
    });
  });

  document.getElementById('stripText').addEventListener('click', () => {
    const s = ta.selectionStart, e = ta.selectionEnd;
    if (s !== e) {
      ta.setRangeText(stripMarkers(ta.value.slice(s, e)), s, e, 'select');
    } else {
      if (!ta.value || !confirm('전체 글의 서식 마커를 걷어낼까요? 글자는 그대로 남습니다.')) return;
      ta.value = stripMarkers(ta.value);
    }
    state.text.source = ta.value;
    ta.focus();
    onChange();
  });

  document.getElementById('clearText').addEventListener('click', () => {
    if (ta.value && !confirm('내용을 모두 지울까요? 서식 설정은 그대로 남습니다.')) return;
    ta.value = '';
    state.text.source = '';
    onChange();
    ta.focus();
  });
}
