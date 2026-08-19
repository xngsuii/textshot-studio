/* 텍스트 발췌 탭 */

import { state, saveSoon, FONTS, fontById, DEFAULT_FORMATS } from './store.js';
import { splitChunks, hasSplit, renderChunk, renderWithSplitMarks, stripMarkers } from './markup.js';
import { ensureFont, isAvailable } from './fonts.js';
import { buildTemplateSection } from './templates.js';
import * as U from './ui.js';

const srcEl = () => document.getElementById('src');

/* ── 스타일을 스테이지에 입힌다 ─────────────── */
function applyStyle(stage) {
  const st = state.text.style;
  const f = fontById(st.font);
  ensureFont(st.font);

  Object.assign(stage.style, {
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
    wordBreak: 'keep-all',
    overflowWrap: 'anywhere',
  });

  const v = {
    '--c-action': st.actionColor,
    '--c-quote': st.quoteColor,
    '--c-paren': st.parenColor,
    '--c-divider': st.dividerColor,
    '--c-heading': st.headingColor,
    '--c-bq': st.bqColor,
    '--c-code-bg': st.codeBg,
    '--c-code-fg': st.codeFg,
    '--c-code-title': st.codeTitleColor,
  };
  for (const [k, val] of Object.entries(v)) stage.style.setProperty(k, val);
  (st.colorSlots || []).forEach((c, i) => stage.style.setProperty(`--c-slot${i + 1}`, c));
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
  (state.text.style.colorSlots || []).forEach((c, i) => {
    const n = i + 1;
    const btn = U.el('button', {
      class: 'fmt-btn slot-btn', type: 'button', title: `색 ${n} — 선택한 글자에 이 색을 입힙니다`,
      onClick: () => wrapSelection(`{c${n} `, '}', onChange),
    }, [U.el('span', { class: 'slot-dot' }), U.el('span', { text: `색${n}` })]);
    btn.querySelector('.slot-dot').style.background = c;
    bar.appendChild(btn);
  });
}

