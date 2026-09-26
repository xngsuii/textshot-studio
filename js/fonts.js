/* 폰트 로딩 — 선택한 폰트만 그때그때 불러온다.

   source:'cdn'   → <link> 한 줄
   source:'local' → assets/fonts/ 의 woff2 로 @font-face 주입.
                    파일이 없으면 조용히 실패하므로 availability 로 확인한다.
*/
import { FONTS, fontById } from './store.js?v=68';

const loaded = new Set();

export function ensureFont(id) {
  if (loaded.has(id)) return;
  const f = fontById(id);
  loaded.add(id);

  if (f.css) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = f.css;
    link.crossOrigin = 'anonymous';   // 캡쳐 시 폰트를 읽어 이미지에 심으려면 필요
    document.head.appendChild(link);
    return;
  }

  const family = f.stack.split(',')[0].replace(/["']/g, '').trim();
  /* faces 는 주소를 통째로 적은 것(스타일시트가 없는 CDN 글꼴),
     files 는 assets/fonts 안의 경로다. 경로 쪽은 woff2 를 먼저 시도하고
     파일이 없으면 브라우저가 알아서 다음 줄로 넘어간다. */
  /* 글꼴 파일을 고쳐도 브라우저가 예전 것을 계속 쓰지 않게 판 번호를 붙인다.
     주소를 통째로 적은 CDN 글꼴은 그쪽에서 관리하므로 건드리지 않는다. */
  const ver = document.querySelector('meta[name="app-version"]')?.content || '';
  const q = ver ? `?v=${ver}` : '';
  const src = (path) => (/^https?:/.test(path)
    ? `url("${path}") format("${path.endsWith('.woff2') ? 'woff2' : 'woff'}")`
    : `url("${path}.woff2${q}") format("woff2"),
       url("${path}.woff${q}")  format("woff")`);
  const css = (f.faces || f.files).map(([path, weight]) => `
@font-face {
  font-family: "${family}";
  src: ${src(path)};
  font-weight: ${weight};
  font-display: swap;
}`).join('\n');
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}

/* 폰트 파일이 자리에 있는지만 본다.
   document.fonts.load 로 확인하면 @font-face 가 등록된 폰트만 잡히고,
   등록 안 된 나머지는 전부 없는 것으로 나온다. 게다가 확인하자고
   수 MB 짜리 파일을 내려받게 된다. 파일 머리만 물어보는 편이 정확하고 싸다. */
const availCache = new Map();

export async function isAvailable(id) {
  const f = fontById(id);
  if (f.source === 'cdn') return true;
  if (availCache.has(id)) return availCache.get(id);

  const probe = (async () => {
    for (const [path] of f.files) {
      for (const ext of ['woff2', 'woff']) {
        try {
          const r = await fetch(`${path}.${ext}`, { method: 'HEAD', cache: 'no-cache' });
          if (r.ok) return true;
        } catch { /* 다음 후보로 */ }
      }
    }
    return false;
  })();

  availCache.set(id, probe);
  const ok = await probe;
  availCache.set(id, ok);
  return ok;
}

/* 캡쳐 직전에 반드시 부른다. 폰트가 준비되기 전에 찍으면 대체 폰트로 나간다. */
export async function fontsReady() {
  try { await document.fonts.ready; } catch { /* noop */ }
}
