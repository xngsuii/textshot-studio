/* 캡쳐 파이프라인 — 두 탭이 공유한다.
   나중에 서버리스 렌더링으로 갈아끼울 수 있도록 이 파일만 교체하면 되게 둔다. */

import { domToCanvas } from '../vendor/modern-screenshot.js';
import { fontsReady } from './fonts.js';

const MIME = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };

/* 가장자리의 투명한 테두리를 잘라낸다.

   살아 있는 화면에서는 자식의 세로 마진이 부모 밖으로 빠져나가지만(마진 상쇄),
   캡쳐는 노드를 복제해 따로 그리기 때문에 그 마진이 안쪽에 남아 여백이 된다.
   DOM 을 재서는 알 수 없으니 그려진 픽셀을 보고 잘라낸다.

   투명한 가장자리만 건드린다. 색이 칠해진 테두리는 사용자가 정한 여백일 수
   있어 손대지 않는다. 배경이 불투명하면 이 함수는 아무것도 하지 않는다. */
export function trimCanvas(canvas) {
  const w = canvas.width, h = canvas.height;
  if (!w || !h) return canvas;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const d = ctx.getImageData(0, 0, w, h).data;

  if (d[3] > 8) return canvas;                 // 모서리가 불투명하면 그대로 둔다
  const isBlank = (i) => d[i + 3] <= 8;

  let top = 0, bottom = h - 1, left = 0, right = w - 1;
  const rowBlank = (y) => { for (let x = 0; x < w; x++) if (!isBlank((y * w + x) * 4)) return false; return true; };
  const colBlank = (x) => { for (let y = top; y <= bottom; y++) if (!isBlank((y * w + x) * 4)) return false; return true; };

  while (top < bottom && rowBlank(top)) top++;
  while (bottom > top && rowBlank(bottom)) bottom--;
  while (left < right && colBlank(left)) left++;
  while (right > left && colBlank(right)) right--;

  const nw = right - left + 1, nh = bottom - top + 1;
  if (nw === w && nh === h) return canvas;
  if (nw < 1 || nh < 1) return canvas;

  const out = document.createElement('canvas');
  out.width = nw; out.height = nh;
  out.getContext('2d').drawImage(canvas, left, top, nw, nh, 0, 0, nw, nh);
  return out;
}

/* 마지막으로 저장한 이미지의 실제 크기. 잘라내기 뒤 값이라 미리보기와 다를 수 있다. */
export let lastSize = null;

/* 사파리는 캔버스 전체 픽셀 수에 상한이 있고, 넘으면 오류 없이 빈 이미지를
   돌려준다. 조용히 실패하는 편이 제일 나쁘므로 미리 배율을 낮춘다. */
export const CANVAS_BUDGET = 16_000_000;

export function fitScale(node, scale) {
  const r = node.getBoundingClientRect();
  const area = Math.max(1, r.width * r.height);
  let s = scale;
  while (s > 1 && area * s * s > CANVAS_BUDGET) s -= 1;
  return s;
}

export async function nodeToBlob(node, { scale = 2, format = 'png', quality = 0.92, background, trim = false } = {}) {
  await fontsReady();
  let canvas = await domToCanvas(node, {
    scale,
    backgroundColor: background ?? null,
    // 폰트를 이미지에 심는다. CORS 를 허용하지 않는 서버의 폰트는 여기서 조용히 빠진다.
    font: {},
  });
  if (trim) canvas = trimCanvas(canvas);
  lastSize = { w: canvas.width, h: canvas.height };

  const type = MIME[format] || MIME.png;
  return await new Promise((res, rej) => {
    canvas.toBlob(b => (b ? res(b) : rej(new Error('이미지 변환 실패'))), type, quality);
  });
}

export function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

export function buildName(prefix, ext, index = null) {
  const base = `${prefix || 'excerpt'}_${stamp()}`;
  return index === null ? `${base}.${ext}` : `${base}_${index}.${ext}`;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* 3장 이상은 브라우저가 연속 다운로드를 막을 수 있어 ZIP 으로 묶는다. */
export async function downloadMany(blobs, prefix, ext) {
  if (blobs.length === 1) {
    downloadBlob(blobs[0], buildName(prefix, ext));
    return '1장 저장';
  }
  if (blobs.length === 2 || typeof window.JSZip === 'undefined') {
    blobs.forEach((b, i) => setTimeout(() => downloadBlob(b, buildName(prefix, ext, i + 1)), i * 250));
    return `${blobs.length}장 저장`;
  }
  const zip = new window.JSZip();
  blobs.forEach((b, i) => zip.file(buildName(prefix, ext, i + 1), b));
  const out = await zip.generateAsync({ type: 'blob' });
  downloadBlob(out, `${prefix || 'excerpt'}_${stamp()}.zip`);
  return `${blobs.length}장을 ZIP 으로 저장`;
}

/* 클립보드는 PNG 만 안정적으로 지원된다. */
export async function copyToClipboard(blob) {
  if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
    throw new Error('이 브라우저는 이미지 클립보드 복사를 지원하지 않습니다');
  }
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}
