/* 폰트 로딩 — 선택한 폰트만 그때그때 불러온다.

   source:'cdn'   → <link> 한 줄
   source:'local' → assets/fonts/ 의 woff2 로 @font-face 주입.
                    파일이 없으면 조용히 실패하므로 availability 로 확인한다.
*/
import { FONTS, fontById } from './store.js';

const loaded = new Set();

export function ensureFont(id) {
  if (loaded.has(id)) return;
  const f = fontById(id);
  loaded.add(id);

  if (f.source === 'cdn') {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = f.css;
    link.crossOrigin = 'anonymous';   // 캡쳐 시 폰트를 읽어 이미지에 심으려면 필요
    document.head.appendChild(link);
    return;
  }

  const family = f.stack.split(',')[0].replace(/["']/g, '').trim();
  const css = f.files.map(([url, weight]) => `
@font-face {
  font-family: "${family}";
  src: url("${url}") format("woff2");
  font-weight: ${weight};
  font-display: swap;
}`).join('\n');
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}

/* 실제로 글리프가 나오는지 확인 — 로컬 폰트 파일 누락을 잡아낸다. */
export async function isAvailable(id) {
  const f = fontById(id);
  if (f.source === 'cdn') return true;
  const family = f.stack.split(',')[0].replace(/["']/g, '').trim();
  try {
    await document.fonts.load(`400 16px "${family}"`, '가');
    return document.fonts.check(`400 16px "${family}"`, '가');
  } catch { return false; }
}

export function missingLocalFonts() {
  return FONTS.filter(f => f.source === 'local');
}

/* 캡쳐 직전에 반드시 부른다. 폰트가 준비되기 전에 찍으면 대체 폰트로 나간다. */
export async function fontsReady() {
  try { await document.fonts.ready; } catch { /* noop */ }
}
