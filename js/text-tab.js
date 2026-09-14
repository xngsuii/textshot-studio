/* 텍스트 발췌 탭 */

import {
  state, saveSoon, FONTS, fontById, DEFAULT_FORMATS, DEFAULT_STYLE,
  DEFAULT_OUTPUT, RATIOS, RATIO_ORDER, RATIO_LABEL, MAX_SLOTS, newProfile, NAME_COLOR,
  fontHasWeight,
  storedBytes, photoStats, photoUsage, dropTemplatePhotos, clearStored,
} from './store.js?v=60';
import {
  splitChunks, hasSplit, renderChunk, renderWithSplitMarks, stripMarkers,
  imageOrder, removeImageMarker, chunkOffsets, setSpeakerAt, speakerNameAt,
  renameSpeaker, NAME_SEP, noteOrder, removeNoteMarker,
} from './markup.js?v=60';
import { ensureFont, isAvailable } from './fonts.js?v=60';
import { SKINS, skinById, skinProfiles, skinStyle, resolve, CHIPS } from './skins.js?v=60';
import { buildTemplateSection } from './templates.js?v=60';
import { extract as extractMeta } from './png-meta.js?v=60';
import {
  isPayload, applyPayload, summarize, commonWarnings, textOnlyWarnings,
} from './doc-io.js?v=60';
import * as U from './ui.js?v=60';

const srcEl = () => document.getElementById('src');
const clone = (o) => JSON.parse(JSON.stringify(o));

/* 탭마다 되돌릴 설정. 여기 없는 것(써 둔 글·사진·프로필·서명 글자)은
   설정이 아니라 내용이므로 건드리지 않는다. */
const TAB_RESET = {
  body: {
    label: '본문·간격',
    keys: ['font', 'fontSize', 'lineHeight', 'letterSpacing', 'align', 'paraGap', 'squeeze',
      'breakMode', 'dropCap', 'dropCapLines', 'dropCapWeight', 'dropCapFont', 'dropCapColor',
      'dropCapKind', 'dropCapScope',
      'dividerStyle', 'bqBar',
      'h1Font', 'h1Size', 'h1Align', 'h1Bold', 'h2Font', 'h2Size', 'h2Align', 'h2Bold'],
    note: '넣어 둔 본문 사진은 그대로 둡니다.',
  },
  canvas: {
    label: '캔버스',
    keys: ['width', 'ratio', 'autoSplit', 'columns', 'columnGap',
      'padTop', 'padRight', 'padBottom', 'padLeft', 'padLinked',
      'bgMode', 'bg', 'bg2', 'bgImage', 'bgFit', 'bgOpacity', 'bgX', 'bgY', 'bgBlur',
      'bgAsHeader', 'bgHeaderH', 'transparent',
      'signOn', 'signSep', 'signAlign', 'signSize', 'signGap', 'signColor'],
    note: '깔아 둔 배경 사진도 빠집니다. 서명에 적어 둔 이름은 그대로 둡니다.',
  },
  color: {
    label: '색상',
    keys: ['fg', 'actionColor', 'quoteColor', 'parenColor', 'dividerColor', 'fnColor', 'headingColor',
      'bqColor', 'hlColor', 'codeBg', 'codeFg', 'codeTitleColor', 'slots'],
    note: '색 슬롯의 이름과 색도 기본값으로 돌아갑니다.',
  },
  chat: {
    label: '말풍선',
    keys: ['skin', 'bubbleStyle', 'avatarShape', 'avatarSize', 'bubbleRadius', 'bubbleAlpha',
      'bubbleGap', 'bubbleInGap', 'nameGap', 'nameBold', 'bubbleMaxWidth', 'bubblePadV', 'bubblePadH',
      'hideQuotesInBubble', 'parenBreakInBubble'],
    note: '프로필의 이름·색·사진은 그대로 둡니다.',
  },
};

/* 탭 맨 아래에 두는 되돌리기 단추 */
function tabReset(kind, container, onChange) {
  const { label, keys, note } = TAB_RESET[kind];
  return U.el('div', { class: 'panel-foot' }, [
    U.el('button', {
      class: 'btn btn-ghost', type: 'button', text: '현재 탭 설정 초기화',
      onClick: () => U.modal({
        title: `${label} 탭 초기화`,
        body: [
          U.el('div', { class: 'imp-line', text: `${label} 탭의 설정만 기본값으로 되돌립니다. 다른 탭은 그대로입니다.` }),
          U.el('div', { class: 'imp-foot', text: note }),
        ],
        actions: [
          { label: '취소' },
          {
            label: '되돌리기', danger: true,
            onClick: () => {
              const st = state.text.style;
              for (const k of keys) st[k] = clone(DEFAULT_STYLE[k]);
              state.activeTemplate = null;
              if (kind === 'color') buildSlotBar(onChange);
              buildSettings(container, onChange);
              onChange();
              U.toast(`${label} 탭을 기본값으로 되돌렸습니다`);
            },
          },
        ],
      }),
    }),
  ]);
}

/* 빗금 구분선 — 대각선은 그림으로 그어야 가장자리가 매끈하다. */
const SLASH_SVG = "<svg viewBox='0 0 12 20' preserveAspectRatio='none' aria-hidden='true'>"
  + "<line x1='2.4' y1='17.6' x2='9.6' y2='2.4' stroke='currentColor' stroke-width='1.5' stroke-linecap='round'/></svg>";

function slashSvg() {
  const box = U.el('span');
  box.innerHTML = SLASH_SVG;
  return box.firstChild;
}

/* 고르는 칸에 넣을 작은 모양 미리보기 */
function dividerPreview(v, label) {
  const p = U.el('span', { class: `divp divp-${v}`, title: label });
  if (v === 'slash') p.appendChild(slashSvg());
  return p;
}

/* 구분선 모양 — 값과 이름표(칸에는 모양만 그리고 이름은 툴팁으로 둔다) */
const DIVIDERS = [
  ['line', '직선'], ['fade', '흐림'], ['dots', '점'], ['bar', '막대'], ['slash', '빗금'],
];

/* 여러 단으로 바꿀 때 맞춰 주는 캔버스 너비와 단 간격 */
const COL_PRESET = { 2: { width: 1400, gap: 64 }, 4: { width: 1400, gap: 32 } };
/* 한 단으로 돌아갈 때 쓸 너비. 여러 단으로 넘어가기 직전 값을 들고 있는다. */
let widthBefore1Col = null;

/* 단 수를 바꾸면 너비와 단 간격도 그 배치에 맞게 옮겨 준다.
   좁은 캔버스에 네 단을 넣으면 글줄이 두어 글자로 쪼개져 읽을 수 없다. */
function setColumns(st, n) {
  const was = Number(st.columns) || 1;
  if (was === n) return;
  if (was === 1) widthBefore1Col = st.width;
  st.columns = n;
  if (n === 1) {
    st.width = widthBefore1Col ?? DEFAULT_STYLE.width;
    widthBefore1Col = null;
    return;
  }
  const p = COL_PRESET[n];
  if (st.width < p.width) st.width = p.width;
  st.columnGap = p.gap;
}

/* 스킨 고르는 칸. 알아볼 만한 색 셋만 칩으로 보여 준다.
   「그대로 둠」인 자리는 지금 프로필의 색을 보여 주고,
   보여 줄 프로필이 없으면 빗금 친 칩으로 「안 건드림」을 나타낸다. */
function skinChips(skin) {
  return U.el('span', { class: 'skin-chips' }, CHIPS.map((c) => {
    const chip = U.el('span', { class: 'skin-chip', title: c.label });
    const v = skinColor(skin, c.side, c.key);
    if (!v) chip.classList.add('is-none');
    else if (v === 'transparent') chip.classList.add('is-clear');
    else chip.style.background = v;
    return chip;
  }));
}

/* 그 스킨을 걸었을 때 그 자리에 실제로 쓰일 색. 스킨이 없으면 지금 프로필의 색. */
function skinColor(skin, side, key) {
  const base = state.text.profiles.find(p => (p.side === 'right') === (side === 'right'));
  return skin ? resolve(skin[side]?.[key], base?.[key]) : (base?.[key] ?? null);
}

function skinCard(skin, on, onPick) {
  return U.el('button', {
    class: `skin-card${on ? ' is-on' : ''}${skin ? '' : ' is-bare'}`, type: 'button',
    title: skin?.note || null,
    onClick: () => onPick(skin ? skin.id : ''),
  }, [
    U.el('span', { class: 'skin-name', text: skin ? skin.label : '없음' }),
    skin ? skinChips(skin) : null,
  ]);
}

/* 고른 스킨이 어떻게 생겼는지 — 말풍선을 아주 간략하게 줄여 그린다.
   바탕은 지금 캔버스 색을 그대로 써서 말풍선이 묻히는지도 함께 보인다. */
function skinPreview(skin) {
  const st = state.text.style;
  const r = Math.max(2, Math.min(10, Math.round((st.bubbleRadius ?? 16) * 0.45)));
  const paint = (node, color) => { if (color && color !== 'transparent') node.style.background = color; };

  const side = (which) => {
    const bub = U.el('span', { class: 'sp-bub' }, [
      U.el('span', { class: 'sp-line' }),
      U.el('span', { class: 'sp-line is-short' }),
    ]);
    bub.style.borderRadius = r + 'px';
    paint(bub, skinColor(skin, which, 'bubbleBg'));
    paint(bub.children[0], skinColor(skin, which, 'textColor'));
    paint(bub.children[1], skinColor(skin, which, 'quoteColor'));
    const name = U.el('span', { class: 'sp-name' });
    paint(name, skinColor(skin, which, 'nameColor'));
    return U.el('span', { class: `sp-row sp-${which}` }, [name, bub]);
  };

  const box = U.el('div', { class: 'skin-prev' }, [side('left'), side('right')]);
  box.style.background = st.transparent ? '#FFFFFF' : st.bg;
  return box;
}

function skinPicker(st, after) {
  const pick = (id) => { st.skin = id; after(); };
  return U.el('div', { class: 'skin-wrap' }, [
    U.el('div', { class: 'skin-list' }, [
      skinCard(null, !st.skin, pick),
      ...SKINS.map(k => skinCard(k, st.skin === k.id, pick)),
    ]),
    skinPreview(skinById(st.skin)),
  ]);
}

/* 그릴 때만 스킨의 말풍선 색을 얹는다. 설정에 저장된 색은 그대로 두므로
   스킨을 끄면 원래 색이 돌아온다. 스타일(배경·지문·모양)은 손대지 않는다. */
const drawProfiles = () => skinProfiles(state.text.profiles, state.text.style.skin);
/* 그릴 때 쓰는 설정 — 스킨이 몇 가지 모양값을 잠깐 덮는다. 저장된 값은 그대로다. */
const drawStyle = () => skinStyle(state.text.style, state.text.style.skin);

