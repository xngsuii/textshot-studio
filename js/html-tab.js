/* HTML 탭 — 완성된 코드를 붙여넣고 이미지로 뽑는다.

   iframe 에 격리해 페이지 CSS 와 섞이지 않게 하고,
   캡쳐 대상은 iframe 안의 #__shot 요소로 잡는다. */

import { state } from './store.js';
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

function shotCss() {
  const o = state.html.opts;
  const w = o.widthMode === 'manual' ? `${o.width}px` : 'max-content';
  const pad = o.padOn ? `${o.padTop}px ${o.padRight}px ${o.padBottom}px ${o.padLeft}px` : '0';
  const bg = o.transparent ? 'transparent' : o.padBg;
  return `width:${w}; min-width:0; padding:${pad}; background:${bg};`;
}

export function renderPreview(host) {
  host.textContent = '';

  frame = document.createElement('iframe');
  frame.className = 'shot-frame';
  frame.setAttribute('sandbox', 'allow-same-origin');
  frame.style.width = '100%';
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
      const w = Math.ceil(shot.getBoundingClientRect().width);
      const h = Math.ceil(shot.getBoundingClientRect().height);
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
export function buildSettings(container, onChange) {
  const o = state.html.opts;
  container.textContent = '';

  const widthInput = U.num(o.width, { min: 100, max: 4000, step: 10, onChange: (v) => { o.width = v; onChange(); } });
  const widthField = U.field('너비', widthInput);
  widthField.style.display = o.widthMode === 'manual' ? '' : 'none';

  container.appendChild(U.section('크기', true, [
    U.field('너비 기준', U.seg(o.widthMode, [['auto', '코드에 맡김'], ['manual', '직접 지정']], (v) => {
      o.widthMode = v;
      widthField.style.display = v === 'manual' ? '' : 'none';
      onChange();
    })),
    widthField,
    U.fieldWide(U.seg('', [['375', '375'], ['768', '768'], ['1080', '1080'], ['1200', '1200']], (v) => {
      o.widthMode = 'manual';
      o.width = parseInt(v, 10);
      widthInput.value = v;
      widthField.style.display = '';
      onChange();
    })),
    U.fieldWide(U.el('div', { class: 'hint', text: '「코드에 맡김」은 코드가 정한 너비만큼만 잘라냅니다.' })),
  ]));

  container.appendChild(U.section('여백 · 배경', false, [
    U.fieldWide(U.check('여백 넣기', o.padOn, (v) => { o.padOn = v; onChange(); })),
    U.fieldWide(U.check('네 방향 동일', o.padLinked, (v) => { o.padLinked = v; })),
    U.fieldWide(U.padGrid(o, ['padTop', 'padRight', 'padBottom', 'padLeft'], () => o.padLinked, onChange)),
    U.field('배경', U.color(o.padBg, (v) => { o.padBg = v; onChange(); })),
    U.fieldWide(U.check('배경 투명 (PNG 저장 시에만 적용)', o.transparent, (v) => { o.transparent = v; onChange(); })),
  ]));

  const status = U.el('div', { class: 'hint', text: '아직 확인하지 않았습니다.' });
  container.appendChild(U.section('폰트 점검', false, [
    U.fieldWide(U.el('button', {
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
    })),
    U.fieldWide(status),
    U.fieldWide(U.el('div', { class: 'hint', text: 'Google Fonts · jsDelivr · unpkg 는 문제없이 캡쳐됩니다. 그 밖의 주소는 서버 설정에 따라 빠질 수 있습니다.' })),
  ]));
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
