/* 텍스트 발췌 탭 */

import {
  state, saveSoon, FONTS, fontById, DEFAULT_FORMATS, DEFAULT_STYLE,
  DEFAULT_OUTPUT, RATIOS, RATIO_ORDER, RATIO_LABEL, MAX_SLOTS, newProfile, NAME_COLOR,
} from './store.js';
import {
  splitChunks, hasSplit, renderChunk, renderWithSplitMarks, stripMarkers,
  imageOrder, removeImageMarker, chunkOffsets, setSpeakerAt, speakerNameAt,
  renameSpeaker, NAME_SEP,
} from './markup.js';
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

  // 비율을 정하면 남는 세로 공간이 생긴다. 글을 위에 붙이지 않고 가운데 둔다.
  // (가로 정렬은 textAlign 그대로) 글이 더 길면 캔버스가 늘어나 영향이 없다.
  const r = RATIOS[st.ratio];
  stage.style.minHeight = r ? Math.round(st.width * r) + 'px' : '';
  stage.style.justifyContent = r ? 'center' : '';

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

  stage.style.setProperty('--b-radius', st.bubbleRadius + 'px');
  stage.style.setProperty('--b-gap', st.bubbleGap + 'px');
  stage.style.setProperty('--b-max', st.bubbleMaxWidth + '%');
  stage.style.setProperty('--b-pad-v', st.bubblePadV + 'px');
  stage.style.setProperty('--b-pad-h', st.bubblePadH + 'px');

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

function renderOpts() {
  const st = state.text.style;
  return {
    formats: state.text.formats,
    images: state.text.images,
    profiles: state.text.profiles,
    chat: { hideQuotesInBubble: state.text.style.hideQuotesInBubble },
  };
}

export function buildExportStages() {
  const opts = renderOpts();
  const offs = chunkOffsets(state.text.source);
  return splitChunks(state.text.source).map((c, i) => makeStage(renderChunk(c, opts, offs[i])));
}

/* ── 미리보기 ───────────────────────────────── */
export function renderPreview(host) {
  const src = state.text.source;
  const f = state.text.formats;
  const split = hasSplit(src);

  document.getElementById('splitSeg').hidden = !split;

  const opts = renderOpts();
  host.textContent = '';
  const offs = chunkOffsets(src);
  const stages = (split && state.splitView === 'after')
    ? splitChunks(src).map((c, i) => makeStage(renderChunk(c, opts, offs[i])))
    : [makeStage(split ? renderWithSplitMarks(src, opts) : renderChunk(src, opts))];

  stages.forEach((s, i) => {
    const wrap = U.el('div', { class: 'stage-wrap' }, [s]);
    if (stages.length > 1) wrap.appendChild(U.el('div', { class: 'stage-label', text: `${i + 1} / ${stages.length}` }));
    host.appendChild(wrap);
  });

  return stages;
}

/* 미리보기에서 말풍선을 누르면 다음 프로필로 넘어간다.
   말풍선끼리만 오가고 지문은 건드리지 않는다. */
