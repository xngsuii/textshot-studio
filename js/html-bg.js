/* 캔버스 배경에 까는 HTML.

   캡쳐는 iframe 안쪽을 찍지 못하고, 코드를 판에 바로 넣으면 그 CSS 가
   본문까지 흔든다. 그래서 보이지 않는 iframe 에 판 크기 그대로 그린 뒤
   사진으로 찍어 판 뒤에 깐다. 판 크기가 바뀌면 그 크기로 다시 찍으므로
   100vw · 100vh · % 로 짠 반응형 코드가 판에 맞춰 그려진다.

   iframe 은 sandbox 에 allow-scripts 를 주지 않아 코드 안 <script> 는 돌지 않는다. */

import { domToCanvas } from '../vendor/modern-screenshot.js';
import { CANVAS_BUDGET } from './capture.js?v=85';

/* 코드 앞에 바탕 규칙을 먼저 깐다. 코드 쪽 규칙이 뒤에 오므로 그쪽이 이긴다. */
const BASE = '<style>html,body{margin:0;width:100%;height:100%;background:transparent;}</style>';

// 같은 코드·크기를 다시 찍지 않는다. 오래된 것부터 버린다.
const cache = new Map();
const CACHE_MAX = 12;
// 새 크기를 찍는 동안 비워 두지 않으려고, 코드마다 마지막으로 찍은 것을 들고 있는다.
const last = new Map();

export const hasHtmlBg = (st) => !!(st?.bgHtml || '').trim();

function remember(key, url) {
  cache.set(key, url);
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
}

/* 판이 클수록 배율을 낮춘다 — 저장 배율과 같게 찍어야 내보낸 그림이 흐리지 않다 */
function pickScale(w, h, wanted) {
  let s = Math.max(1, wanted);
  while (s > 1 && w * h * s * s > CANVAS_BUDGET) s -= 1;
  return s;
}

function shoot(code, w, h, scale) {
  return new Promise((resolve) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-same-origin');
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.cssText = `position:fixed;left:-100000px;top:0;border:0;width:${w}px;height:${h}px;`;
    let done = false;
    const finish = (url) => {
      if (done) return;
      done = true;
      frame.remove();
      resolve(url);
    };
    frame.addEventListener('load', async () => {
      try {
        const doc = frame.contentDocument;
        await Promise.race([doc.fonts?.ready, new Promise(r => setTimeout(r, 1500))]);
        const canvas = await domToCanvas(doc.documentElement, { width: w, height: h, scale, font: {} });
        finish(canvas.toDataURL('image/png'));
      } catch (e) {
        console.warn('HTML 배경을 그리지 못했습니다', e);
        finish('');
      }
    });
    setTimeout(() => finish(''), 8000);           // 끝내 안 그려지면 비워 둔다
    frame.srcdoc = BASE + code;
    document.body.appendChild(frame);
  });
}

export async function snapshot(code, w, h, wanted = 2) {
  w = Math.round(w); h = Math.round(h);
  if (!code.trim() || !w || !h) return '';
  const scale = pickScale(w, h, wanted);
  const key = `${w}x${h}@${scale}\n${code}`;
  if (cache.has(key)) return cache.get(key);
  const url = await shoot(code, w, h, scale);
  if (url) { remember(key, url); last.set(code, url); }
  while (last.size > 4) last.delete(last.keys().next().value);
  return url;
}

/* 판 맨 뒤에 깔 빈 판. 사진은 paint 가 판 크기를 잰 뒤에 채운다. */
export function htmlBgLayer(st) {
  const layer = document.createElement('div');
  layer.className = 'stage-hbg';
  const prev = last.get(st.bgHtml);
  if (prev) layer.style.backgroundImage = `url("${prev}")`;
  return layer;
}

/* 판들에 HTML 배경을 채운다. 저장할 때는 다 채워질 때까지 기다린다. */
export function paint(stages, code, wanted = 2) {
  return Promise.all(stages.map(async (stage) => {
    const layer = stage.querySelector(':scope > .stage-hbg');
    if (!layer) return;
    const url = await snapshot(code, stage.offsetWidth, stage.offsetHeight, wanted);
    // 찍는 사이에 미리보기가 새로 그려졌으면 이 판은 이미 떨어져 나갔다
    if (url && layer.isConnected) layer.style.backgroundImage = `url("${url}")`;
  }));
}
