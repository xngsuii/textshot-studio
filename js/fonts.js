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
  // woff2 를 먼저 시도하고 파일이 없으면 브라우저가 알아서 다음 줄로 넘어간다.
  // 어느 형식을 넣든 동작하되, 용량이 작은 woff2 가 우선이다.
  const css = f.files.map(([path, weight]) => `
@font-face {
  font-family: "${family}";
  src: url("${path}.woff2") format("woff2"),
       url("${path}.woff")  format("woff");
  font-weight: ${weight};
  font-display: swap;
}`).join('\n');
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}

/* 실제로 글리프가 나오는지 확인 — 로컬 폰트 파일 누락을 잡아낸다.
   방금 넣은 @font-face 가 아직 파싱되지 않았을 수 있어 몇 번 다시 본다. */
export async function isAvailable(id) {
  const f = fontById(id);
  if (f.source === 'cdn') return true;
  const family = f.stack.split(',')[0].replace(/["']/g, '').trim();
  const q = `400 16px "${family}"`;

  for (let i = 0; i < 4; i++) {
    try {
      const faces = await document.fonts.load(q, '가');
      if (faces.length && document.fonts.check(q, '가')) return true;
    } catch { /* 파일이 없으면 여기로 온다 */ }
    await new Promise(r => setTimeout(r, 120));
  }
  return false;
}

export function missingLocalFonts() {
  return FONTS.filter(f => f.source === 'local');
}

/* 캡쳐 직전에 반드시 부른다. 폰트가 준비되기 전에 찍으면 대체 폰트로 나간다. */
export async function fontsReady() {
  try { await document.fonts.ready; } catch { /* noop */ }
}