/* ── 스타일을 스테이지에 입힌다 ─────────────── */
function applyStyle(stage) {
  const st = drawStyle();
  const f = fontById(st.font);
  ensureFont(st.font);

  Object.assign(stage.style, {
    position: 'relative',
    width: st.width + 'px',
    paddingTop: st.padTop + 'px',
    paddingRight: st.padRight + 'px',
    paddingBottom: st.padBottom + 'px',
    paddingLeft: st.padLeft + 'px',
    background: st.transparent ? 'transparent'
      : (st.bgMode === 'grad' ? `linear-gradient(180deg, ${st.bg}, ${st.bg2 || st.bg})` : st.bg),
    color: st.fg,
    fontFamily: f.stack,
    fontSize: st.fontSize + 'px',
    lineHeight: String(st.lineHeight),
    letterSpacing: st.letterSpacing + 'px',
    textAlign: st.align,
    display: 'flex',
    flexDirection: 'column',
    wordBreak: st.breakMode === 'char' ? 'break-all' : 'keep-all',
    overflowWrap: st.breakMode === 'char' ? 'break-word' : 'anywhere',
  });

  /* 장평 — 안쪽 판을 1/배율 만큼 넓게 깔고 가로로 눌러서 그린다.
     그래야 글자가 좁아지는 만큼 한 줄에 더 들어간다. 판 바깥의 여백과
     캔버스 크기는 그대로다. 사진·프로필 사진처럼 눌리면 안 되는 것은
     아래 CSS 에서 되돌린다. */
  const inner = stage.querySelector('.stage-in') || stage;
  const k = (st.squeeze ?? 100) / 100;
  /* 책 내지처럼 두 단, 잡지처럼 네 단. 여러 단으로 흘리려면 판이 블록이어야
     해서 flex 를 접는다. 비율을 정하면 높이가 묶여 뜻이 없으므로 자동일 때만. */
  const colN = RATIOS[st.ratio] ? 1 : Number(st.columns) || 1;
  const cols = colN > 1;
  Object.assign(inner.style, cols
    ? { display: 'block', flexDirection: '', gap: '',
      columnCount: String(colN), columnGap: (st.columnGap ?? 64) + 'px' }
    : { display: 'flex', flexDirection: 'column', gap: st.paraGap + 'px',
      columnCount: '', columnGap: '' });
  stage.style.setProperty('--sq', String(k));
  stage.classList.toggle('is-squeezed', k !== 1);

  /* 비율을 정하면 남는 세로 공간이 생긴다. 글을 위에 붙이지 않고 가운데 둔다.
     다만 헤더 띠는 언제나 캔버스 맨 위여야 한다. 판 전체를 가운데 맞춤하면
     띠까지 따라 내려가므로, 글 덩어리에만 위아래 auto 여백을 줘서
     띠 아래 남는 자리 안에서 가운데로 가게 한다. */
  const r = RATIOS[st.ratio];
  stage.style.minHeight = r ? Math.round(st.width * r) + 'px' : '';
  stage.style.justifyContent = 'flex-start';
  inner.style.marginTop = r ? 'auto' : '';
  inner.style.marginBottom = r ? 'auto' : '';

  const v = {
    '--c-action': st.actionColor,
    '--c-quote': st.quoteColor,
    '--c-paren': st.parenColor,
    '--c-divider': st.dividerColor,
    '--c-fn': st.fnColor,
    '--c-heading': st.headingColor,
    '--c-bq': st.bqColor,
    '--c-hl': st.hlColor,
    '--c-code-bg': st.codeBg,
    '--c-code-fg': st.codeFg,
    '--c-code-title': st.codeTitleColor,
  };
  for (const [k, val] of Object.entries(v)) stage.style.setProperty(k, val);
  (st.slots || []).forEach((s, i) => stage.style.setProperty(`--c-slot${i + 1}`, s.color));

  // 말풍선 모양과 프로필 사진 모양은 스테이지 전체에 한 번에 건다
  stage.classList.remove('bub-round', 'bub-tail', 'bub-corner');
  stage.classList.add(`bub-${st.bubbleStyle || 'round'}`);
  stage.style.setProperty('--ava-r', st.avatarShape === 'circle' ? '50%' : '.45em');
  stage.style.setProperty('--ava-size', (2.5 * (st.avatarSize ?? 100) / 100).toFixed(3) + 'em');

  stage.classList.toggle('is-cols', cols);

  DIVIDERS.forEach(([v]) => stage.classList.remove(`div-${v}`));
  const divStyle = st.dividerStyle || 'line';
  stage.classList.add(`div-${divStyle}`);
  stage.querySelectorAll('.mk-divider').forEach((d) => {
    d.innerHTML = divStyle === 'slash' ? SLASH_SVG : '';
  });
  stage.style.setProperty('--bq-bar', (st.bqBar ?? 3) + 'px');

  /* 제목·부제목은 본문과 따로 논다. 「본문과 같이」면 본문 값을 그대로 적는다 —
     var() 안에 inherit 를 넣으면 셈할 때 못 쓰는 값이 되어 무시된다.
     폰트는 파일을 미리 불러 둬야 그림에도 박힌다. */
  for (const h of ['h1', 'h2']) {
    const fid = st[`${h}Font`];
    if (fid) ensureFont(fid);
    stage.style.setProperty(`--${h}-font`, fontById(fid || st.font).stack);
    stage.style.setProperty(`--${h}-size`, `${st[`${h}Size`] ?? (h === 'h1' ? 1.6 : 1.22)}em`);
    stage.style.setProperty(`--${h}-align`, st[`${h}Align`] || st.align || 'left');
    stage.style.setProperty(`--${h}-weight`, st[`${h}Bold`] ? '700' : '400');
  }

  stage.style.setProperty('--para-gap', st.paraGap + 'px');
  stage.style.setProperty('--b-radius', st.bubbleRadius + 'px');
  stage.style.setProperty('--b-gap', st.bubbleGap + 'px');
  stage.style.setProperty('--b-in-gap', (st.bubbleInGap ?? 8) + 'px');
  /* 드롭캡 — N 줄의 윗글자 머리부터 N 번째 줄 글자 바닥까지가 한 글자 높이다.
     줄 높이에서 위아래 반씩 남는 틈(행간-1)을 빼고, 첫 줄의 위쪽 틈만큼 내린다. */
  {
    const lh = Number(st.lineHeight) || 1.7;
    const n = Math.max(2, Math.min(6, Number(st.dropCapLines) || 3));
    stage.style.setProperty('--dc-size', `${((n * lh) - (lh - 1)) * st.fontSize}px`);
    stage.style.setProperty('--dc-top', `${((lh - 1) / 2) * st.fontSize}px`);
    if (st.dropCapFont) ensureFont(st.dropCapFont);
    stage.style.setProperty('--dc-font', fontById(st.dropCapFont || st.font).stack);
    stage.style.setProperty('--dc-weight', String(st.dropCapWeight || 400));
    stage.style.setProperty('--dc-color', st.dropCapColor || 'currentColor');
  }
  stage.style.setProperty('--name-gap', (st.nameGap ?? 3) + 'px');
  stage.style.setProperty('--name-w', st.nameBold ? '700' : '400');
  stage.style.setProperty('--b-max', st.bubbleMaxWidth + '%');
  stage.style.setProperty('--b-pad-v', st.bubblePadV + 'px');
  stage.style.setProperty('--b-pad-h', st.bubblePadH + 'px');

  const sign = signLine(st);
  if (sign) {
    stage.appendChild(sign);
    // 아래쪽 auto 여백은 맨 끝에 있는 것이 맡아야 한다
    if (r) { inner.style.marginBottom = ''; sign.style.marginBottom = 'auto'; }
  }

  if (st.bgImage) stage.prepend(st.bgAsHeader ? headerBand(st) : bgLayer(st));
}

/* 캔버스 전체에 깔리는 배경. 흐리게 하면 가장자리가 비쳐서
   흐린 만큼 판을 밖으로 넓혀 두고 스테이지가 잘라 내게 한다. */
function bgLayer(st) {
  const blur = st.bgBlur ?? 0;
  const layer = U.el('div', { class: 'stage-bg' });
  Object.assign(layer.style, {
    backgroundImage: `url("${st.bgImage}")`,
    backgroundSize: st.bgFit === 'tile' ? 'auto' : st.bgFit,
    backgroundRepeat: st.bgFit === 'tile' ? 'repeat' : 'no-repeat',
    backgroundPosition: `${st.bgX ?? 50}% ${st.bgY ?? 50}%`,
    opacity: String((st.bgOpacity ?? 100) / 100),
    filter: blur ? `blur(${blur}px)` : '',
    inset: blur ? `${-blur * 2}px` : '',
  });
  return layer;
}

/* 배경 대신 본문 위에 얹는 띠. 캔버스 좌우 끝까지 닿도록 여백만큼 밖으로 뺀다.
   아래 간격은 위 여백과 같게 두어 글이 원래 자리에서 시작하는 것처럼 보인다. */
function headerBand(st) {
  const blur = st.bgBlur ?? 0;
  /* 띠 자체를 흐리게 하면 본문과 맞닿은 경계선까지 뿌예진다.
     사진은 안쪽 판에 깔고 흐린 만큼 밖으로 넓혀 둔 뒤, 띠가 잘라 내게 한다.
     그러면 사진만 흐려지고 띠의 네 변은 또렷하게 남는다. */
  const face = U.el('div', { class: 'stage-header-face' });
  Object.assign(face.style, {
    inset: blur ? `${-blur * 2}px` : '0',
    backgroundImage: `url("${st.bgImage}")`,
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `${st.bgX ?? 50}% ${st.bgY ?? 50}%`,
    opacity: String((st.bgOpacity ?? 100) / 100),
    filter: blur ? `blur(${blur}px)` : '',
  });
  const band = U.el('div', { class: 'stage-header' }, [face]);
  Object.assign(band.style, {
    height: (st.bgHeaderH ?? 220) + 'px',
    marginTop: -st.padTop + 'px',
    marginLeft: -st.padLeft + 'px',
    marginRight: -st.padRight + 'px',
    marginBottom: st.padTop + 'px',
  });
  return band;
}

/* 캔버스 아래 한 줄 — 이름과 소속. 둘 다 비어 있으면 아예 만들지 않는다.
   장평에 눌리면 안 되므로 stage-in 바깥에 둔다. */
function signLine(st) {
  if (st.signOn === false) return null;
  const name = (st.signName || '').trim();
  const org = (st.signOrg || '').trim();
  if (!name && !org) return null;

  const sep = st.signSep === 'bar' ? '|' : '·';
  // 보통 빈칸은 여러 개를 써도 화면에서 하나로 줄어든다. 줄지 않는 빈칸으로 사이를 벌린다.
  const gap = '  ';
  const el = U.el('div', { class: 'stage-sign', text: [name, org].filter(Boolean).join(`${gap}${sep}${gap}`) });
  Object.assign(el.style, {
    marginTop: (st.signGap ?? 28) + 'px',
    fontSize: (st.signSize ?? 12) + 'px',
    color: st.signColor || '#9AA0A6',
    textAlign: st.signAlign || 'center',
  });
  return el;
}

function makeStage(html) {
  const stage = U.el('div', { class: 'stage' });
  stage.innerHTML = `<div class="stage-in">${html}</div>`;
  applyStyle(stage);
  return stage;
}

function renderOpts() {
  const st = state.text.style;
  return {
    formats: state.text.formats,
    images: state.text.images,
    profiles: drawProfiles(),
    chat: {
      hideQuotesInBubble: st.hideQuotesInBubble,
      parenBreak: st.parenBreakInBubble,
      alpha: st.bubbleAlpha ?? 100,
    },
  };
}

/* 자동 분할은 비율을 정했을 때만 뜻이 있다. 자동 높이면 캔버스가 글만큼 늘어나
   넘칠 일이 없기 때문이다. */
function autoSplitOn() {
  const st = state.text.style;
  return !!st.autoSplit && !!RATIOS[st.ratio];
}

/* 한 장에 들어갈 만큼씩 블록을 끊는다.
   실제로 그려 놓고 재야 정확하므로 화면 밖에 견본을 하나 세워 높이를 읽는다.
   블록 하나가 한 장보다 크면 자르지 않고 그대로 둔다 — 글이 잘리는 것보다 낫다. */
function splitToPages(html) {
  const st = state.text.style;
  const probe = makeStage(html);
  Object.assign(probe.style, { position: 'fixed', left: '-99999px', top: '0', minHeight: '', justifyContent: '' });
  document.body.appendChild(probe);

  const inner = probe.querySelector('.stage-in');
  let limit = Math.round(st.width * RATIOS[st.ratio]) - st.padTop - st.padBottom;
  const band = probe.querySelector('.stage-header');
  if (band) limit -= band.offsetHeight;
  const sign = probe.querySelector('.stage-sign');
  if (sign) limit -= sign.offsetHeight + (st.signGap ?? 32);

  const gap = st.paraGap || 0;
  const pages = [[]];
  let used = 0;

  for (const node of [...inner.children]) {
    const cs = getComputedStyle(node);
    const h = node.offsetHeight + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
    const cur = pages[pages.length - 1];
    const add = (cur.length ? gap : 0) + h;
    if (cur.length && used + add > limit) {
      pages.push([node.outerHTML]);
      used = h;
    } else {
      cur.push(node.outerHTML);
      used += add;
    }
  }

  probe.remove();
  return pages.filter(p => p.length).map(p => p.join(''));
}

/* 그 장에 든 덩어리들의 줄 번호를 모아 원문에서 해당 대목을 오려 낸다.
   자동 분할은 다 그려 놓고 높이를 재서 끊는 방식이라, 원문의 어디서 끊겼는지는
   덩어리에 붙여 둔 data-lf/data-lt 를 보고서야 알 수 있다. */
