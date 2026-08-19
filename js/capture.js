/* 캡쳐 파이프라인 — 두 탭이 공유한다.
   나중에 서버리스 렌더링으로 갈아끼울 수 있도록 이 파일만 교체하면 되게 둔다. */

import { domToCanvas } from '../vendor/modern-screenshot.js';
import { fontsReady } from './fonts.js';

const MIME = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };

export async function nodeToBlob(node, { scale = 2, format = 'png', quality = 0.92, background } = {}) {
  await fontsReady();
  const canvas = await domToCanvas(node, {
    scale,
    backgroundColor: background ?? null,
    // 폰트를 이미지에 심는다. CORS 를 허용하지 않는 서버의 폰트는 여기서 조용히 빠진다.
    font: {},
  });
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
