/* 마커 파싱 — 평문 + 기호를 스타일 HTML로

   줄 단위
     # 제목            ## 부제목
     > 인용구          (연속된 줄은 하나로 묶인다)
     ```제목           코드블럭 시작 — 제목은 생략 가능
     ```               코드블럭 끝
     ---               구분선
     ===               분할선 (자동 서식과 무관하게 항상 동작)

   줄 안에서
     **굵게**   *행동지문*   _기울임_   "대사"   (괄호)
     {c1 텍스트}       색 슬롯 1~5. 자동 서식보다 우선한다.

   생성하는 태그의 속성은 모두 홑따옴표로 감싼다.
   따옴표 치환이 제 태그를 다시 건드리지 않게 하기 위해서다. */

export const SPLIT_MARK = '===';

const isSplitLine = (t) => /^={3,}$/.test(t);
const isFence = (t) => /^```/.test(t);

export const DEFAULT_FORMATS = {
  bold: true, action: true, italic: true, quote: true, paren: true,
  divider: true, heading: true, blockquote: true, code: true,
};

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(raw, f) {
  let s = esc(raw);

  // 색 슬롯을 가장 먼저. 안쪽 내용은 아래 규칙들이 이어서 훑는다.
  s = s.replace(/\{c([1-5])\s+([^{}]*)\}/g, (_m, n, inner) => `<span class='mk-c${n}'>${inner}</span>`);

  if (f.quote)  s = s.replace(/(["“])([^"“”]+)(["”])/g, "<span class='mk-quote'>$1$2$3</span>");
  if (f.bold)   s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  if (f.action) s = s.replace(/\*([^*]+)\*/g, "<span class='mk-action'>$1</span>");
  if (f.italic) s = s.replace(/_([^_]+)_/g, '<em>$1</em>');
  if (f.paren)  s = s.replace(/\(([^()]*)\)/g, "<span class='mk-paren'>($1)</span>");

  return s;
}

function codeBlock(title, body) {
  const head = title ? `<div class='mk-code-title'>${esc(title)}</div>` : '';
  return `<div class='mk-code'>${head}<div class='mk-code-body'>${esc(body)}</div></div>`;
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

export function renderChunk(chunk, f = DEFAULT_FORMATS) {
  const lines = String(chunk).split(/\r?\n/);
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const t = raw.trim();

    if (f.code && isFence(t)) {
      const title = t.slice(3).trim();
      const body = [];
      i++;
      while (i < lines.length && !isFence(lines[i].trim())) { body.push(lines[i]); i++; }
      i++;                                   // 닫는 울타리
      out.push(codeBlock(title, body.join('\n')));
      continue;
    }

    if (f.blockquote && /^>\s?/.test(t)) {
      const items = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        items.push(`<p class='mk-p'>${inline(lines[i].trim().replace(/^>\s?/, ''), f)}</p>`);
        i++;
      }
      out.push(`<blockquote class='mk-bq'>${items.join('')}</blockquote>`);
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

export function renderWithSplitMarks(source, f) {
  return splitChunks(source)
    .map(c => renderChunk(c, f))
    .join('<div class="mk-splitline-wrap"><hr class="mk-splitline"><span>분할</span><hr class="mk-splitline"></div>');
}

/* 서식 지우기 — 마커만 걷어내고 글은 그대로 둔다.
   따옴표와 괄호는 원래 문장부호이므로 남긴다. 분할선(===)도 남긴다. */
export function stripMarkers(text) {
  return String(text)
    .split(/\r?\n/)
    .filter(l => !isFence(l.trim()) && !/^-{3,}$/.test(l.trim()))
    .map((line) => line
      .replace(/^\s*#{1,2}\s+/, '')
      .replace(/^\s*>\s?/, '')
      .replace(/\{c[1-5]\s+([^{}]*)\}/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/_([^_]+)_/g, '$1'))
    .join('\n');
}
