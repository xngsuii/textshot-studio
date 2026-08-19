/* 마커 파싱 — 평문 + 기호를 스타일 HTML로

   줄 단위
     # 제목            ## 부제목
     > 인용구          >2 인용구  (숫자는 색 슬롯 번호)
     ```제목           코드블럭 — 어두운 상자
     ```               제목 없이 열고 안에 HTML/CSS 가 있으면 뷰어로 그린다
     ---               구분선
     ===               분할선 (자동 서식과 무관하게 항상 동작)

   줄 안에서
     **굵게**   *행동지문*   _기울임_   "대사"   (괄호)   ==형광펜==
     {c1 텍스트}       색 슬롯 1~5. 자동 서식보다 우선한다.

   생성하는 태그의 속성은 모두 홑따옴표로 감싼다.
   따옴표 치환이 제 태그를 다시 건드리지 않게 하기 위해서다. */

export const SPLIT_MARK = '===';

const isSplitLine = (t) => /^={3,}$/.test(t);
const isFence = (t) => /^```/.test(t);
const looksLikeHtml = (s) => /<[a-z][^>]*>/i.test(s);

export const DEFAULT_FORMATS = {
  bold: true, action: true, italic: true, quote: true, paren: true,
  highlight: true, divider: true, heading: true, blockquote: true, code: true,
};

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(raw, f) {
  let s = esc(raw);

  // 색 슬롯을 가장 먼저. 안쪽 내용은 아래 규칙들이 이어서 훑는다.
  s = s.replace(/\{c([1-5])\s+([^{}]*)\}/g, (_m, n, inner) => `<span class='mk-c${n}'>${inner}</span>`);

  if (f.highlight) s = s.replace(/==([^=]+)==/g, "<mark class='mk-hl'>$1</mark>");
  if (f.quote)  s = s.replace(/(["“])([^"“”]+)(["”])/g, "<span class='mk-quote'>$1$2$3</span>");
  if (f.bold)   s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  if (f.action) s = s.replace(/\*([^*]+)\*/g, "<span class='mk-action'>$1</span>");
  if (f.italic) s = s.replace(/_([^_]+)_/g, '<em>$1</em>');
  if (f.paren)  s = s.replace(/\(([^()]*)\)/g, "<span class='mk-paren'>($1)</span>");

  return s;
}

/* 코드블럭 안 CSS 가 미리보기 전체로 새지 않도록 선택자 앞에 울타리를 두른다.
   @media 안쪽까지는 손대지 않는다. */
function scopeCss(css, scope) {
  return css.replace(/(^|[};])\s*([^@{};]+)\{/g, (_m, pre, sel) => {
    const s = sel.split(',')
      .map((x) => {
        const t = x.trim();
        if (!t || /^(from|to|\d+%)$/.test(t)) return t;
        return `${scope} ${t}`;
      })
      .join(', ');
    return `${pre} ${s} {`;
  });
}

let viewSeq = 0;

function codeBox(title, body) {
  const head = title ? `<div class='mk-code-title'>${esc(title)}</div>` : '';
  return `<div class='mk-code'>${head}<div class='mk-code-body'>${esc(body)}</div></div>`;
}

function codeViewer(body) {
  const id = `mkv${++viewSeq}`;
  const styles = [];
  const html = body.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_m, css) => { styles.push(css); return ''; });
  const scoped = styles.map((css) => scopeCss(css, `.${id}`)).join('\n');
  return `<div class='mk-view ${id}'>${scoped ? `<style>${scoped}</style>` : ''}${html}</div>`;
}

export function splitChunks(source) {
  const chunks = [[]];
  for (const line of String(source).split(/\r?\n/)) {
    if (isSplitLine(line.trim())) chunks.push([]);
    else chunks[chunks.length - 1].push(line);
  }
  return chunks.map(a => a.join('\n'));
}

export function hasSplit(source) {
  return String(source).split(/\r?\n/).some(l => isSplitLine(l.trim()));
}

export const IMG_RE = /\[\[img:([a-z0-9]+)\]\]/g;
const imgLine = (t) => (t.match(/^\[\[img:([a-z0-9]+)\]\]$/) || [])[1];

export function renderChunk(chunk, f = DEFAULT_FORMATS, images = []) {
  const lines = String(chunk).split(/\r?\n/);
  const byId = new Map(images.map(im => [im.id, im]));
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const t = raw.trim();

    const imgId = imgLine(t);
    if (imgId) {
      const im = byId.get(imgId);
      out.push(im
        ? `<img class='mk-img' src="${im.data}" style='width:${im.width ?? 100}%' alt=''>`
        : "<div class='mk-img-missing'>사진을 찾을 수 없습니다</div>");
      i++;
      continue;
    }

    if (f.code && isFence(t)) {
      const title = t.slice(3).trim();
      const body = [];
      i++;
      while (i < lines.length && !isFence(lines[i].trim())) { body.push(lines[i]); i++; }
      i++;                                   // 닫는 울타리
      const text = body.join('\n');
      // 제목이 없고 안에 태그가 있으면 그려서 보여준다
      out.push(!title && looksLikeHtml(text) ? codeViewer(text) : codeBox(title, text));
      continue;
    }

    if (f.blockquote && /^>[1-5]?\s?/.test(t)) {
      // 색 번호가 같은 줄끼리만 한 덩어리로 묶는다
      const slotOf = (s) => (s.match(/^>([1-5])/) || [])[1] || '';
      const slot = slotOf(t);
      const items = [];
      while (i < lines.length) {
        const cur = lines[i].trim();
        if (!/^>[1-5]?\s?/.test(cur) || slotOf(cur) !== slot) break;
        items.push(`<p class='mk-p'>${inline(cur.replace(/^>[1-5]?\s?/, ''), f)}</p>`);
        i++;
      }
      out.push(`<blockquote class='mk-bq${slot ? ` mk-bq${slot}` : ''}'>${items.join('')}</blockquote>`);
      continue;
    }

    if (t === '') { out.push("<div class='mk-blank'></div>"); i++; continue; }
    if (f.divider && /^-{3,}$/.test(t)) { out.push("<hr class='mk-divider'>"); i++; continue; }

    if (f.heading && /^##\s+/.test(t)) {
      out.push(`<p class='mk-h2'>${inline(t.replace(/^##\s+/, ''), f)}</p>`); i++; continue;
    }
    if (f.heading && /^#\s+/.test(t)) {
      out.push(`<p class='mk-h1'>${inline(t.replace(/^#\s+/, ''), f)}</p>`); i++; continue;
    }

    out.push(`<p class='mk-p'>${inline(raw, f)}</p>`);
    i++;
  }
  return out.join('');
}

export function renderWithSplitMarks(source, f, images = []) {
  return splitChunks(source)
    .map(c => renderChunk(c, f, images))
    .join('<div class="mk-splitline-wrap"><hr class="mk-splitline"><span>분할</span><hr class="mk-splitline"></div>');
}

/* 본문에 박힌 사진 마커를 나온 순서대로 돌려준다 */
export function imageOrder(source) {
  return [...String(source).matchAll(IMG_RE)].map(m => m[1]);
}

/* 자리는 그대로 두고 어떤 사진이 어디에 놓일지만 바꾼다 */
export function reorderImageMarkers(source, order) {
  let i = 0;
  return String(source).replace(IMG_RE, () => `[[img:${order[i++]}]]`);
}

export function removeImageMarker(source, id) {
  return String(source)
    .split(/\r?\n/)
    .filter(l => l.trim() !== `[[img:${id}]]`)
    .join('\n');
}

/* 서식 지우기 — 마커만 걷어내고 글은 그대로 둔다.
   따옴표와 괄호는 원래 문장부호이므로 남긴다. 분할선(===)도 남긴다. */
export function stripMarkers(text) {
  return String(text)
    .split(/\r?\n/)
    .filter(l => !isFence(l.trim()) && !/^-{3,}$/.test(l.trim()))
    .map((line) => line
      .replace(/^\s*#{1,2}\s+/, '')
      .replace(/^\s*>[1-5]?\s?/, '')
      .replace(/\{c[1-5]\s+([^{}]*)\}/g, '$1')
      .replace(/==([^=]+)==/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/_([^_]+)_/g, '$1'))
    .join('\n');
}
