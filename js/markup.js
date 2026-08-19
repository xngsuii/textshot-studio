/* 마커 파싱 — 평문 + 기호를 스타일 HTML로

   **굵게**      → <strong>
   *행동지문*    → .mk-action (보조색)
   "대사"        → .mk-quote  (따옴표색, 곧은/둥근 따옴표 모두)
   _기울임_      → <em>
   ---           → 구분선 (한 줄 전체)
   ===           → 분할선 (한 줄 전체, 자동 서식과 무관하게 항상 동작)
*/

export const SPLIT_MARK = '===';
export const DIVIDER_MARK = '---';

const isSplitLine = (t) => /^={3,}$/.test(t);
const isDividerLine = (t) => /^-{3,}$/.test(t);

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* 인라인 마커. 따옴표를 가장 먼저 처리하고, 생성하는 태그의 속성은
   홑따옴표로 감싸 뒤따르는 치환과 충돌하지 않게 한다. */
function inline(raw, autoFormat) {
  let s = esc(raw);
  if (!autoFormat) return s;

  s = s.replace(/(["“])([^"“”]+)(["”])/g, "<span class='mk-quote'>$1$2$3</span>");
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, "<span class='mk-action'>$1</span>");
  s = s.replace(/_([^_]+)_/g, '<em>$1</em>');
  return s;
}

/* 분할선 기준으로 원문을 조각낸다. 항상 최소 1조각. */
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

/* 한 조각 → HTML */
export function renderChunk(chunk, autoFormat) {
  const out = [];
  for (const raw of String(chunk).split(/\r?\n/)) {
    const t = raw.trim();
    if (t === '') { out.push('<div class="mk-blank"></div>'); continue; }
    if (autoFormat && isDividerLine(t)) { out.push('<hr class="mk-divider">'); continue; }
    out.push(`<p class="mk-p">${inline(raw, autoFormat)}</p>`);
  }
  return out.join('');
}

/* 분할 전 보기 — 분할 위치를 점선으로 표시한 통짜 HTML */
export function renderWithSplitMarks(source, autoFormat) {
  const chunks = splitChunks(source);
  return chunks
    .map(c => renderChunk(c, autoFormat))
    .join('<div class="mk-splitline-wrap"><hr class="mk-splitline"><span>분할</span><hr class="mk-splitline"></div>');
}
