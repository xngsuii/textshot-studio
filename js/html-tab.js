/* HTML 탭 — 완성된 코드를 붙여넣고 이미지로 뽑는다.

   iframe 에 격리해 페이지 CSS 와 섞이지 않게 하고,
   캡쳐 대상은 iframe 안의 #__shot 요소로 잡는다. */

import { state, DEFAULT_HTML } from './store.js';
import * as U from './ui.js';

let frame = null;
let readyResolve = null;

const PAGE = (userCode, css) => `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  html, body { margin: 0; padding: 0; background: transparent; }
  #__shot { box-sizing: border-box; ${css} }
</style>
</head>
<body><div id="__shot">${userCode}</div></body></html>`;

/* 「코드에 맡김」일 때는 우선 넉넉한 너비로 그린 뒤, 내용이 실제로 차지한
   너비를 재서 거기에 맞춘다. max-content 로 감싸면 max-width 가 걸린 요소가
   글자 길이만큼 쪼그라들어 의도한 너비가 나오지 않는다. */
const AUTO_PROBE = 2400;

function shotCss() {
  const o = state.html.opts;
  const w = o.widthMode === 'manual' ? `${o.width}px` : `${AUTO_PROBE}px`;
  const pad = o.padOn ? `${o.padTop}px ${o.padRight}px ${o.padBottom}px ${o.padLeft}px` : '0';
  const bg = o.transparent ? 'transparent' : o.padBg;
  return `width:${w}; min-width:0; padding:${pad}; background:${bg};`;
}

function contentWidth(shot) {
  let max = 0;
  for (const child of shot.children) {
    const r = child.getBoundingClientRect();
    if (r.width > max) max = r.width;
  }
  return max;
}

export function renderPreview(host) {
  host.textContent = '';

  frame = document.createElement('iframe');
  frame.className = 'shot-frame';
  frame.setAttribute('sandbox', 'allow-same-origin');
  // 재기 전까지는 넉넉하게. fit() 이 실제 크기로 줄인다.
  frame.style.width = AUTO_PROBE + 'px';
  frame.style.height = '0px';
  frame.srcdoc = PAGE(state.html.source, shotCss());

  const stage = U.el('div', { class: 'stage' });
  stage.style.background = 'transparent';
  stage.style.boxShadow = 'none';
  stage.appendChild(frame);

  const wrap = U.el('div', { class: 'stage-wrap' }, [stage]);
  host.appendChild(wrap);

  const ready = new Promise((res) => { readyResolve = res; });

  frame.addEventListener('load', () => {
    const doc = frame.contentDocument;
    const shot = doc?.getElementById('__shot');
    if (!shot) { readyResolve?.(null); return; }
    // 폰트가 들어오면 크기가 달라지므로 한 번 더 맞춘다.
    const fit = () => {
      const o = state.html.opts;
      if (o.widthMode === 'auto') {
        const inner = contentWidth(shot);
        const padX = o.padOn ? o.padLeft + o.padRight : 0;
        if (inner > 0) shot.style.width = Math.ceil(inner + padX) + 'px';
      }
      const r = shot.getBoundingClientRect();
      const w = Math.ceil(r.width);
      const h = Math.ceil(r.height);
      frame.style.width = w + 'px';
      frame.style.height = h + 'px';
      stage.style.width = w + 'px';
      readyResolve?.(shot);
    };
    fit();
    doc.fonts?.ready.then(fit).catch(() => {});
    setTimeout(fit, 300);
  });

  return ready;
}

export function getShotNode() {
  return frame?.contentDocument?.getElementById('__shot') || null;
}

/* ── 외부 폰트 점검 ──────────────────────────
   붙여넣은 코드에서 폰트 URL 을 뽑아 실제로 읽을 수 있는지 본다.
   읽지 못하는 서버의 폰트는 캡쳐 이미지에 들어가지 않는다. */