/* ── 설정 패널 ──────────────────────────────── */
export function buildSettings(container, onChange) {
  const st = state.text.style;
  const fm = state.text.formats;
  const out = state.output;
  const touch = () => { state.activeTemplate = null; onChange(); };
  const rebuild = () => buildSettings(container, onChange);

  container.textContent = '';

  /* 자동 서식 */
  const FORMAT_LABELS = [
    ['bold', '굵게  **글자**'],
    ['action', '행동지문  *글자*'],
    ['italic', '기울임  _글자_'],
    ['quote', '대사  "글자"'],
    ['paren', '괄호  (글자)'],
    ['heading', '제목  #  ##'],
    ['blockquote', '인용구  >'],
    ['code', '코드블럭  ```'],
    ['divider', '구분선  ---'],
  ];
  container.appendChild(U.section('자동 서식', true, [
    ...FORMAT_LABELS.map(([k, label]) =>
      U.fieldWide(U.check(label, fm[k], (v) => { fm[k] = v; onChange(); }))),
    U.fieldWide(U.el('div', { class: 'field-row' }, [
      U.el('button', {
        class: 'btn btn-ghost btn-sm', type: 'button', text: '모두 켜기',
        onClick: () => { Object.assign(fm, DEFAULT_FORMATS); rebuild(); onChange(); },
      }),
      U.el('button', {
        class: 'btn btn-ghost btn-sm', type: 'button', text: '모두 끄기',
        onClick: () => { for (const k of Object.keys(fm)) fm[k] = false; rebuild(); onChange(); },
      }),
    ])),
    U.fieldWide(U.el('div', { class: 'hint', text: '분할선 === 은 이 설정과 무관하게 늘 동작합니다.' })),
  ]));

  /* 본문 */
  const fontSel = U.select(st.font, FONTS.map(f => [f.id, f.label]), (v) => { st.font = v; touch(); });
  FONTS.filter(f => f.source === 'local').forEach(async (f) => {
    if (await isAvailable(f.id)) return;
    const opt = [...fontSel.options].find(o => o.value === f.id);
    if (opt) opt.textContent = `${f.label} — 파일 없음`;
  });

  container.appendChild(U.section('본문', true, [
    U.field('폰트', fontSel),
    U.field('크기', U.stepper(st.fontSize, { min: 8, max: 96, step: 1, unit: 'px', onChange: (v) => { st.fontSize = v; touch(); } })),
    U.field('행간', U.stepper(st.lineHeight, { min: 0.8, max: 5, step: 0.5, decimals: 2, onChange: (v) => { st.lineHeight = v; touch(); } })),
    U.field('자간', U.stepper(st.letterSpacing, { min: -3, max: 10, step: 0.5, decimals: 1, unit: 'px', onChange: (v) => { st.letterSpacing = v; touch(); } })),
    U.field('문단 간격', U.stepper(st.paraGap, { min: 0, max: 80, step: 1, unit: 'px', onChange: (v) => { st.paraGap = v; touch(); } })),
    U.field('정렬', U.seg(st.align, [['left', '왼쪽'], ['center', '가운데'], ['justify', '양쪽']], (v) => { st.align = v; touch(); })),
    U.fieldWide(U.el('div', { class: 'hint', text: '숫자를 직접 입력해도 됩니다. 버튼은 크기 1px, 행간 0.5, 자간 0.5씩 움직입니다.' })),
  ]));

  /* 색상 */
  container.appendChild(U.section('색상', false, [
    U.field('배경', U.color(st.bg, (v) => { st.bg = v; touch(); })),
    U.field('글자', U.color(st.fg, (v) => { st.fg = v; touch(); })),
    U.field('제목', U.color(st.headingColor, (v) => { st.headingColor = v; touch(); })),
    U.field('행동지문', U.color(st.actionColor, (v) => { st.actionColor = v; touch(); })),
    U.field('대사', U.color(st.quoteColor, (v) => { st.quoteColor = v; touch(); })),
    U.field('괄호', U.color(st.parenColor, (v) => { st.parenColor = v; touch(); })),
    U.field('인용구', U.color(st.bqColor, (v) => { st.bqColor = v; touch(); })),
    U.field('구분선', U.color(st.dividerColor, (v) => { st.dividerColor = v; touch(); })),
    U.fieldWide(U.check('배경 투명 (PNG 저장 시에만 적용)', st.transparent, (v) => { st.transparent = v; touch(); })),
  ]));

  /* 색 슬롯 */
  container.appendChild(U.section('색 슬롯', false, [
    ...(st.colorSlots || []).map((c, i) => U.field(`색 ${i + 1}`, U.color(c, (v) => {
      st.colorSlots[i] = v;
      buildSlotBar(onChange);
      touch();
    }))),
    U.fieldWide(U.el('div', { class: 'hint', text: '입력칸 위의 「색1~색5」 버튼이 이 색을 씁니다. 대사마다 다른 색을 주고 싶을 때 쓰세요.' })),
  ]));

  /* 코드블럭 */
  container.appendChild(U.section('코드블럭', false, [
    U.field('배경', U.color(st.codeBg, (v) => { st.codeBg = v; touch(); })),
    U.field('글자', U.color(st.codeFg, (v) => { st.codeFg = v; touch(); })),
    U.field('제목', U.color(st.codeTitleColor, (v) => { st.codeTitleColor = v; touch(); })),
    U.fieldWide(U.el('div', { class: 'hint', text: '```제목 으로 열고 ``` 으로 닫습니다. 제목은 없어도 됩니다.' })),
  ]));

  /* 크기·여백 */
  container.appendChild(U.section('크기 · 여백', false, [
    U.field('너비', U.stepper(st.width, { min: 200, max: 4000, step: 10, unit: 'px', onChange: (v) => { st.width = v; touch(); } })),
    U.fieldWide(U.el('div', { class: 'hint', text: '높이는 글 길이에 맞춰 자동으로 늘어납니다.' })),
    U.fieldWide(U.check('네 방향 동일', st.padLinked, (v) => { st.padLinked = v; })),
    U.fieldWide(U.padGrid(st, ['padTop', 'padRight', 'padBottom', 'padLeft'], () => st.padLinked, touch)),
    U.fieldWide(U.el('div', { class: 'hint', text: '분할하면 각 장에 이 여백이 새로 들어갑니다.' })),
  ]));

  /* 출력 */
  const qualityField = U.field('품질', U.stepper(out.quality, { min: 0.4, max: 1, step: 0.05, decimals: 2, onChange: (v) => { out.quality = v; onChange(); } }));
  qualityField.style.display = out.format === 'png' ? 'none' : '';

  container.appendChild(U.section('출력', false, [
    U.field('배율', U.seg(String(out.scale), [['1', '1x'], ['2', '2x'], ['3', '3x']], (v) => { out.scale = parseInt(v, 10); onChange(); })),
    U.field('포맷', U.seg(out.format, [['png', 'PNG'], ['jpg', 'JPG'], ['webp', 'WebP']], (v) => {
      out.format = v;
      qualityField.style.display = v === 'png' ? 'none' : '';
      onChange();
    })),
    qualityField,
    U.field('파일 이름', U.el('input', { type: 'text', value: out.filename, onInput: (e) => { out.filename = e.target.value; saveSoon(); } })),
    U.fieldWide(U.el('div', { class: 'hint', text: '저장 시 날짜·시각이 자동으로 붙습니다. 여러 장이면 뒤에 번호가 붙습니다.' })),
  ]));

  /* 템플릿 */
  const tpl = buildTemplateSection(() => buildSlotBar(onChange), rebuild);
  container.appendChild(U.section('템플릿', false, [tpl.node]));
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

  const block = ta.value.slice(start, end);
  const lines = block.split('\n');
  const allHave = lines.every(l => l.startsWith(prefix));
  const next = lines
    .map(l => (allHave ? l.slice(prefix.length) : prefix + l.replace(/^\s*(#{1,2}\s+|>\s?)/, '')))
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
