/* 텍스트 발췌 탭 */

import { state, saveSoon, FONTS, fontById } from './store.js';
import { splitChunks, hasSplit, renderChunk, renderWithSplitMarks } from './markup.js';
import { ensureFont, isAvailable } from './fonts.js';
import { buildTemplateSection } from './templates.js';
import * as U from './ui.js';

const srcEl = () => document.getElementById('src');

let onChangeHook = () => {};
let tplSection = null;

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
  stage.style.setProperty('--c-action', st.actionColor);
  stage.style.setProperty('--c-quote', st.quoteColor);
  stage.style.setProperty('--c-divider', st.dividerColor);
}

function makeStage(html) {
  const stage = U.el('div', { class: 'stage' });
  stage.innerHTML = html;
  applyStyle(stage);
  return stage;
}

/* 저장될 조각들. 분할선이 있으면 그 수만큼. */
export function buildExportStages() {
  const src = state.text.source;
  const auto = state.text.autoFormat;
  return splitChunks(src).map(c => makeStage(renderChunk(c, auto)));
}

/* ── 미리보기 ───────────────────────────────── */
export function renderPreview(host) {
  const src = state.text.source;
  const auto = state.text.autoFormat;
  const split = hasSplit(src);

  document.getElementById('splitSeg').hidden = !split;

  host.textContent = '';
  const stages = (split && state.splitView === 'after')
    ? splitChunks(src).map(c => makeStage(renderChunk(c, auto)))
    : [makeStage(split ? renderWithSplitMarks(src, auto) : renderChunk(src, auto))];

  stages.forEach((s, i) => {
    const wrap = U.el('div', { class: 'stage-wrap' }, [s]);
    if (stages.length > 1) wrap.appendChild(U.el('div', { class: 'stage-label', text: `${i + 1} / ${stages.length}` }));
    host.appendChild(wrap);
  });

  return stages;
}

/* ── 설정 패널 ──────────────────────────────── */
export function buildSettings(container, onChange) {
  onChangeHook = onChange;
  const st = state.text.style;
  const out = state.output;
  const touch = () => { state.activeTemplate = null; onChange(); };

  container.textContent = '';

  /* 본문 */
  const fontSel = U.select(st.font, FONTS.map(f => [f.id, f.label]), (v) => { st.font = v; touch(); });
  FONTS.filter(f => f.source === 'local').forEach(async (f) => {
    const ok = await isAvailable(f.id);
    if (ok) return;
    const opt = [...fontSel.options].find(o => o.value === f.id);
    if (opt) opt.textContent = `${f.label} — 파일 없음`;
  });

  container.appendChild(U.section('본문', true, [
    U.fieldWide(U.check('자동 서식 적용  ** *  " _  ---', state.text.autoFormat, (v) => { state.text.autoFormat = v; onChange(); })),
    U.field('폰트', fontSel),
    U.field('크기', U.range(st.fontSize, { min: 10, max: 48, step: 0.5, unit: 'px', onChange: (v) => { st.fontSize = v; touch(); } })),
    U.field('행간', U.range(st.lineHeight, { min: 1.1, max: 3, step: 0.05, unit: '', onChange: (v) => { st.lineHeight = v; touch(); } })),
    U.field('자간', U.range(st.letterSpacing, { min: -1.5, max: 4, step: 0.1, unit: 'px', onChange: (v) => { st.letterSpacing = v; touch(); } })),
    U.field('문단 간격', U.range(st.paraGap, { min: 0, max: 60, step: 1, unit: 'px', onChange: (v) => { st.paraGap = v; touch(); } })),
    U.field('정렬', U.seg(st.align, [['left', '왼쪽'], ['center', '가운데'], ['justify', '양쪽']], (v) => { st.align = v; touch(); })),
  ]));

  /* 색상 */
  container.appendChild(U.section('색상', false, [
    U.field('배경', U.color(st.bg, (v) => { st.bg = v; touch(); })),
    U.field('글자', U.color(st.fg, (v) => { st.fg = v; touch(); })),
    U.field('행동지문', U.color(st.actionColor, (v) => { st.actionColor = v; touch(); })),
    U.field('대사', U.color(st.quoteColor, (v) => { st.quoteColor = v; touch(); })),
    U.field('구분선', U.color(st.dividerColor, (v) => { st.dividerColor = v; touch(); })),
    U.fieldWide(U.check('배경 투명 (PNG 저장 시에만 적용)', st.transparent, (v) => { st.transparent = v; touch(); })),
  ]));

  /* 크기·여백 */
  container.appendChild(U.section('크기 · 여백', false, [
    U.field('너비', U.num(st.width, { min: 200, max: 4000, step: 10, onChange: (v) => { st.width = v; touch(); } })),
    U.fieldWide(U.el('div', { class: 'hint', text: '높이는 글 길이에 맞춰 자동으로 늘어납니다.' })),
    U.fieldWide(U.check('네 방향 동일', st.padLinked, (v) => { st.padLinked = v; })),
    U.fieldWide(U.padGrid(st, ['padTop', 'padRight', 'padBottom', 'padLeft'], () => st.padLinked, touch)),
    U.fieldWide(U.el('div', { class: 'hint', text: '분할하면 각 장에 이 여백이 새로 들어갑니다.' })),
  ]));

  /* 출력 */
  const qualityField = U.field('품질', U.range(out.quality, { min: 0.5, max: 1, step: 0.02, unit: '', onChange: (v) => { out.quality = v; onChange(); } }));
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
  tplSection = buildTemplateSection(() => {}, () => buildSettings(container, onChange));
  container.appendChild(U.section('템플릿', false, [tplSection.node]));
}

/* ── 편집기 동작 ────────────────────────────── */
export function bindEditor(onChange) {
  const ta = srcEl();
  ta.value = state.text.source;

  ta.addEventListener('input', () => {
    state.text.source = ta.value;
    onChange();
  });

  /* 선택 영역을 마커로 감싼다 */
  document.querySelectorAll('.fmt-btn[data-wrap]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mark = btn.dataset.wrap;
      const s = ta.selectionStart, e = ta.selectionEnd;
      const sel = ta.value.slice(s, e) || '내용';
      ta.setRangeText(mark + sel + mark, s, e, 'select');
      if (!ta.value.slice(s, e)) ta.setSelectionRange(s + mark.length, s + mark.length + sel.length);
      state.text.source = ta.value;
      ta.focus();
      onChange();
    });
  });

  /* 줄 단위 마커 삽입 */
  document.querySelectorAll('.fmt-btn[data-line]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mark = btn.dataset.line;
      const pos = ta.selectionStart;
      const before = ta.value.slice(0, pos);
      const needsNl = before.length && !before.endsWith('\n');
      const insert = (needsNl ? '\n' : '') + mark + '\n';
      ta.setRangeText(insert, pos, ta.selectionEnd, 'end');
      state.text.source = ta.value;
      ta.focus();
      onChange();
    });
  });

  document.getElementById('clearText').addEventListener('click', () => {
    if (ta.value && !confirm('내용을 모두 지울까요? 서식 설정은 그대로 남습니다.')) return;
    ta.value = '';
    state.text.source = '';
    onChange();
    ta.focus();
  });
}