function sliceSource(html, source) {
  const lf = [...html.matchAll(/data-lf=["']?(\d+)/g)].map(m => Number(m[1]));
  const lt = [...html.matchAll(/data-lt=["']?(\d+)/g)].map(m => Number(m[1]));
  if (!lf.length) return '';
  return source.split(/\r?\n/).slice(Math.min(...lf), Math.max(...lt) + 1).join('\n');
}

/* 한 장씩. === 로 손수 나눈 자리는 그대로 두고, 자동 분할이 켜져 있으면
   각 조각을 다시 장 단위로 끊는다. source 는 그 장에만 들어간 원문 —
   이미지에 심을 때 장마다 제 몫만 담기게 하려고 같이 들고 다닌다. */
function pageParts() {
  const opts = renderOpts();
  const src = state.text.source;
  const offs = chunkOffsets(src);
  const parts = splitChunks(src).map((c, i) => ({ html: renderChunk(c, opts, offs[i]), source: c }));
  if (!autoSplitOn()) return parts;
  return parts.flatMap(part => splitToPages(part.html)
    .map(html => ({ html, source: sliceSource(html, src) })));
}

/* 저장용 — 그린 판과 그 판에 담긴 원문을 짝지어 돌려준다. */
export function buildExportStages() {
  const parts = pageParts().map(part => ({ stage: makeStage(part.html), source: part.source }));
  applyDropCap(parts.map(p => p.stage));
  return parts;
}

/* ── 드롭캡 ──────────────────────────────────
   문서 맨 첫 본문 문단의 첫 글자를 따로 떼어 크게 띄운다. ::first-letter 는
   그림으로 옮길 때 빠질 수 있어 진짜 칸(span)으로 감싼다. 첫 글자 앞의
   따옴표·괄호 같은 부호는 글자와 함께 묶는다. */
function applyDropCap(stages) {
  const st = state.text.style;
  if (!st.dropCap || !stages.length) return;
  const each = st.dropCapScope === 'page';
  // 자동 분할은 덩어리 사이에서만 끊으므로 장의 첫 문단은 늘 문단의 시작이다.
  // 「분할 전」 보기는 한 판 안에 분할선이 끼어 있어, 장마다면 선 뒤도 새 장으로 본다.
  for (const stage of (each ? stages : stages.slice(0, 1))) {
    const inner = stage.querySelector('.stage-in');
    if (!inner) continue;
    let armed = true;
    for (const el of inner.children) {
      if (el.classList.contains('mk-splitline-wrap')) { if (each) armed = true; continue; }
      if (armed && el.classList.contains('mk-p')) { capParagraph(el, st.dropCapKind === 'raise'); armed = false; }
    }
  }
}

/* 문단 첫 글자를 떼어 크게 쓴다 */
function capParagraph(p, raised) {
  const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const text = node.nodeValue;
    const m = text.match(/^(\s*)([\p{P}\p{S}]*)(.)/su);
    if (!m || !m[3].trim()) continue;
    const start = m[1].length;
    const len = m[2].length + m[3].length;
    const rest = node.splitText(start);
    rest.splitText(len);
    const cap = U.el('span', { class: raised ? 'mk-dropcap is-raised' : 'mk-dropcap' });
    rest.parentNode.insertBefore(cap, rest);
    cap.appendChild(rest);
    if (!raised) p.classList.add('has-dropcap');
    return;
  }
}

/* ── 각주 ────────────────────────────────────

   본문에는 [[fn:id]] 표만 들어가고 설명은 state.text.notes 가 들고 있다.
   번호는 장마다 1부터 다시 매긴다 — 한 장만 떼어 봐도 앞뒤가 맞아야 하니까.
   그래서 번호는 원문이 아니라 다 그린 판을 보고 매긴다. */
const noteText = (id) => state.text.notes.find(n => n.id === id)?.text || '';

/* 판 안의 표에 번호를 매기고 그 차례대로 각주를 돌려준다.
   같은 각주를 두 번 불러도 번호는 하나다. */
function numberNotes(stage) {
  const seen = new Map();
  const list = [];
  stage.querySelectorAll('.mk-fn-mark').forEach((m) => {
    const id = m.dataset.fn;
    let n = seen.get(id);
    if (!n) { n = seen.size + 1; seen.set(id, n); list.push({ id, n, mark: m }); }
    m.textContent = String(n);
  });
  return list;
}

function noteBlock(items) {
  return U.el('div', { class: 'mk-fns' }, items.map(it => U.el('div', { class: 'mk-fn' }, [
    U.el('span', { class: 'mk-fn-no', text: String(it.n) }),
    U.el('span', { class: 'mk-fn-t', text: noteText(it.id) }),
  ])));
}

/* 각주를 판에 앉힌다. 판이 화면(또는 숨은 자리)에 붙은 뒤라야 자리를 잴 수 있다.

   한 단이면 글 바로 뒤에 이어 붙인다 — 비율을 정해 글이 가운데로 가도 글을
   따라 내려간다. 여러 단이면 표가 놓인 그 단의 바닥에 붙여야 하므로, 단마다
   따로 묶어 절대 자리로 앉히고 그 높이만큼 판 아래에 자리를 비워 둔다.
   여러 단은 높이가 글에 따라 정해지므로, 아래 여백을 더해도 단이 다시
   나뉘지 않는다. 그래서 한 번만 재면 된다. */
export function layoutFootnotes(stage) {
  const inner = stage.querySelector('.stage-in');
  if (!inner) return;
  stage.querySelectorAll('.mk-fns').forEach(n => n.remove());
  inner.style.paddingBottom = '';

  const items = numberNotes(stage).filter(it => noteText(it.id).trim());
  if (!items.length) return;

  const cs = getComputedStyle(inner);
  const cols = Number(cs.columnCount) || 1;
  if (cols < 2) { inner.appendChild(noteBlock(items)); return; }

  /* 자리는 눌리기 전(레이아웃) 값으로 잡아야 한다. 장평을 주면 판이
     scaleX 로 눌리고, 미리보기는 배율까지 걸려서 화면에서 잰 값이 실제
     칸 자리보다 작다. 그대로 쓰면 뒤쪽 단일수록 왼쪽으로 밀린다.
     화면에서 잰 값은 지금 걸린 배율로 나눠 되돌린 뒤 쓴다. */
  const box = inner.getBoundingClientRect();
  const k = (box.width / (inner.offsetWidth || 1)) || 1;
  const gap = parseFloat(cs.columnGap) || 0;
  const colW = (inner.clientWidth - gap * (cols - 1)) / cols;
  const groups = Array.from({ length: cols }, () => []);
  for (const it of items) {
    const x = (it.mark.getBoundingClientRect().left - box.left) / k;
    const i = Math.floor((x + gap / 2) / (colW + gap));
    groups[Math.max(0, Math.min(cols - 1, i))].push(it);
  }

  let need = 0;
  groups.forEach((g, i) => {
    if (!g.length) return;
    const b = noteBlock(g);
    b.classList.add('is-col');
    b.style.left = `${i * (colW + gap)}px`;
    b.style.width = `${colW}px`;
    inner.appendChild(b);
    need = Math.max(need, b.offsetHeight);
  });
  if (need) inner.style.paddingBottom = `${need}px`;
}

/* ── 미리보기 ───────────────────────────────── */
export function renderPreview(host) {
  const src = state.text.source;
  const split = hasSplit(src);
  const auto = autoSplitOn();

  // 자동 분할일 때는 늘 장별로 보여 준다. 분할 전/후를 고를 일이 없다.
  document.getElementById('splitSeg').hidden = !split || auto;

  const opts = renderOpts();
  host.textContent = '';
  const offs = chunkOffsets(src);
  let stages;
  if (auto) stages = pageParts().map(part => makeStage(part.html));
  else if (split && state.splitView === 'after') {
    stages = splitChunks(src).map((c, i) => makeStage(renderChunk(c, opts, offs[i])));
  } else {
    stages = [makeStage(split ? renderWithSplitMarks(src, opts) : renderChunk(src, opts))];
  }

  stages.forEach((s, i) => {
    const wrap = U.el('div', { class: 'stage-wrap' }, [s]);
    if (stages.length > 1) wrap.appendChild(U.el('div', { class: 'stage-label', text: `${i + 1} / ${stages.length}` }));
    host.appendChild(wrap);
  });
  applyDropCap(stages);
  // 각주는 자리를 재야 하므로 판이 붙은 뒤에 앉힌다
  stages.forEach(layoutFootnotes);

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

/* 배경 사진의 보이는 자리를 여백을 끌어서 옮긴다.
   꽉 채움과 헤더 띠는 사진이 캔버스보다 커서 넘치는 만큼만 움직인다. */
const natSize = new Map();

function naturalSize(src) {
  if (natSize.has(src)) return natSize.get(src);
  const im = new Image();
  im.src = src;
  const box = { w: im.naturalWidth || 0, h: im.naturalHeight || 0 };
  if (box.w) natSize.set(src, box);
  else im.onload = () => natSize.set(src, { w: im.naturalWidth, h: im.naturalHeight });
  return box;
}

function draggableBg() {
  const st = state.text.style;
  if (!st.bgImage) return null;
  if (!st.bgAsHeader && st.bgFit !== 'cover') return null;   // 전체 보임·반복은 옮길 곳이 없다
  return st;
}

export function bindBgDrag(host, onChange) {
  let drag = null;

  host.addEventListener('pointerdown', (e) => {
    const st = draggableBg();
    if (!st) return;
    const t = e.target;

    /* 헤더 띠의 아래 가장자리를 잡으면 높이를 바꾼다. 그 안쪽을 잡으면
       아래처럼 보이는 자리를 옮긴다. 수치로 정하는 칸도 그대로 쓴다. */
    const head = t.closest?.('.stage-header');
    if (head) {
      const box = head.getBoundingClientRect();
      if (box.bottom - e.clientY <= 12) {
        e.preventDefault();
        try { host.setPointerCapture(e.pointerId); } catch { /* 못 잡아도 끌기는 된다 */ }
        drag = { id: e.pointerId, mode: 'head', st, y: e.clientY,
          h0: st.bgHeaderH ?? 220, k: hostScale(host) };
        host.classList.add('is-headsize');
        return;
      }
    }

    // 글이나 말풍선이 아니라 빈 여백을 잡았을 때만 움직인다
    const ok = t.classList?.contains('stage') || t.classList?.contains('stage-in')
      || t.classList?.contains('stage-bg') || !!head;
    if (!ok) return;

    const band = head || t.closest('.stage')?.querySelector('.stage-header');
    const box = (band || t.closest('.stage'))?.getBoundingClientRect();
    if (!box) return;

    const nat = naturalSize(st.bgImage);
    if (!nat.w || !nat.h) return;

    // cover 로 채운 사진의 실제 크기에서 넘치는 폭·높이를 구한다
    const k = Math.max(box.width / nat.w, box.height / nat.h);
    const overX = Math.max(0, nat.w * k - box.width);
    const overY = Math.max(0, nat.h * k - box.height);
    if (!overX && !overY) return;

    e.preventDefault();
    try { host.setPointerCapture(e.pointerId); } catch { /* 못 잡아도 끌기는 된다 */ }
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, overX, overY, st,
      x0: st.bgX ?? 50, y0: st.bgY ?? 50 };
    host.classList.add('is-bgdrag');
  });

  host.addEventListener('pointermove', (e) => {
    if (!drag) {
      // 어디를 잡으면 높이가 바뀌는지 마우스 모양으로 알려 준다
      const n = e.target.closest?.('.stage-header');
      if (n) {
        const box = n.getBoundingClientRect();
        n.style.cursor = box.bottom - e.clientY <= 12 ? 'ns-resize' : 'grab';
      }
      return;
    }
    if (e.pointerId !== drag.id) return;

    if (drag.mode === 'head') {
      const dy = (e.clientY - drag.y) / (drag.k || 1);
      drag.st.bgHeaderH = Math.max(40, Math.min(1600, Math.round(drag.h0 + dy)));
      // 다시 그리면 한 박자 늦어 끌리는 게 안 보인다. 지금 띠를 바로 늘린다.
      host.querySelectorAll('.stage-header').forEach(n => { n.style.height = drag.st.bgHeaderH + 'px'; });
      return;
    }

    const { st, overX, overY } = drag;
    const clamp = (v) => Math.max(0, Math.min(100, v));
    // 사진을 오른쪽으로 밀면 보이는 자리는 왼쪽으로 간다
    if (overX) st.bgX = clamp(drag.x0 - (e.clientX - drag.x) / overX * 100);
    if (overY) st.bgY = clamp(drag.y0 - (e.clientY - drag.y) / overY * 100);
    // 다시 그리면 한 박자 늦어 끌리는 게 안 보인다. 지금 판을 바로 옮긴다.
    const pos = `${st.bgX}% ${st.bgY}%`;
    host.querySelectorAll('.stage-bg, .stage-header-face')
      .forEach(n => { n.style.backgroundPosition = pos; });
  });

  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    host.classList.remove('is-bgdrag', 'is-headsize');
    state.activeTemplate = null;
    onChange();
  };
  host.addEventListener('pointerup', end);
  host.addEventListener('pointercancel', end);
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
    // 점은 말풍선 색이 아니라 따옴표 색으로 채운다. 말풍선 색은 투명일 수 있어서다.
    btn.querySelector('.slot-dot').style.background = p.quoteColor || p.textColor;
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

  replaceRange(ta, start, end, next, 'select');
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

function group(title, children, action) {
  const head = title
    ? U.el('div', { class: 'grp-t' }, [U.el('span', { text: title }), action || null])
    : null;
  return U.el('div', { class: 'grp' }, [head, ...children.filter(Boolean)]);
}

/* 고른 탭 뒤에 깔리는 청록 판. 탭을 갈아탈 때 자리를 옮겨 미끄러진다.
   탭 버튼을 매번 새로 만들면 뚝 끊기므로 처음 한 번만 만들고 이후엔 옮기기만 한다. */
let inkPlaced = false;

function moveInk() {
  const host = document.getElementById('setTabs');
  const ink = host?.querySelector('.set-ink');
  const on = host?.querySelector('.set-tab.is-active');
  if (!ink || !on) return;

  // 처음 놓을 때는 미끄러질 자리가 없다. 그때만 애니메이션을 끈다.
  if (!inkPlaced) ink.style.transition = 'none';
  ink.style.width = on.offsetWidth + 'px';
  ink.style.transform = `translateX(${on.offsetLeft}px)`;
  ink.style.opacity = '1';
  if (!inkPlaced) {
    void ink.offsetWidth;               // 지금 값으로 한 번 굳힌 뒤 애니메이션을 돌려준다
    ink.style.transition = '';
    inkPlaced = true;
  }
}
window.addEventListener('resize', moveInk);
// 폰트가 늦게 오면 탭 폭이 바뀐다. 그때 한 번 더 맞춘다.
document.fonts?.ready.then(moveInk).catch(() => {});

let shownTab = null;

export function buildSettings(container, onChange) {
  // 설정을 만졌다고 보던 자리가 맨 위로 튀면 곤란하다. 탭을 갈아탈 때만 올린다.
  const keep = shownTab === activeSetTab ? container.scrollTop : 0;
  shownTab = activeSetTab;

  const tabsHost = document.getElementById('setTabs');
  let tabs = [...tabsHost.querySelectorAll('.set-tab')];

  if (tabs.length !== SET_TABS.length) {
    tabsHost.textContent = '';
    tabsHost.appendChild(U.el('span', { class: 'set-ink' }));
    SET_TABS.forEach(([id, label]) => {
      tabsHost.appendChild(U.el('button', {
        class: 'set-tab', type: 'button',
        onClick: () => { activeSetTab = id; buildSettings(container, onChange); },
      }, [icon(id), U.el('span', { text: label })]));
    });
    tabs = [...tabsHost.querySelectorAll('.set-tab')];
  }
  tabs.forEach((b, i) => b.classList.toggle('is-active', SET_TABS[i][0] === activeSetTab));
  moveInk();
  setTimeout(moveInk, 0);               // 탭 폭이 아직 안 잡혔을 때를 위한 한 번 더

  container.textContent = '';
  container.appendChild(PANELS[activeSetTab](container, onChange));
  container.scrollTop = keep;
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

/* 프로필 보기 — card: 색까지 펼친 카드 / list: 색을 접은 목록 */
let profileView = 'list';

/* 말풍선 — 화자 프로필과 공통 모양 */
function panelChat(container, onChange) {
  const st = state.text.style;
  const ps = state.text.profiles;
  const touch = () => { state.activeTemplate = null; onChange(); };
  const rebuild = () => buildSettings(container, onChange);

  /* 카드와 목록이 함께 쓰는 조각들. compact 는 한 줄에 들어가도록 이름표를 줄인다. */
  const parts = (p, compact = false) => {
    const avatarInput = U.el('input', {
      type: 'file', accept: 'image/*', style: 'display:none',
      onChange: (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        const fr = new FileReader();
        fr.onload = async () => {
          p.avatar = await shrinkPhoto(fr.result);
          U.closePopup(); rebuild(); touch();
        };
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

    const nameInput = U.el('input', {
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
    });

    const delBtn = U.el('button', {
      class: 'prof-x', type: 'button', text: '×', title: '이 프로필 삭제',
      onClick: () => {
        if (ps.length <= 1) { U.toast('프로필은 하나 이상 있어야 합니다'); return; }
        U.closePopup();
        state.text.profiles = ps.filter(x => x !== p);
        buildProfileBar(onChange); rebuild(); touch();
      },
    });

    const sideSeg = U.seg(p.side, [['left', '왼쪽'], ['right', '오른쪽']], (v) => { p.side = v; touch(); });
    const toggles = [
      U.check(compact ? '이름' : '이름 표시', p.showName, (v) => { p.showName = v; touch(); }),
      U.check(compact ? '사진' : '사진 표시', p.showAvatar, (v) => { p.showAvatar = v; touch(); }),
    ];
    if (compact) {
      toggles[0].title = '말풍선 위에 이름을 보일지';
      toggles[1].title = '말풍선 옆에 프로필 사진을 보일지';
    }

    return { avatarInput, faceBtn, nameInput, delBtn, sideSeg, toggles, grip: U.dragGrip() };
  };

  const card = (p) => {
    const q = parts(p);
    return U.el('div', { class: 'prof-card' }, [
      U.el('div', { class: 'prof-head' }, [q.grip, q.faceBtn, q.nameInput, q.delBtn, q.avatarInput]),
      U.el('div', { class: 'prof-body' }, [
        U.field('위치', q.sideSeg),
        U.colorGrid(2, [
          U.colorCell('말풍선', p.bubbleBg, (v) => { p.bubbleBg = v; touch(); }),
          U.colorCell('글자', p.textColor, (v) => { p.textColor = v; touch(); }),
          U.colorCell('이름', p.nameColor || NAME_COLOR, (v) => { p.nameColor = v; touch(); }),
          U.colorCell('따옴표', p.quoteColor || p.textColor, (v) => { p.quoteColor = v; touch(); }),
          U.colorCell('괄호', p.parenColor || p.textColor, (v) => { p.parenColor = v; touch(); }),
        ]),
        U.el('div', { class: 'prof-toggles' }, q.toggles),
      ]),
    ]);
  };

  /* 색을 접은 한 줄짜리 — 이름·위치·표시 여부만 */
  const row = (p) => {
    const q = parts(p, true);
    // 좁은 화면에서 설정 줄만 아래로 접히도록 삭제 버튼을 앞에 두고 순서로 자리를 바꾼다
    return U.el('div', { class: 'prof-row' }, [
      q.grip, q.faceBtn, q.nameInput, q.delBtn,
      U.el('div', { class: 'prof-row-opts' }, [q.sideSeg, U.el('div', { class: 'prof-toggles' }, q.toggles)]),
      q.avatarInput,
    ]);
  };

  const isList = profileView === 'list';
  const viewBtn = U.el('button', {
    class: 'grp-act', type: 'button',
    text: isList ? '카드로 보기' : '리스트로 보기',
    title: isList ? '색까지 펼쳐서 봅니다' : '색을 접고 이름·위치만 봅니다',
    onClick: () => { U.closePopup(); profileView = isList ? 'card' : 'list'; rebuild(); },
  });

  const listEl = isList
    ? U.el('div', { class: 'prof-list' }, ps.map(row))
    : U.el('div', { class: 'prof-grid' }, ps.map(card));

  // 목록은 한 줄씩 쌓여 있으니 세로로만, 카드는 여러 열이라 양쪽 다
  U.dragSort(listEl, isList ? '.prof-row' : '.prof-card', (from, to) => {
    const [moved] = ps.splice(from, 1);
    ps.splice(to, 0, moved);
    buildProfileBar(onChange); rebuild(); touch();
  }, { axis: isList ? 'y' : 'both' });

  return U.el('div', { class: 'panel' }, [
    // 네 칸에 나눠 담느라 이름표를 줄였다. 무슨 뜻인지는 툴팁에 적어 둔다.
    U.el('div', { class: 'tgl-row tgl-boxed cols-4' }, [
      U.toggle('이름 볼드', st.nameBold, (v) => { st.nameBold = v; touch(); }, null, '이름을 굵게'),
      U.toggle('따옴표', st.hideQuotesInBubble, (v) => { st.hideQuotesInBubble = v; touch(); }, null, '말풍선 안 따옴표 기호 감추기'),
      U.toggle('괄호', st.parenBreakInBubble, (v) => { st.parenBreakInBubble = v; touch(); }, null, '말풍선 안 괄호를 늘 새 줄에'),
      U.pct('투명도', st.bubbleAlpha ?? 100, (v) => { st.bubbleAlpha = v; touch(); },
        '말풍선 투명도 — 프로필과 상관없이 모든 말풍선에 걸립니다'),
    ]),
    group('프로필', [
      listEl,
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
    ], viewBtn),
    group('스킨', [
      skinPicker(st, () => { rebuild(); touch(); }),
      U.el('div', { class: 'hint', text: '스킨을 클릭하면 말풍선 색을 덮어씌웁니다.' }),
      skinById(st.skin)?.note ? U.el('div', { class: 'hint', text: skinById(st.skin).note }) : null,
    ]),
    group('모양', [
      U.field('말풍선', U.seg(st.bubbleStyle || 'round', [
        ['round', '기본'], ['tail', '꼬리'], ['corner', '모서리'],
      ], (v) => { st.bubbleStyle = v; touch(); })),
      U.field('사진 모양', U.seg(st.avatarShape || 'square', [
        ['circle', U.shapeLabel('circle', '원형')],
        ['square', U.shapeLabel('square', '라운드 사각')],
      ], (v) => { st.avatarShape = v; touch(); })),
      U.field('사진 크기', U.slider(st.avatarSize ?? 100, {
        min: 60, max: 240, step: 5, unit: '%', reset: 100,
        onChange: (v) => { st.avatarSize = v; touch(); },
      })),
      U.fieldGrid([
        U.field('최대 폭', U.stepper(st.bubbleMaxWidth, { min: 30, max: 100, step: 2, unit: '%', onChange: (v) => { st.bubbleMaxWidth = v; touch(); } })),
        U.field('모서리', U.stepper(st.bubbleRadius, { min: 0, max: 40, step: 1, unit: 'px', onChange: (v) => { st.bubbleRadius = v; touch(); } })),
        U.field('말풍선 간격', U.stepper(st.bubbleGap, { min: 0, max: 40, step: 1, unit: 'px', onChange: (v) => { st.bubbleGap = v; touch(); } })),
        U.field('연속 간격', U.stepper(st.bubbleInGap ?? 8, { min: 0, max: 40, step: 1, unit: 'px', onChange: (v) => { st.bubbleInGap = v; touch(); } })),
        U.field('이름 간격', U.stepper(st.nameGap ?? 3, { min: 0, max: 40, step: 1, unit: 'px', onChange: (v) => { st.nameGap = v; touch(); } })),
      ]),
      U.field('안쪽 여백', U.el('div', { class: 'field-row' }, [
        U.stepper(st.bubblePadV, { min: 0, max: 40, step: 1, unit: '↕', onChange: (v) => { st.bubblePadV = v; touch(); } }),
        U.stepper(st.bubblePadH, { min: 0, max: 40, step: 1, unit: '↔', onChange: (v) => { st.bubblePadH = v; touch(); } }),
      ])),
      U.el('div', { class: 'hint', text: '「꼬리」와 「모서리」는 한 사람이 이어 말할 때 첫 말풍선에만 붙습니다. 「말풍선 간격」은 사람이 바뀔 때, 「연속 간격」은 한 사람이 이어 말할 때, 「이름 간격」은 이름과 말풍선 사이입니다.' }),
    ]),
    tabReset('chat', container, onChange),
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
    group('', [
      U.el('div', { class: 'tgl-grid tgl-boxed' }, items.map(([k, label, mark]) =>
        U.toggle(label, fm[k], (v) => { fm[k] = v; onChange(); }, mark))),
    ]),
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
    group('글꼴 · 간격', [
      U.fieldGrid([
        U.field('폰트', fontSel),
        U.field('크기', U.stepper(st.fontSize, { min: 8, max: 96, step: 1, unit: 'px', onChange: (v) => { st.fontSize = v; touch(); } })),
      ]),
      U.fieldGrid([
        U.field('행간', U.stepper(st.lineHeight, { min: 0.8, max: 5, step: 0.1, decimals: 2, onChange: (v) => { st.lineHeight = v; touch(); } })),
        U.field('자간', U.stepper(st.letterSpacing, { min: -3, max: 10, step: 0.5, decimals: 1, unit: 'px', onChange: (v) => { st.letterSpacing = v; touch(); } })),
        U.field('문단 간격', U.stepper(st.paraGap, { min: 0, max: 80, step: 1, unit: 'px', onChange: (v) => { st.paraGap = v; touch(); } })),
        U.field('장평', U.stepper(st.squeeze ?? 100, { min: 50, max: 150, step: 1, unit: '%', onChange: (v) => { st.squeeze = v; touch(); } })),
      ]),
    ]),
    group('흐름', [
      U.field('정렬', U.seg(st.align,
        [['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽'], ['justify', '양쪽']],
        (v) => { st.align = v; touch(); })),
      U.field('줄바꿈', U.seg(st.breakMode, [['word', '단어 단위'], ['char', '글자 단위']], (v) => { st.breakMode = v; touch(); })),
      U.el('div', { class: 'hint', text: '단어 단위는 낱말이 잘리지 않게 넘깁니다. 좁은 폭에서 오른쪽이 들쭉날쭉하면 글자 단위로 바꿔 보세요.' }),
    ]),
    dropCapGroup(st, touch, () => buildSettings(container, onChange)),
    group('스타일', [
      U.field('구분선', U.seg(st.dividerStyle || 'line',
        DIVIDERS.map(([v, label]) => [v, dividerPreview(v, label)]),
        (v) => { st.dividerStyle = v; touch(); })),
      U.field('인용 막대', U.slider(st.bqBar ?? 3, {
        min: 0, max: 12, step: 1, unit: 'px', onChange: (v) => { st.bqBar = v; touch(); },
      })),
      U.el('div', { class: 'hint', text: '구분선 --- 의 모양과 인용구 > 왼쪽 막대의 두께입니다. 색은 색상 탭에서 고릅니다.' }),
      headGroup('h1', '제목', st, touch),
      headGroup('h2', '부제목', st, touch),
    ]),
    group('각주', [noteList(container, onChange)]),
    group('본문 사진', [photoList(container, onChange)]),
    tabReset('body', container, onChange),
  ]);
}

/* 굵기 고르개 — 지금 폰트에 없는 굵기는 누를 수 없게 둔다 */
function weightSeg(st, touch) {
  const font = fontById(st.dropCapFont || st.font);
  const opts = [[300, '라이트'], [400, '일반'], [700, '굵게']];
  const seg = U.seg(String(st.dropCapWeight || 400), opts.map(([w, l]) => [String(w), l]),
    (v) => { st.dropCapWeight = Number(v); touch(); });
  [...seg.children].forEach((b, i) => {
    const [w, l] = opts[i];
    if (!fontHasWeight(font, w)) { b.disabled = true; b.title = `${font.label}에는 ${l} 굵기가 없습니다`; }
  });
  return seg;
}

/* 드롭캡 — 제목 줄 오른쪽에 켜고 끄는 토글을 둔다. 칸은 접지 않는다. */
function dropCapGroup(st, touch, rebuild) {
  const sw = U.toggle('', !!st.dropCap, (v) => { st.dropCap = v; rebuild(); touch(); }, null,
    st.dropCap ? '드롭캡을 끕니다' : '드롭캡을 켭니다');

  return group('드롭캡', [
    U.fieldGrid([
      U.field('모양', U.seg(st.dropCapKind || 'drop', [['drop', '내림'], ['raise', '올림']],
        (v) => { st.dropCapKind = v; touch(); })),
      U.field('적용', U.seg(st.dropCapScope || 'first', [['first', '첫 장만'], ['page', '장마다']],
        (v) => { st.dropCapScope = v; touch(); })),
    ]),
    // 제목 칸과 같은 짜임 — 폰트 | 크기, 색 | 굵게
    U.fieldGrid([
      U.field('폰트', U.select(st.dropCapFont || '',
        [['', '본문과 같이'], ...FONTS.map(f => [f.id, f.label])],
        (v) => {
          st.dropCapFont = v;
          // 새 폰트에 없는 굵기를 골라 두었으면 일반으로 돌린다
          if (!fontHasWeight(fontById(v || st.font), st.dropCapWeight || 400)) st.dropCapWeight = 400;
          rebuild(); touch();
        })),
      U.field('크기', U.stepper(st.dropCapLines ?? 3, {
        min: 2, max: 6, step: 1, unit: '줄',
        onChange: (v) => { st.dropCapLines = v; touch(); },
      })),
    ]),
    U.fieldGrid([
      U.field('색', (() => {
        const c = U.color(st.dropCapColor || st.fg, (v) => { st.dropCapColor = v; touch(); });
        c.classList.add('color-wide');
        return c;
      })()),
      U.field('굵기', weightSeg(st, touch)),
    ]),
    U.el('div', { class: 'hint', text: '첫 본문 문단의 첫 글자를 크게 씁니다. 「내림」은 여러 줄에 걸쳐 파고들고, 「올림」은 첫 줄 위로 솟습니다. 제목·말풍선·인용구는 건너뜁니다.' }),
  ], sw);
}

/* 제목·부제목만 따로 손보는 접는 칸. 본문 설정은 건드리지 않고,
   # 과 ## 이 달린 줄에만 걸린다. 여러 단일 때 정렬은 그 줄이 놓인
   단 안에서 걸린다 — 단이 곧 글줄의 폭이니 저절로 그렇게 된다. */
function headGroup(key, label, st, touch) {
  const size = st[`${key}Size`] ?? (key === 'h1' ? 1.6 : 1.22);
  const fields = [
    U.fieldGrid([
      U.field('폰트', U.select(st[`${key}Font`] || '',
        [['', '본문과 같이'], ...FONTS.map(f => [f.id, f.label])],
        (v) => { st[`${key}Font`] = v; touch(); })),
      U.field('크기', U.stepper(size, {
        min: 0.6, max: 5, step: 0.05, decimals: 2, unit: '배',
        onChange: (v) => { st[`${key}Size`] = v; touch(); },
      })),
    ]),
    U.field('정렬', U.seg(st[`${key}Align`] || '',
      [['', '본문과 같이'], ['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']],
      (v) => { st[`${key}Align`] = v; touch(); })),
    U.el('div', { class: 'tgl-row tgl-boxed' }, [
      U.toggle('굵게', !!st[`${key}Bold`], (v) => { st[`${key}Bold`] = v; touch(); }),
    ]),
  ];
  return U.el('details', { class: 'grp fold-grp fold-sub' }, [
    U.el('summary', { class: 'grp-t' }, [U.el('span', { text: label })]),
    U.el('div', { class: 'fold-body' }, fields),
  ]);
}

/* 각주 목록 — 차례는 본문에 나온 순서 그대로다. 자리를 옮기려면 편집기에서
   [[fn:…]] 표를 옮기면 된다. 여기서는 설명을 적고 빼기만 한다. */
function noteList(container, onChange) {
  const rebuild = () => buildSettings(container, onChange);
  const ids = [...new Set(noteOrder(state.text.source))];
  // 편집기에서 표를 손수 지웠으면 설명도 함께 버린다
  state.text.notes = state.text.notes.filter(n => ids.includes(n.id));

  if (!ids.length) {
    return U.el('div', { class: 'hint', text: '「각주」 단추를 누르면 커서 자리에 표가 들어갑니다. 설명은 여기에 적습니다. 번호는 장마다 1부터 다시 매겨집니다.' });
  }

  const { at, pages } = notePlaces();
  const rows = ids.map((id) => {
    const note = state.text.notes.find(n => n.id === id)
      || (state.text.notes.push({ id, text: '' }), state.text.notes[state.text.notes.length - 1]);
    const spot = at.get(id);
    return U.el('div', { class: 'fn-row' }, [
      pages > 1 ? U.el('span', { class: 'fn-pg', text: `${spot?.page ?? '?'}장` }) : null,
      U.el('span', { class: 'fn-no', text: String(spot?.n ?? '?') }),
      U.el('input', {
        type: 'text', class: 'fn-text', value: note.text, placeholder: '설명',
        onInput: (e) => { note.text = e.target.value; onChange(); },
      }),
      U.el('button', {
        class: 'prof-x', type: 'button', text: '×', title: '이 각주 빼기',
        onClick: () => {
          state.text.source = removeNoteMarker(state.text.source, id);
          state.text.notes = state.text.notes.filter(n => n.id !== id);
          srcEl().value = state.text.source;
          rebuild(); onChange();
        },
      }),
    ].filter(Boolean));
  });
  return U.el('div', { class: 'fn-list' }, rows);
}

/* 각주가 몇 장의 몇 번인지 — 저장할 때 나뉘는 장을 그대로 따른다. */
function notePlaces() {
  const parts = pageParts();
  const at = new Map();
  parts.forEach((part, pi) => {
    let n = 0;
    for (const id of noteOrder(part.source)) {
      if (at.has(id)) continue;
      at.set(id, { page: pi + 1, n: ++n });
    }
  });
  return { at, pages: parts.length };
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
      U.slider(im.width ?? 100, {
        min: 10, max: 100, step: 5, unit: '%',
        onChange: (v) => { im.width = v; onChange(); },
      }),
    ]),
    U.el('div', { class: 'photo-r' }, [
      U.stepper(im.radius ?? 4, {
        min: 0, max: 80, step: 1, unit: 'px', onChange: (v) => { im.radius = v; onChange(); },
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
    U.el('div', { class: 'hint', text: '미리보기 창에서 사진의 위·아래 가장자리를 드래그하면 높이를 줄입니다. '
      + '사진 내부를 드래그하면 보이는 위치를 조정할 수 있습니다.' }),
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
      fr.onload = async () => {
        // 크기는 그대로 두고 webp 로 다시 담는다
        st.bgImage = await shrinkPhoto(fr.result, BIG_MAX, 0.95);
        st.bgX = 50; st.bgY = 50; rebuild(); touch();
      };
      fr.readAsDataURL(file);
      e.target.value = '';
    },
  });

  return U.el('div', { class: 'panel' }, [
    group('크기 · 단', [
      U.el('div', { class: 'field-split' }, [
        U.field('비율', U.seg(st.ratio, RATIO_ORDER.map(r => [r, RATIO_LABEL[r] || r]), (v) => { st.ratio = v; rebuild(); touch(); })),
        U.field('너비', U.stepper(st.width, { min: 200, max: 4000, step: 10, unit: 'px', plain: true, onChange: (v) => { st.width = v; touch(); } })),
      ]),
      RATIOS[st.ratio] ? U.el('div', { class: 'tgl-row tgl-boxed' }, [
        U.toggle('자동 분할', st.autoSplit, (v) => { st.autoSplit = v; touch(); }),
      ]) : U.el('div', { class: 'field-split' }, [
        U.field('단', U.el('div', { class: 'seg-tight' }, [U.seg(String(st.columns || 1),
          [['1', '기본(1단)'], ['2', '책 내지(2단)'], ['4', '잡지(4단)']],
          (v) => { setColumns(st, Number(v)); rebuild(); touch(); })])),
        (st.columns || 1) > 1
          ? U.field('단 간격', U.stepper(st.columnGap ?? 64, {
            min: 8, max: 120, step: 4, unit: 'px', plain: true, onChange: (v) => { st.columnGap = v; touch(); },
          }))
          : U.el('span'),
      ]),
      U.el('div', {
        class: 'hint',
        text: RATIOS[st.ratio]
          ? '비율을 고르면 그 높이가 최소 높이가 됩니다. 자동 분할을 켜면 넘치는 만큼 다음 장으로 넘어갑니다. === 로 손수 나눈 자리도 그대로 지켜집니다.'
          : '비율을 고르면 그 높이가 최소 높이가 됩니다. 여러 단 배치는 「자동」에서만 선택 가능합니다.',
      }),
    ]),
    group('여백', [
      U.padGrid(st, ['padTop', 'padRight', 'padBottom', 'padLeft'], () => st.padLinked, touch),
    ], U.check('네 방향 동일', st.padLinked, (v) => { st.padLinked = v; })),
    group('배경', [
      // 단색·그라데이션·투명 칸만으로 무엇을 고르는지 알 수 있어 이름표는 두지 않는다
      bgPicker(st, touch, rebuild),
      // 썸네일 칸이 곧 사진을 넣는 칸이다. 비어 있으면 눌러서 고른다.
      st.bgImage
        ? (() => {
          const t = U.el('img', { class: 'bg-thumb', alt: '', title: '눌러서 다른 사진으로 바꿉니다' });
          t.src = st.bgImage;
          t.addEventListener('click', () => fileInput.click());
          return t;
        })()
        : U.el('button', { class: 'bg-thumb is-empty', type: 'button', onClick: () => fileInput.click() }, [
          U.el('span', { class: 'bg-thumb-plus', text: '+' }),
          U.el('span', { text: '이미지 넣기' }),
        ]),
      U.el('div', { class: 'field-row' }, [
        st.bgImage ? U.el('button', { class: 'btn btn-danger btn-sm', type: 'button', text: '이미지 빼기',
          onClick: () => { st.bgImage = ''; rebuild(); touch(); } }) : null,
        fileInput,
        st.bgImage ? U.el('button', {
          class: 'btn btn-ghost btn-sm push-right', type: 'button',
          text: st.bgAsHeader ? '배경으로 사용' : '헤더로 사용',
          title: st.bgAsHeader ? '본문 위 띠 대신 캔버스 배경으로 씁니다' : '캔버스 배경 대신 본문 위 띠로 씁니다',
          onClick: () => { st.bgAsHeader = !st.bgAsHeader; rebuild(); touch(); },
        }) : null,
      ]),
      st.bgImage && st.bgAsHeader
        ? U.field('헤더 높이', U.stepper(st.bgHeaderH ?? 220, { min: 40, max: 1200, step: 10, unit: 'px', onChange: (v) => { st.bgHeaderH = v; touch(); } }))
        : null,
      st.bgImage && !st.bgAsHeader
        ? U.field('맞춤', U.seg(st.bgFit, [['cover', '꽉 채움'], ['contain', '전체 보임'], ['tile', '반복']], (v) => { st.bgFit = v; touch(); }))
        : null,
      st.bgImage ? U.fieldGrid([
        U.field('불투명도', U.slider(st.bgOpacity, { min: 0, max: 100, step: 5, unit: '%', onChange: (v) => { st.bgOpacity = v; touch(); } })),
        U.field('흐림', U.slider(st.bgBlur ?? 0, { min: 0, max: 60, step: 1, unit: 'px', onChange: (v) => { st.bgBlur = v; touch(); } })),
      ]) : null,
      st.bgImage && (st.bgAsHeader || st.bgFit === 'cover') ? U.el('div', { class: 'field-row is-loose' }, [
        U.el('button', {
          class: 'btn btn-ghost btn-sm', type: 'button', text: '원래 위치로',
          onClick: () => { st.bgX = 50; st.bgY = 50; touch(); },
        }),
        U.el('div', { class: 'hint', text: '미리보기 창에서 여백을 드래그하면 사진의 위치를 조정할 수 있습니다.' }),
      ]) : null,
    ]),
    signGroup(st, touch, rebuild),
    tabReset('canvas', container, onChange),
  ]);
}

/* 서명 묶음 — 제목을 누르면 펼치고 접는다. 꺼 두면 기본으로 접혀 있고,
   켜져 있어도 적은 것이 없으면 그리지 않는다. */
function signGroup(st, touch, rebuild) {
  const on = st.signOn !== false;
  const sw = U.toggle('', on, (v) => { st.signOn = v; rebuild(); touch(); }, null,
    on ? '서명을 그리지 않게 합니다' : '서명을 그리게 합니다');
  // 토글을 눌렀다고 묶음이 접히면 안 된다
  sw.addEventListener('click', (e) => e.stopPropagation());

  /* details 는 요약 아래의 것들을 익명 상자 하나로 묶는다. 그대로 두면
     묶음의 flex gap 이 그 상자 하나에만 걸려 안쪽 칸들이 다닥다닥 붙는다.
     감싸는 칸을 하나 두어 그 안에서 다시 벌린다. */
  const det = U.el('details', { class: 'grp fold-grp' }, [
    U.el('summary', { class: 'grp-t' }, [U.el('span', { text: '서명' }), sw]),
    U.el('div', { class: 'fold-body' }, signFields(st, touch)),
  ]);
  det.open = on;
  return det;
}

/* 서명 편집 칸 — 켠 상태에서는 그대로, 끈 상태에서는 접어 둔다 */
function signFields(st, touch) {
  return [
      U.el('div', { class: 'field-row' }, [
        U.el('input', { type: 'text', value: st.signName, placeholder: '이름',
          onInput: (e) => { st.signName = e.target.value; touch(); } }),
        U.el('input', { type: 'text', value: st.signOrg, placeholder: '제작자',
          onInput: (e) => { st.signOrg = e.target.value; touch(); } }),
      ]),
      U.el('div', { class: 'field' }, [
        U.el('label', { text: '구분·위치' }),
        U.el('div', { class: 'field-row' }, [
          (() => {
            const g = U.seg(st.signSep || 'dot', [['dot', '·'], ['bar', '|']], (v) => { st.signSep = v; touch(); });
            g.classList.add('seg-narrow');
            return g;
          })(),
          U.seg(st.signAlign || 'right', [['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']], (v) => { st.signAlign = v; touch(); }),
        ]),
      ]),
      U.fieldGrid([
        U.field('크기', U.stepper(st.signSize ?? 12, { min: 6, max: 60, step: 1, unit: 'px', onChange: (v) => { st.signSize = v; touch(); } })),
        U.field('본문과 간격', U.stepper(st.signGap ?? 28, { min: 0, max: 200, step: 2, unit: 'px', onChange: (v) => { st.signGap = v; touch(); } })),
      ]),
      U.field('색상', U.color(st.signColor || '#9AA0A6', (v) => { st.signColor = v; touch(); })),
      U.el('div', { class: 'hint', text: '「사용」을 꺼 두거나 이름·제작자를 둘 다 비워 두면 아무것도 그리지 않습니다. 분할하면 각 장에 함께 들어갑니다.' }),
  ];
}

/* 배경 방식 — 예전 저장물은 bgMode 가 없고 transparent 만 있었다 */
function bgMode(st) {
  if (st.transparent) return 'clear';
  return st.bgMode === 'grad' ? 'grad' : 'solid';
}

/* 배경색 고르기 — 고르는 칸 바로 아래에 그 방식이 쓰는 색이 붙는다.

     단색   |  그라데이션  |  투명
   [      ]   [   ][   ]   [▨▨▨]
    hex        hex  hex

   맨 앞 색은 단색과 그라데이션이 함께 쓴다. 어느 쪽이든 「배경색」이다. */
function bgPicker(st, touch, rebuild) {
  const mode = bgMode(st);

  const swatch = (value, onChange) => {
    const sw = U.el('input', {
      type: 'color', class: 'bgcell-sw', value,
      onInput: (e) => { hex.value = e.target.value.toUpperCase(); onChange(e.target.value); },
    });
    const hex = U.el('input', {
      type: 'text', class: 'bgcell-hex', value: value.toUpperCase(),
      onChange: (e) => {
        const v = e.target.value.trim();
        if (/^#[0-9a-f]{6}$/i.test(v)) { sw.value = v; onChange(v); }
        else e.target.value = sw.value.toUpperCase();
      },
    });
    return [sw, hex];
  };

  const [sw1, hex1] = swatch(st.bg, (v) => { st.bg = v; touch(); });
  const [sw2, hex2] = swatch(st.bg, (v) => { st.bg = v; touch(); });
  const [sw3, hex3] = swatch(st.bg2 || '#E9EEF2', (v) => { st.bg2 = v; touch(); });

  return U.el('div', { class: `bgpick is-${mode}` }, [
    U.seg(mode, [['solid', '단색'], ['grad', '그라데이션'], ['clear', '투명']], (v) => {
      st.bgMode = v;
      st.transparent = v === 'clear';
      rebuild(); touch();
    }),
    U.el('div', { class: 'bgpick-row' }, [
      U.el('div', { class: 'bgpick-cell' }, [sw1, hex1]),
      U.el('div', { class: 'bgpick-cell' }, [
        U.el('div', { class: 'bgpick-two' }, [sw2, sw3]),
        U.el('div', { class: 'bgpick-two' }, [hex2, hex3]),
      ]),
      U.el('div', { class: 'bgpick-cell' }),
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
        U.colorCell('각주', st.fnColor, (v) => { st.fnColor = v; touch(); }),
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
    tabReset('color', container, onChange),
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
    group('원본 정보', [
      U.el('div', { class: 'tgl-row tgl-boxed cols-1' }, [
        U.toggle('PNG 에 원문 심기', out.embedSource, (v) => { out.embedSource = v; saveSoon(); }, null,
          '나중에 그 이미지를 편집 창에 끌어다 놓으면 글을 되살릴 수 있습니다'),
      ]),
      U.el('div', { class: 'field-row' }, [
        U.el('button', {
          class: 'btn btn-ghost btn-sm', type: 'button', text: '이미지에서 불러오기',
          onClick: () => pickImport(onChange),
        }),
      ]),
      out.format === 'png' ? null
        : U.el('div', { class: 'hint hint-warn', text: `원문은 PNG 에만 심을 수 있습니다. 지금 포맷(${out.format.toUpperCase()})으로는 저장돼도 담기지 않습니다.` }),
      U.el('div', { class: 'hint', text: '켜 두면 저장하는 PNG 안에 이 글의 원문과 서식이 함께 담깁니다. '
        + 'PNG를 편집 창에 끌어다 놓으면 글을 그대로 되살릴 수 있습니다.' }),
      U.el('div', { class: 'hint', text: '사진은 담기지 않습니다. 프로필 사진은 이름이 같은 프로필이 지금 설정에 있으면 그 사진을 그대로 씁니다.' }),
    ]),
  ]);
}

/* 템플릿 */
function panelTemplate(container, onChange) {
  // 템플릿에는 프로필도 담겨 있다. 적용하면 편집기 위 프로필 줄도 다시 그려야 한다.
  const tpl = buildTemplateSection(
    () => { buildSlotBar(onChange); buildProfileBar(onChange); },
    () => buildSettings(container, onChange),
  );
  return U.el('div', { class: 'panel' }, [tpl.node, storagePanel(container, onChange)]);
}

/* 저장 공간 — 어디에 얼마나 쓰고 있는지 보여 주고 치울 거리를 준다.

   템플릿에도 프로필 사진이 담기므로, 본문에서 프로필을 지워도 템플릿이
   아직 그 사진을 쓰고 있으면 자리가 나지 않는다. 그게 보이지 않아
   「지웠는데 왜 안 줄지」로 이어지므로 여기서 숨김없이 보여 준다. */
function storagePanel(container, onChange) {
  const used = storedBytes();
  const pic = photoUsage();
  const cap = 5 * 1024 * 1024;
  const pct = Math.min(100, Math.round((used / cap) * 100));
  const rebuild = () => buildSettings(container, onChange);

  const bar = U.el('div', { class: 'use-bar' }, [
    U.el('span', { class: `use-fill${pct > 72 ? ' is-warn' : ''}`, style: `width:${pct}%` }),
  ]);

  const rows = [
    bar,
    U.el('div', { class: 'hint', text: `쓰는 중 ${kb(used)} / 5MB 남짓 (${pct}%)` }),
  ];

  if (pic.count) {
    rows.push(U.el('div', { class: 'hint', text: `사진 ${pic.count}장 · ${kb(pic.bytes)}` }));
  }
  if (pic.tplOnly) {
    rows.push(U.el('div', { class: 'hint hint-warn',
      text: `이 가운데 ${pic.tplOnly}장(${kb(pic.tplOnlyBytes)})은 템플릿만 붙들고 있습니다. `
        + '본문에서 프로필을 지워도 이 자리는 나지 않습니다.' }));
  }

  const acts = [];
  if (fatPhotos().length) {
    acts.push(U.el('button', {
      class: 'btn btn-ghost btn-sm', type: 'button', text: `사진 ${fatPhotos().length}장 다시 담기`,
      title: '크기는 그대로 두고 webp 로 다시 담아 자리를 줄입니다',
      onClick: () => compactPhotos(() => { buildProfileBar(onChange); rebuild(); onChange(); }),
    }));
  }
  if (pic.tplOnly) {
    acts.push(U.el('button', {
      class: 'btn btn-ghost btn-sm', type: 'button', text: '템플릿에서 사진 빼기',
      title: '템플릿의 이름·위치·색은 그대로 두고 사진만 뺍니다',
      onClick: () => {
        if (!confirm('모든 템플릿에서 프로필 사진을 뺍니다.\n이름·위치·색은 그대로 남고, 그 템플릿을 적용하면 사진은 지금 것을 씁니다. 계속할까요?')) return;
        const before = storedBytes();
        dropTemplatePhotos();
        saveSoon(() => {
          U.toast(`${kb(before)} → ${kb(storedBytes())} 로 줄였습니다`, 5000);
          rebuild();
        });
      },
    }));
  }
  acts.push(U.el('button', {
    class: 'btn btn-ghost btn-sm is-danger', type: 'button', text: '저장 공간 비우기',
    title: '이 브라우저에 담아 둔 글·설정·템플릿·사진을 전부 지웁니다',
    onClick: () => {
      if (!confirm('이 브라우저에 담아 둔 것을 전부 지웁니다.\n쓰던 글, 모든 설정, 템플릿, 프로필 사진이 다 사라지고 되돌릴 수 없습니다.\n\n먼저 「JSON 내보내기」로 템플릿을 백업하셨나요? 계속할까요?')) return;
      clearStored();
      location.reload();
    },
  }));
  rows.push(U.el('div', { class: 'field-row' }, acts));

  return group('저장 공간', rows);
}

/* ── 사진 넣기 ──────────────────────────────── */
let pickerEl = null;

/* 사진 파일 하나를 커서 자리에 넣는다. 고르기와 끌어다 놓기가 같이 쓴다. */
export function addImageFile(file, onChange, afterAdd) {
  if (!file || !file.type.startsWith('image/')) return;
  const fr = new FileReader();
  fr.onload = async () => {
    const id = Math.random().toString(36).slice(2, 9);
    // 크기는 그대로 두고 webp 로 다시 담는다. 눈에는 그대로고 자리는 확 준다.
    const data = await shrinkPhoto(fr.result, BIG_MAX, 0.95);
    state.text.images.push({ id, data, width: 100 });

    const ta = srcEl();
    const pos = ta.selectionStart;
    const before = ta.value.slice(0, pos);
    const lead = before.length && !before.endsWith('\n') ? '\n' : '';
    replaceRange(ta, pos, ta.selectionEnd, `${lead}[[img:${id}]]\n`);
    state.text.source = ta.value;

    afterAdd?.();
    onChange();
  };
  fr.readAsDataURL(file);
}

export function pickImage(onChange, afterAdd) {
  if (!pickerEl) {
    pickerEl = U.el('input', { type: 'file', accept: 'image/*', style: 'display:none' });
    document.body.appendChild(pickerEl);
  }
  pickerEl.onchange = () => {
    const file = pickerEl.files?.[0];
    pickerEl.value = '';
    addImageFile(file, onChange, afterAdd);
  };
  pickerEl.click();
}

/* ── 프로필 사진 줄이기 ─────────────────────── */
/* 프로필 사진은 화면에서 40px 남짓으로 그려지고, 3배로 저장해도 120px 이다.
   원본을 그대로 담아 두면 브라우저 저장 공간(원본당 5MB 남짓)이 금세 찬다.
   그 5MB 는 본문과 템플릿이 함께 쓰므로, 템플릿에 사진이 한 벌 더 들어가면
   같은 사진을 두 번 담는 셈이 되어 한도를 넘긴다. 넉넉히 256px 로 줄여 담는다. */
const AVA_MAX = 512;
/* 본문·배경 사진은 크게 보이므로 줄이지 않는다. 캔버스 너비 4000px 를 3배로
   찍어도 이 안이라, 다시 담기만 해도 자리가 확 준다. */
const BIG_MAX = 2400;

function shrinkPhoto(dataUrl, max = AVA_MAX, q = 0.92) {
  // 움직이는 그림은 줄이면 한 장으로 굳어 버린다. 그대로 둔다.
  if (/^data:image\/gif/i.test(dataUrl)) return Promise.resolve(dataUrl);
  return new Promise((done) => {
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(im.naturalWidth * k));
      cv.height = Math.max(1, Math.round(im.naturalHeight * k));
      cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
      // 크기를 줄일 게 없어도 webp 로 다시 담으면 훨씬 가벼워진다
      const out = cv.toDataURL('image/webp', q);
      // webp 를 못 만드는 브라우저는 png 를 돌려준다. 그때는 더 작은 쪽을 쓴다.
      done(out.length < dataUrl.length ? out : dataUrl);
    };
    im.onerror = () => done(dataUrl);
    im.src = dataUrl;
  });
}

const kb = (n) => (n < 1024 * 1024 ? `${Math.round(n / 1024)}KB` : `${(n / 1024 / 1024).toFixed(1)}MB`);

/* 자리를 많이 먹는 프로필 사진을 webp 로 다시 담는다. 크기(픽셀)는 그대로다.
   webp 는 png 보다 훨씬 촘촘해서, 500×500 사진 한 장이 468KB 에서 70KB 가 된다. */
const FAT = 220000;
const fatPhotos = () => state.text.profiles.filter(p => p.avatar && p.avatar.length > FAT);

export async function compactPhotos(after) {
  const big = fatPhotos();
  if (!big.length) return false;
  const before = storedBytes();
  for (const p of big) p.avatar = await shrinkPhoto(p.avatar);
  saveSoon((err) => {
    if (err) { U.toast('저장 공간이 모자랍니다. 사진을 몇 장 빼 보세요', 5000); return; }
    U.toast(`사진 ${big.length}장을 다시 담아 ${kb(before)} → ${kb(storedBytes())} 로 줄였습니다`, 5000);
    after?.();
  });
  return true;
}

/* ── 미리보기에서 편집기로 줄 점프 ─────────── */

/* 줄바꿈이 있어 「줄 번호 × 줄 높이」로는 자리를 못 맞춘다.
   같은 폭·같은 글꼴의 그림자를 세워 그 자리까지의 높이를 재 온다. */
function caretTop(ta, pos) {
  const cs = getComputedStyle(ta);
  const ghost = U.el('div');
  for (const k of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing',
    'lineHeight', 'padding', 'borderWidth', 'borderStyle', 'textIndent', 'tabSize',
    'wordBreak', 'overflowWrap', 'wordSpacing']) ghost.style[k] = cs[k];
  Object.assign(ghost.style, {
    position: 'fixed', left: '-99999px', top: '0', visibility: 'hidden',
    width: ta.clientWidth + 'px', height: 'auto',
    boxSizing: 'border-box', whiteSpace: 'pre-wrap',
  });
  ghost.textContent = ta.value.slice(0, pos);
  const mark = U.el('span', { text: '\u200b' });
  ghost.appendChild(mark);
  document.body.appendChild(ghost);
  const top = mark.offsetTop;
  ghost.remove();
  return top;
}

function jumpToLine(line) {
  const ta = srcEl();
  const lines = ta.value.split(/\r?\n/);
  if (!(line >= 0) || line >= lines.length) return false;

  // 모바일에서는 설정 쪽을 보고 있을 수 있다. 편집 쪽으로 돌려놓는다.
  const pane = document.getElementById('editorPane');
  if (pane?.classList.contains('mode-settings')) {
    document.querySelector('.dm-btn[data-dmode="edit"]')?.click();
  }

  let pos = 0;
  for (let i = 0; i < line; i++) pos += lines[i].length + 1;
  ta.focus({ preventScroll: true });
  ta.setSelectionRange(pos, pos + lines[line].length);
  ta.scrollTop = Math.max(0, caretTop(ta, pos) - ta.clientHeight / 2);
  return true;
}

/* 미리보기에서 문단을 누르면 편집기의 그 줄로 간다.
   말풍선은 눌러서 화자를 바꾸는 자리라 건드리지 않고, 사진도 끌어 쓰는
   것이라 뺀다. 말풍선 덩어리의 이름·사진 쪽을 누르면 그 덩어리로 간다. */
export function bindPreviewJump(host) {
  host.addEventListener('click', (e) => {
    if (e.target.closest('.mk-bubble[data-ln]')) return;
    if (e.target.closest('.mk-img[data-img]')) return;
    const block = e.target.closest('[data-lf]');
    if (!block || !host.contains(block)) return;
    if (!jumpToLine(Number(block.dataset.lf))) return;
    // 어디로 갔는지 보이게 잠깐 반짝인다
    block.classList.remove('is-jumped');
    void block.offsetWidth;
    block.classList.add('is-jumped');
    setTimeout(() => block.classList.remove('is-jumped'), 700);
  });
}

/* ── 본문 사진 끌기 ─────────────────────────── */
/* 위아래 가장자리를 잡으면 높이가, 가운데를 잡으면 잘라 낸 틀 안에서
   보이는 자리가 바뀐다. 자를 수 있는 최대는 원래 높이 — 그보다 크게
   늘리면 자르기를 아예 푼다. */

const EDGE = 10;        // 가장자리로 치는 두께(px)
const MIN_H = 40;

/* 미리보기는 배율이 걸려 있을 수 있다. 화면에서 끈 거리를 판 위의 거리로 되돌린다. */
function hostScale(host) {
  const w = host.offsetWidth;
  return w ? host.getBoundingClientRect().width / w : 1;
}

/* 자르지 않았을 때의 높이 — 지금 폭에 맞춰 그렸을 때의 세로 길이 */
function fullHeight(node) {
  if (!node.naturalWidth || !node.naturalHeight) return 0;
  return node.offsetWidth * node.naturalHeight / node.naturalWidth;
}

function zoneOf(node, clientY) {
  const r = node.getBoundingClientRect();
  const edge = Math.min(EDGE, r.height / 3);
  if (clientY - r.top <= edge) return 'top';
  if (r.bottom - clientY <= edge) return 'bottom';
  return 'move';
}

export function bindImageDrag(host, onChange) {
  let drag = null;

  const find = (id) => state.text.images.find(im => im.id === id);

  /* 다시 그리면 한 박자 늦어 끌리는 게 안 보인다. 지금 사진을 바로 고친다. */
  const paint = (im) => {
    host.querySelectorAll(`.mk-img[data-img="${im.id}"]`).forEach((n) => {
      if (im.height) {
        n.style.height = im.height + 'px';
        n.style.objectFit = 'cover';
        n.style.objectPosition = `50% ${im.posY ?? 50}%`;
      } else {
        n.style.height = '';
        n.style.objectFit = '';
        n.style.objectPosition = '';
      }
    });
  };

  host.addEventListener('pointerdown', (e) => {
    const node = e.target.closest?.('.mk-img[data-img]');
    if (!node || !host.contains(node)) return;
    const im = find(node.dataset.img);
    if (!im) return;

    const full = fullHeight(node);
    if (!full) return;
    const h0 = im.height || full;
    const zone = zoneOf(node, e.clientY);
    // 자르지 않은 사진은 옮길 자리가 없다
    if (zone === 'move' && !im.height) return;

    e.preventDefault();
    try { host.setPointerCapture(e.pointerId); } catch { /* 못 잡아도 끌기는 된다 */ }
    const over0 = Math.max(0, full - h0);
    drag = {
      id: e.pointerId, im, zone, full, h0, y: e.clientY,
      p0: im.posY ?? 50,
      top0: (im.posY ?? 50) / 100 * over0,
      k: hostScale(host),
    };
    host.classList.add(zone === 'move' ? 'is-imgmove' : 'is-imgsize');
  });

  host.addEventListener('pointermove', (e) => {
    if (!drag) {
      // 어디를 잡으면 무슨 일이 나는지 마우스 모양으로 알려 준다
      const node = e.target.closest?.('.mk-img[data-img]');
      if (node) {
        const im = find(node.dataset.img);
        const z = zoneOf(node, e.clientY);
        node.style.cursor = z === 'move' ? (im?.height ? 'grab' : 'default') : 'ns-resize';
      }
      return;
    }
    if (e.pointerId !== drag.id) return;

    const { im, zone, full, h0, k } = drag;
    const dy = (e.clientY - drag.y) / (k || 1);
    const clampP = (v) => Math.max(0, Math.min(100, v));

    if (zone === 'move') {
      const over = Math.max(1, full - (im.height || full));
      // 사진을 아래로 밀면 위쪽이 드러난다
      im.posY = clampP(drag.p0 - dy / over * 100);
    } else {
      const h = Math.max(MIN_H, Math.min(full, zone === 'top' ? h0 - dy : h0 + dy));
      if (h >= full - 1) {
        im.height = undefined;
        im.posY = 50;
      } else {
        im.height = Math.round(h);
        const over = full - h;
        // 잡지 않은 쪽 가장자리는 제자리에 두어, 끄는 쪽만 따라오게 한다
        const top = zone === 'top' ? drag.top0 + h0 - h : drag.top0;
        im.posY = clampP(top / over * 100);
      }
    }
    paint(im);
  });

  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    host.classList.remove('is-imgmove', 'is-imgsize');
    onChange();
  };
  host.addEventListener('pointerup', end);
  host.addEventListener('pointercancel', end);
}

/* ── 이미지에서 불러오기 ────────────────────── */

/* 불러오면 설정이 통째로 바뀔 수 있어 화면을 처음부터 다시 짠다. */
function repaintAll(onChange) {
  srcEl().value = state.text.source;
  buildSlotBar(onChange);
  buildProfileBar(onChange);
  buildSettings(document.getElementById('textSettings'), onChange);
  onChange();
}

/* 되돌리기 한 번을 위해 지금 상태를 통째로 떠 둔다. */
function snapshot() {
  return clone({
    source: state.text.source,
    style: state.text.style,
    formats: state.text.formats,
    profiles: state.text.profiles,
    template: state.activeTemplate,
  });
}

function restore(snap, onChange) {
  state.text.source = snap.source;
  Object.assign(state.text.style, snap.style);
  Object.assign(state.text.formats, snap.formats);
  state.text.profiles = snap.profiles;
  state.activeTemplate = snap.template;
  repaintAll(onChange);
  U.toast('불러오기 전으로 되돌렸습니다');
}

function line(text, cls) {
  return U.el('div', { class: cls || 'imp-line', text });
}

/* 「본문만 / 서식까지」를 고르는 확인창 */
function askImport(payload, onChange) {
  const s = summarize(payload);
  const head = [s.when && `저장 ${s.when}`, `${s.chars.toLocaleString()}자`,
    s.count ? `프로필 ${s.count}` : null].filter(Boolean).join('  ·  ');

  const body = [line(head, 'imp-head')];
  for (const n of commonWarnings(payload)) body.push(line(n, 'imp-warn'));

  const only = textOnlyWarnings(payload);
  if (only.length) {
    body.push(line('본문만 가져올 때', 'imp-sub'));
    for (const n of only) body.push(line(n, 'imp-warn'));
  }
  body.push(line('지금 쓰고 있는 글은 덮어써집니다. 사진은 담기지 않아 그대로 남습니다.', 'imp-foot'));

  const take = (mode) => {
    const snap = snapshot();
    applyPayload(payload, mode);
    repaintAll(onChange);
    U.toast(mode === 'all' ? '본문과 서식을 불러왔습니다' : '본문을 불러왔습니다', 6000,
      { label: '되돌리기', onClick: () => restore(snap, onChange) });
  };

  U.modal({
    title: '이미지에서 불러오기',
    body,
    actions: [
      { label: '취소' },
      { label: '본문만', onClick: () => take('text') },
      { label: '본문 + 서식', primary: true, onClick: () => take('all') },
    ],
  });
}

/* PNG 에 심어 둔 정보가 있으면 확인창을 띄우고 true.
   없으면 false — 부르는 쪽이 그냥 본문 사진으로 넣으면 된다. */
async function tryImport(file, onChange) {
  if (!file || file.type !== 'image/png') return false;
  let payload = null;
  try { payload = await extractMeta(file); } catch { payload = null; }
  if (!isPayload(payload)) return false;
  askImport(payload, onChange);
  return true;
}

/* 설정의 「이미지에서 불러오기」 단추 */
let importPicker = null;
function pickImport(onChange) {
  if (!importPicker) {
    importPicker = U.el('input', { type: 'file', accept: 'image/png', style: 'display:none' });
    document.body.appendChild(importPicker);
  }
  importPicker.onchange = async () => {
    const file = importPicker.files?.[0];
    importPicker.value = '';
    if (!file) return;
    if (!await tryImport(file, onChange)) {
      U.toast('이 이미지에는 원본 정보가 없습니다');
    }
  };
  importPicker.click();
}

/* ── 끌어다 놓기 ────────────────────────────── */

/* 놓기 전에는 파일 내용을 못 읽는다. 브라우저가 막아 둔 자리라
   알 수 있는 건 MIME 종류뿐이다. 그것만으로 미리 표시를 나눈다. */
function dropKind(dt) {
  const items = [...(dt?.items || [])].filter(it => it.kind === 'file');
  const n = items.length || (dt?.files?.length ?? 0);
  if (!n) return '';
  if (n > 1) return 'many';
  const t = items[0]?.type ?? '';
  if (t === 'image/png') return 'load';
  if (t === '' || t.startsWith('image/')) return 'photo';
  return 'bad';
}

const DROP_TEXT = {
  load:  ['불러오기 또는 사진 넣기', 'PNG — 원본 정보가 있으면 불러옵니다'],
  photo: ['본문에 사진 넣기', ''],
  many:  ['한 번에 한 장씩', '파일 하나만 놓아 주세요'],
  bad:   ['이미지 파일만', ''],
};

export function bindDropImport(onChange, afterAdd) {
  const ta = srcEl();
  let wrap = ta.parentElement;
  if (!wrap.classList.contains('src-wrap')) {
    wrap = U.el('div', { class: 'src-wrap' });
    ta.parentElement.insertBefore(wrap, ta);
    wrap.appendChild(ta);
  }
  if (wrap.querySelector('.src-drop')) return;

  const title = U.el('div', { class: 'src-drop-t' });
  const note = U.el('div', { class: 'src-drop-n' });
  const veil = U.el('div', { class: 'src-drop', hidden: true }, [
    U.el('div', { class: 'src-drop-box' }, [U.el('span', { class: 'src-drop-i', text: '+' }), title, note]),
  ]);
  wrap.appendChild(veil);

  // dragenter/leave 는 자식 위를 지날 때마다 튄다. 세어서 진짜 나갈 때만 끈다.
  let depth = 0;
  let kind = '';

  const show = (k) => {
    kind = k;
    veil.className = `src-drop is-${k}`;
    const [t, n] = DROP_TEXT[k] || ['', ''];
    title.textContent = t;
    note.textContent = n;
    veil.hidden = false;
  };
  const hide = () => { depth = 0; kind = ''; veil.hidden = true; };

  wrap.addEventListener('dragenter', (e) => {
    const k = dropKind(e.dataTransfer);
    if (!k) return;
    e.preventDefault();
    depth++;
    show(k);
  });
  wrap.addEventListener('dragover', (e) => {
    if (!kind) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = kind === 'many' || kind === 'bad' ? 'none' : 'copy';
  });
  wrap.addEventListener('dragleave', () => { if (--depth <= 0) hide(); });
  wrap.addEventListener('drop', async (e) => {
    if (!kind) return;
    e.preventDefault();
    const files = [...(e.dataTransfer?.files || [])];
    hide();
    if (files.length > 1) { U.toast('한 번에 한 장씩 놓아 주세요'); return; }
    const file = files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { U.toast('이미지 파일만 놓을 수 있습니다'); return; }
    if (await tryImport(file, onChange)) return;
    addImageFile(file, onChange, afterAdd);
  });
}

/* ── 설정 초기화 ────────────────────────────── */
export function resetSettings() {
  Object.assign(state.text.style, clone(DEFAULT_STYLE));
  Object.assign(state.text.formats, clone(DEFAULT_FORMATS));
  Object.assign(state.output, clone(DEFAULT_OUTPUT));
  state.activeTemplate = null;
}

/* ── 편집기 동작 ────────────────────────────── */

/* 글을 바꿔 넣는다.

   setRangeText 는 브라우저가 들고 있는 되돌리기 기록을 지운다. 그래서 단추로
   마커를 넣고 나면 Ctrl+Z 로 그 앞까지 못 간다. execCommand 는 낡았다고
   표시돼 있지만, 사람이 친 것처럼 기록을 남기는 길은 아직 이것뿐이다.
   막히면 예전 방식으로 넣는다 — 되돌리기만 못 할 뿐 결과는 같다. */
function replaceRange(ta, start, end, text, mode = 'end') {
  ta.focus();
  ta.setSelectionRange(start, end);
  let ok = false;
  try {
    ok = text === ''
      ? (start !== end && document.execCommand('delete'))
      : document.execCommand('insertText', false, text);
  } catch (e) { ok = false; }
  if (!ok) ta.setRangeText(text, start, end, 'end');
  if (mode === 'select') ta.setSelectionRange(start, start + text.length);
  return ok;
}
function wrapSelection(open, close, onChange) {
  const ta = srcEl();
  const s = ta.selectionStart, e = ta.selectionEnd;
  const sel = ta.value.slice(s, e);

  // 선택한 덩어리가 마커를 품고 있으면 벗긴다
  if (sel.length >= open.length + close.length && sel.startsWith(open) && sel.endsWith(close)) {
    replaceRange(ta, s, e, sel.slice(open.length, sel.length - close.length), 'select');
  }
  // 마커가 선택 바로 바깥에 있어도 벗긴다
  else if (sel
    && ta.value.slice(Math.max(0, s - open.length), s) === open
    && ta.value.slice(e, e + close.length) === close) {
    replaceRange(ta, s - open.length, e + close.length, sel, 'select');
  }
  // 아니면 감싼다. 마커를 뺀 안쪽만 선택해 두어 한 번 더 누르면 해제되게 한다.
  else {
    const body = sel || '내용';
    replaceRange(ta, s, e, open + body + close);
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

  replaceRange(ta, start, end, next, 'select');
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
  replaceRange(ta, s, e, `${lead}\`\`\`제목\n${sel}\n\`\`\`\n`);
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

  document.getElementById('insertNote').addEventListener('click', () => {
    const id = Math.random().toString(36).slice(2, 9);
    state.text.notes.push({ id, text: '' });
    replaceRange(ta, ta.selectionStart, ta.selectionEnd, `[[fn:${id}]]`);
    state.text.source = ta.value;
    ta.focus();
    onChange();
    buildSettings(document.getElementById('textSettings'), onChange);
  });

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
      replaceRange(ta, pos, ta.selectionEnd, insert);
      state.text.source = ta.value;
      ta.focus();
      onChange();
    });
  });

  document.getElementById('stripText').addEventListener('click', () => {
    const s = ta.selectionStart, e = ta.selectionEnd;
    if (s !== e) {
      replaceRange(ta, s, e, stripMarkers(ta.value.slice(s, e)), 'select');
    } else {
      if (!ta.value || !confirm('전체 글의 서식 마커를 걷어낼까요? 글자는 그대로 남습니다.')) return;
      replaceRange(ta, 0, ta.value.length, stripMarkers(ta.value));
    }
    state.text.source = ta.value;
    ta.focus();
    onChange();
  });

  document.getElementById('clearText').addEventListener('click', () => {
    if (ta.value && !confirm('내용을 모두 지울까요? 서식 설정은 그대로 남습니다.')) return;
    replaceRange(ta, 0, ta.value.length, '');
    state.text.source = ta.value;
    onChange();
    ta.focus();
  });
}