export async function checkFontHosts(source) {
  const urls = new Set();
  const re = /https?:\/\/[^\s'")]+/g;
  for (const m of String(source).matchAll(re)) {
    const u = m[0];
    if (/fonts\.googleapis\.com|fonts\.gstatic\.com|\.woff2?|\.otf|\.ttf|\.css/i.test(u)) urls.add(u);
  }
  if (!urls.size) return { ok: true, failed: [] };

  const failed = [];
  await Promise.all([...urls].slice(0, 8).map(async (u) => {
    try {
      const r = await fetch(u, { mode: 'cors' });
      if (!r.ok) failed.push(u);
    } catch { failed.push(u); }
  }));
  return { ok: failed.length === 0, failed };
}

/* ── 설정 패널 ──────────────────────────────── */
function group(title, children) {
  return U.el('div', { class: 'grp' }, [
    title ? U.el('div', { class: 'grp-t', text: title }) : null,
    ...children.filter(Boolean),
  ]);
}

export function buildSettings(container, onChange) {
  const o = state.html.opts;
  const rebuild = () => buildSettings(container, onChange);
  container.textContent = '';

  const panel = U.el('div', { class: 'panel' });

  /* 크기 — 너비 프리셋은 「직접 지정」일 때만 쓸모가 있으므로 그때만 보인다 */
  panel.appendChild(group('크기', [
    U.field('너비 기준', U.seg(o.widthMode, [['auto', '코드에 맡김'], ['manual', '직접 지정']], (v) => {
      o.widthMode = v; rebuild(); onChange();
    })),
    o.widthMode === 'manual'
      ? U.field('너비', U.stepper(o.width, { min: 100, max: 4000, step: 10, unit: 'px', onChange: (v) => { o.width = v; onChange(); } }))
      : null,
    o.widthMode === 'manual'
      ? U.seg(String(o.width), [['375', '375'], ['768', '768'], ['1080', '1080'], ['1200', '1200']], (v) => {
        o.width = parseInt(v, 10); rebuild(); onChange();
      })
      : null,
    U.el('div', {
      class: 'hint',
      text: o.widthMode === 'auto'
        ? '코드가 정한 너비(max-width 포함)를 그대로 따릅니다.'
        : '여기서 정한 너비로 그립니다. 코드의 max-width 보다 넓으면 남는 자리는 여백이 됩니다.',
    }),
  ]));

  panel.appendChild(group('여백 · 배경', [
    U.check('여백 넣기', o.padOn, (v) => { o.padOn = v; rebuild(); onChange(); }),
    o.padOn ? U.check('네 방향 동일', o.padLinked, (v) => { o.padLinked = v; }) : null,
    o.padOn ? U.padGrid(o, ['padTop', 'padRight', 'padBottom', 'padLeft'], () => o.padLinked, onChange) : null,
    U.check('배경 투명 (PNG 저장 시에만 적용)', o.transparent, (v) => { o.transparent = v; rebuild(); onChange(); }),
    !o.transparent ? U.field('배경', U.color(o.padBg, (v) => { o.padBg = v; onChange(); })) : null,
  ]));

  const status = U.el('div', { class: 'hint', text: '아직 확인하지 않았습니다.' });
  panel.appendChild(group('폰트 점검', [
    U.el('div', { class: 'field-row' }, [U.el('button', {
      class: 'btn btn-ghost btn-sm', type: 'button', text: '외부 폰트 읽을 수 있는지 확인',
      onClick: async () => {
        status.textContent = '확인 중…';
        status.className = 'hint';
        const r = await checkFontHosts(state.html.source);
        if (r.ok) { status.textContent = '외부 폰트를 모두 읽을 수 있습니다. 캡쳐에 그대로 들어갑니다.'; }
        else {
          status.className = 'hint hint-warn';
          status.textContent = `읽지 못한 주소 ${r.failed.length}개 — 이 폰트는 이미지에 포함되지 않고 대체 폰트로 나갑니다.\n${r.failed.join('\n')}`;
          status.style.whiteSpace = 'pre-wrap';
        }
      },
    })]),
    status,
    U.el('div', { class: 'hint', text: 'Google Fonts · jsDelivr · unpkg 는 문제없이 캡쳐됩니다. 그 밖의 주소는 서버 설정에 따라 빠질 수 있습니다.' }),
  ]));

  container.appendChild(panel);
}

export function resetSettings() {
  Object.assign(state.html.opts, JSON.parse(JSON.stringify(DEFAULT_HTML)));
}

export function bindEditor(onChange) {
  const ta = document.getElementById('htmlSrc');
  ta.value = state.html.source;
  ta.addEventListener('input', () => { state.html.source = ta.value; onChange(); });
  document.getElementById('clearHtml').addEventListener('click', () => {
    if (ta.value && !confirm('내용을 모두 지울까요? 설정은 그대로 남습니다.')) return;
    ta.value = '';
    state.html.source = '';
    onChange();
    ta.focus();
  });
}