export function bindPreviewClicks(host, onChange) {
  host.addEventListener('click', (e) => {
    const el = e.target.closest('.mk-bubble[data-ln]');
    if (!el || !host.contains(el)) return;

    const profiles = state.text.profiles;
    if (profiles.length < 2) return;

    const ln = parseInt(el.dataset.ln, 10);
    const cur = speakerNameAt(state.text.source, ln, profiles);
    const idx = profiles.findIndex(p => p.name === cur);
    if (idx < 0) return;

    const next = profiles[(idx + 1) % profiles.length].name;
    state.text.source = setSpeakerAt(state.text.source, ln, next, profiles);
    srcEl().value = state.text.source;
    onChange();
  });
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

/* ── 화자 버튼 (입력칸 위) ──────────────────── */
export function buildProfileBar(onChange) {
  const bar = document.getElementById('profileBar');
  bar.textContent = '';
  state.text.profiles.forEach((p) => {
    const btn = U.el('button', {
      class: 'fmt-btn slot-btn', type: 'button',
      title: `${p.name} — 고른 줄을 이 프로필의 말풍선으로 (다시 누르면 해제)`,
      onClick: () => applySpeaker(p.name, onChange),
    }, [
      U.el('span', { class: 'slot-dot' }),
      U.el('span', { text: p.name || '이름 없음' }),
    ]);
    const dot = btn.querySelector('.slot-dot');
    if (p.bubbleBg === 'transparent') dot.classList.add('is-clear');
    else dot.style.background = p.bubbleBg;
    bar.appendChild(btn);
  });
}

/* 고른 줄들 앞에 「이름 | 」을 붙인다. 이미 그 프로필이면 떼어낸다. */
function applySpeaker(name, onChange) {
  if (!name) return;
  const ta = srcEl();
  const s = ta.selectionStart, e = ta.selectionEnd;
  const start = ta.value.lastIndexOf('\n', s - 1) + 1;
  const endNl = ta.value.indexOf('\n', e);
  const end = endNl === -1 ? ta.value.length : endNl;

  const profiles = state.text.profiles;
  const label = (n) => new RegExp(`^${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\|\\s?`);
  const lines = ta.value.slice(start, end).split('\n');
  const allMine = lines.every(l => label(name).test(l.trimStart()));

  const next = lines.map((l) => {
    const indent = l.match(/^\s*/)[0];
    let body = l.trimStart();
    for (const p of profiles) {              // 다른 이름표가 있으면 먼저 뗀다
      if (p.name && label(p.name).test(body)) { body = body.replace(label(p.name), ''); break; }
    }
    return allMine ? indent + body : `${indent}${name} ${NAME_SEP} ${body}`;
  }).join('\n');

  ta.setRangeText(next, start, end, 'select');
  state.text.source = ta.value;
  ta.focus();
  onChange();
}

/* ── 설정 패널 ──────────────────────────────── */
const ICON = {
  format: '<path d="M8 2v12M2 8h12M4.2 4.2l7.6 7.6M11.8 4.2l-7.6 7.6"/>',
  body: '<path d="M2.5 4h11M2.5 8h7M2.5 12h9"/>',
  canvas: '<rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/><path d="M2.5 10.5l3-2.5 3 2.2 2.5-2 2.5 2"/>',
  chat: '<path d="M2.5 4.2a1.7 1.7 0 0 1 1.7-1.7h7.6a1.7 1.7 0 0 1 1.7 1.7v4.6a1.7 1.7 0 0 1-1.7 1.7H6.4L3.4 13V10.5h-.9z"/>',
  color: '<path d="M8 2.2c2.7 3.3 4 5.2 4 6.9a4 4 0 0 1-8 0c0-1.7 1.3-3.6 4-6.9z"/>',
  output: '<path d="M8 2.5v7.5M5 7.2L8 10.2l3-3M2.8 13.2h10.4"/>',
  template: '<path d="M8 2.4l1.8 3.8 4.1.6-3 2.9.7 4.1L8 11.8l-3.6 1.9.7-4.1-3-2.9 4.1-.6z"/>',
};

const SET_TABS = [
  ['body', '본문·간격'],
  ['canvas', '캔버스'],
  ['color', '색상'],
  ['chat', '말풍선'],
  ['format', '자동 서식'],
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
  chat: panelChat,
  output: panelOutput,
  template: panelTemplate,
};

/* 말풍선 — 화자 프로필과 공통 모양 */
function panelChat(container, onChange) {
  const st = state.text.style;
  const ps = state.text.profiles;
  const touch = () => { state.activeTemplate = null; onChange(); };
  const rebuild = () => buildSettings(container, onChange);

  const cards = ps.map((p, i) => {
    const avatarInput = U.el('input', {
      type: 'file', accept: 'image/*', style: 'display:none',
      onChange: (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        const fr = new FileReader();
        fr.onload = () => { p.avatar = fr.result; U.closePopup(); rebuild(); touch(); };
        fr.readAsDataURL(file);
      },
    });

    const face = p.avatar
      ? (() => { const im = U.el('img', { class: 'prof-face', alt: '' }); im.src = p.avatar; return im; })()
      : U.el('span', { class: 'prof-face prof-face-blank', text: (p.name || '?').slice(0, 1) });
    if (!p.avatar && p.avatarColor) face.style.background = p.avatarColor;

    // 프로필 사진을 누르면 사진·컬러·초기화를 고르는 차림표가 열린다
    const faceBtn = U.el('button', {
      class: 'prof-face-btn', type: 'button', title: '프로필 사진',
    }, [face]);
    faceBtn.addEventListener('click', () => {
      const swatch = U.el('input', {
        type: 'color', class: 'popup-swatch', value: p.avatarColor || '#C9CED4',
        onInput: (e) => {
          p.avatarColor = e.target.value;
          face.style.background = e.target.value;
          touch();
        },
      });
      U.popup(faceBtn, [
        U.popupRow('사진', { onClick: () => { avatarInput.click(); U.closePopup(); } }),
        U.popupRow('컬러', { control: swatch }),
        U.popupRow('초기화', {
          danger: true,
          onClick: () => { p.avatar = ''; p.avatarColor = ''; U.closePopup(); rebuild(); touch(); },
        }),
      ]);
    });

    return U.el('div', { class: 'prof-card' }, [
      U.el('div', { class: 'prof-head' }, [
        faceBtn,
        U.el('input', {
          type: 'text', class: 'prof-name', value: p.name, placeholder: '이름',
          onInput: (e) => {
            const old = p.name;
            const next = e.target.value;
            // 본문에 이미 쓰인 이름표도 같이 바꿔 준다
            if (old && next) {
              state.text.source = renameSpeaker(state.text.source, old, next, ps);
              srcEl().value = state.text.source;
            }
            p.name = next;
            buildProfileBar(onChange);
            touch();
          },
        }),
        U.el('button', {
          class: 'prof-x', type: 'button', text: '×', title: '이 프로필 삭제',
          onClick: () => {
            if (ps.length <= 1) { U.toast('프로필은 하나 이상 있어야 합니다'); return; }
            U.closePopup();
            state.text.profiles = ps.filter(x => x !== p);
            buildProfileBar(onChange); rebuild(); touch();
          },
        }),
        avatarInput,
      ]),
      U.el('div', { class: 'prof-body' }, [
        U.field('위치', U.seg(p.side, [['left', '왼쪽'], ['right', '오른쪽']], (v) => { p.side = v; touch(); })),
        U.colorGrid(2, [
          U.colorCellClear('말풍선', p.bubbleBg, '#EFF1F1', (v) => { p.bubbleBg = v; buildProfileBar(onChange); touch(); }),
          U.colorCell('글자', p.textColor, (v) => { p.textColor = v; touch(); }),
          U.colorCell('이름', p.nameColor || NAME_COLOR, (v) => { p.nameColor = v; touch(); }),
          U.colorCell('따옴표', p.quoteColor || p.textColor, (v) => { p.quoteColor = v; touch(); }),
          U.colorCell('괄호', p.parenColor || p.textColor, (v) => { p.parenColor = v; touch(); }),
        ]),
        U.el('div', { class: 'prof-toggles' }, [
          U.check('이름 표시', p.showName, (v) => { p.showName = v; touch(); }),
          U.check('사진 표시', p.showAvatar, (v) => { p.showAvatar = v; touch(); }),
        ]),
      ]),
    ]);
  });

  return U.el('div', { class: 'panel' }, [
    group('프로필', [
      U.el('div', { class: 'prof-grid' }, cards),
      U.el('div', { class: 'field-row' }, [
        U.el('button', {
          class: 'btn btn-ghost btn-sm', type: 'button',
          text: `프로필 추가 (${ps.length})`,
          onClick: () => {
            ps.push(newProfile(ps.length + 1));
            buildProfileBar(onChange); rebuild(); touch();
          },
        }),
      ]),
      U.el('div', { class: 'hint', text: '본문에서 「이름 | 내용」으로 쓰면 말풍선이 됩니다. 미리보기에서 말풍선을 누르면 다음 프로필로 넘어갑니다.' }),
    ]),
    group('모양', [
      U.field('최대 폭', U.stepper(st.bubbleMaxWidth, { min: 30, max: 100, step: 2, unit: '%', onChange: (v) => { st.bubbleMaxWidth = v; touch(); } })),
      U.field('모서리', U.stepper(st.bubbleRadius, { min: 0, max: 40, step: 1, unit: 'px', onChange: (v) => { st.bubbleRadius = v; touch(); } })),
      U.field('말풍선 간격', U.stepper(st.bubbleGap, { min: 0, max: 40, step: 1, unit: 'px', onChange: (v) => { st.bubbleGap = v; touch(); } })),
      U.field('안쪽 여백', U.el('div', { class: 'field-row' }, [
        U.stepper(st.bubblePadV, { min: 0, max: 40, step: 1, unit: '↕', onChange: (v) => { st.bubblePadV = v; touch(); } }),
        U.stepper(st.bubblePadH, { min: 0, max: 40, step: 1, unit: '↔', onChange: (v) => { st.bubblePadH = v; touch(); } }),
      ])),
      U.check('말풍선 안 따옴표 감추기', st.hideQuotesInBubble, (v) => { st.hideQuotesInBubble = v; touch(); }),
      U.el('div', { class: 'hint', text: '따옴표를 감춰도 따옴표 색은 그대로 입혀집니다. 프로필 사진 크기는 글자 크기에 맞춰 함께 움직입니다.' }),
    ]),
  ]);
}

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

/* 본문에 넣은 사진 — 순서는 글 안의 마커 순서를 그대로 따른다.
   자리를 옮기려면 편집기에서 [[img:…]] 줄을 옮기면 된다. 여기서는
   크기와 빼기만 다룬다. */
function photoList(container, onChange) {
  const rebuild = () => buildSettings(container, onChange);
  const byId = new Map(state.text.images.map(im => [im.id, im]));
  const rows = imageOrder(state.text.source).map(id => byId.get(id)).filter(Boolean);

  const list = U.el('div', { class: 'photo-list' }, rows.map((im, i) => U.el('div', { class: 'photo-row' }, [
    U.el('span', { class: 'photo-no', text: String(i + 1) }),
    (() => { const t = U.el('img', { class: 'photo-thumb', alt: '' }); t.src = im.data; return t; })(),
    U.el('div', { class: 'photo-w' }, [
      U.stepper(im.width ?? 100, {
        min: 10, max: 100, step: 5, unit: '%',
        onChange: (v) => { im.width = v; onChange(); },
      }),
    ]),
    U.el('button', {
      class: 'photo-x', type: 'button', text: '×', title: '사진 빼기',
      onClick: () => {
        state.text.source = removeImageMarker(state.text.source, im.id);
        state.text.images = state.text.images.filter(x => x.id !== im.id);
        srcEl().value = state.text.source;
        rebuild(); onChange();
      },
    }),
  ])));

  return U.el('div', { style: 'display:flex;flex-direction:column;gap:8px' }, [
    rows.length ? list : U.el('div', { class: 'empty', text: '아직 넣은 사진이 없습니다.' }),
    U.el('div', { class: 'field-row' }, [
      U.el('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: '사진 넣기', onClick: () => pickImage(onChange, rebuild) }),
    ]),
    U.el('div', { class: 'hint', text: '자리를 옮기려면 편집기에서 [[img:…]] 줄을 원하는 곳으로 옮기세요.' }),
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
      U.field('비율', U.seg(st.ratio, RATIO_ORDER.map(r => [r, RATIO_LABEL[r] || r]), (v) => { st.ratio = v; touch(); })),
      U.el('div', { class: 'hint', text: '비율을 고르면 그 높이가 최소 높이가 됩니다. 글이 더 길면 잘리지 않고 아래로 늘어납니다.' }),
    ]),
    group('본문 사진', [photoList(container, onChange)]),
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
      U.colorGrid(2, [
        U.colorCell('글자', st.fg, (v) => { st.fg = v; touch(); }),
        U.colorCell('제목', st.headingColor, (v) => { st.headingColor = v; touch(); }),
        U.colorCell('행동지문', st.actionColor, (v) => { st.actionColor = v; touch(); }),
        U.colorCell('대사', st.quoteColor, (v) => { st.quoteColor = v; touch(); }),
        U.colorCell('괄호', st.parenColor, (v) => { st.parenColor = v; touch(); }),
        U.colorCell('형광펜', st.hlColor, (v) => { st.hlColor = v; touch(); }),
        U.colorCell('인용구', st.bqColor, (v) => { st.bqColor = v; touch(); }),
        U.colorCell('구분선', st.dividerColor, (v) => { st.dividerColor = v; touch(); }),
      ]),
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
      U.colorGrid(3, [
        U.colorCell('배경', st.codeBg, (v) => { st.codeBg = v; touch(); }),
        U.colorCell('글자', st.codeFg, (v) => { st.codeFg = v; touch(); }),
        U.colorCell('제목', st.codeTitleColor, (v) => { st.codeTitleColor = v; touch(); }),
      ]),
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

/* ── 사진 넣기 ──────────────────────────────── */
let pickerEl = null;

export function pickImage(onChange, afterAdd) {
  if (!pickerEl) {
    pickerEl = U.el('input', { type: 'file', accept: 'image/*', style: 'display:none' });
    document.body.appendChild(pickerEl);
  }
  pickerEl.onchange = () => {
    const file = pickerEl.files?.[0];
    pickerEl.value = '';
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => {
      const id = Math.random().toString(36).slice(2, 9);
      state.text.images.push({ id, data: fr.result, width: 100 });

      const ta = srcEl();
      const pos = ta.selectionStart;
      const before = ta.value.slice(0, pos);
      const lead = before.length && !before.endsWith('\n') ? '\n' : '';
      ta.setRangeText(`${lead}[[img:${id}]]\n`, pos, ta.selectionEnd, 'end');
      state.text.source = ta.value;

      afterAdd?.();
      onChange();
    };
    fr.readAsDataURL(file);
  };
  pickerEl.click();
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

  document.getElementById('insertImage').addEventListener('click', () => {
    pickImage(onChange, () => {
      srcEl().focus();
      buildSettings(document.getElementById('textSettings'), onChange);
    });
  });

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
