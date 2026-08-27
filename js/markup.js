/* 마커 파싱 — 평문 + 기호를 스타일 HTML로

   줄 단위
     하은: 대사        등록된 프로필 이름으로 시작하면 말풍선
     # 제목            ## 부제목
     > 인용구          >2 인용구 (숫자는 색 슬롯 번호)
     ```제목           코드블럭 — 어두운 상자
     ```               제목 없이 열고 안에 HTML/CSS 가 있으면 뷰어로 그린다
     [[img:id]]        본문 사진
     ---               구분선
     ===               분할선 (자동 서식과 무관하게 항상 동작)

   줄 안에서
     **굵게**   *행동지문*   _기울임_   "대사"   (괄호)   ==형광펜==
     {c1 텍스트}       색 슬롯 1~5. 자동 서식보다 우선한다.

   생성하는 태그의 속성은 홑따옴표로 감싼다. 따옴표 치환이 제 태그를
   다시 건드리지 않게 하기 위해서다. */

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
const attr = (s) => String(s).replace(/'/g, '&#39;').replace(/</g, '&lt;');

/* 색 + 투명도(0~100) 를 하나의 CSS 색으로. 0 이면 아예 투명하다. */
export function withAlpha(hex, pct) {
  const a = pct === undefined || pct === null ? 100 : Number(pct);
  if (hex === 'transparent' || !(a > 0)) return 'transparent';
  if (a >= 100) return hex;
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.round(a) / 100})`;
}

function inline(raw, f, o = {}) {
  let s = esc(raw);

  s = s.replace(/\{c([1-5])\s+([^{}]*)\}/g, (_m, n, inner) => `<span class='mk-c${n}'>${inner}</span>`);

  if (f.highlight) s = s.replace(/==([^=]+)==/g, "<mark class='mk-hl'>$1</mark>");
  // 말풍선 안에서는 따옴표 기호를 감출 수 있다. 색은 그대로 입힌다.
  if (f.quote) {
    s = o.stripQuotes
      ? s.replace(/(["“])([^"“”]+)(["”])/g, "<span class='mk-quote'>$2</span>")
      : s.replace(/(["“])([^"“”]+)(["”])/g, "<span class='mk-quote'>$1$2$3</span>");
  }
  if (f.bold)   s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  if (f.action) s = s.replace(/\*([^*]+)\*/g, "<span class='mk-action'>$1</span>");
  if (f.italic) s = s.replace(/_([^_]+)_/g, '<em>$1</em>');
  if (f.paren)  s = s.replace(/\(([^()]*)\)/g, "<span class='mk-paren'>($1)</span>");

  return s;
}

/* 코드블럭 안 CSS 가 미리보기 전체로 새지 않도록 선택자 앞에 울타리를 두른다. */
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

/* ── 프로필 ──────────────────────────────────
   「이름 | 내용」 으로 쓴 줄만 말풍선이 된다. 등록된 프로필 이름과
   정확히 맞아야 하므로 다른 줄은 건드리지 않는다. */
export const NAME_SEP = '|';

function speakerOf(line, profiles) {
  const t = line.trimStart();
  for (const p of profiles) {
    const name = (p.name || '').trim();
    if (!name || !t.startsWith(name)) continue;
    const rest = t.slice(name.length);
    const m = rest.match(/^\s*\|\s?/);
    if (m) return { profile: p, body: rest.slice(m[0].length) };
  }
  return null;
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

/* 본문 사진 한 장. 높이를 정해 두면 그만큼만 잘라 보여 준다.
   높이와 보이는 자리는 미리보기에서 사진을 끌어 정한다. */
function imgTag(im) {
  const css = [`--imgw:${im.width ?? 100}%`, `border-radius:${im.radius ?? 4}px`];
  if (im.height) {
    css.push(`height:${im.height}px`, 'object-fit:cover', `object-position:50% ${im.posY ?? 50}%`);
  }
  return `<img class='mk-img' data-img='${attr(im.id)}' src="${im.data}" style='${css.join(';')}' alt=''>`;
}
const imgLine = (t) => (t.match(/^\[\[img:([a-z0-9]+)\]\]$/) || [])[1];

/* opts: { formats, images, profiles, chat }
   lineOffset 은 원문에서 이 조각이 시작하는 줄 번호. 미리보기에서 말풍선을
   클릭해 화자를 바꿀 때 어느 줄을 고쳐야 하는지 알기 위해 붙인다. */
export function renderChunk(chunk, opts = {}, lineOffset = 0) {
  const f = opts.formats || DEFAULT_FORMATS;
  const images = opts.images || [];
  const profiles = opts.profiles || [];
  const chat = opts.chat || {};

  const lines = String(chunk).split(/\r?\n/);
  const byId = new Map(images.map(im => [im.id, im]));
  const out = [];
  let i = 0;

  /* 한 덩어리를 만들고 돌아온다. 예전의 continue 자리가 return 이다. */
  const step = () => {
    const raw = lines[i];
    const t = raw.trim();

    /* 말풍선 — 같은 화자가 이어지면 한 덩어리로 묶는다 */
    const sp = profiles.length ? speakerOf(raw, profiles) : null;
    if (sp) {
      const p = sp.profile;
      // 따옴표·괄호 색은 말풍선 안에서만 프로필 것으로 갈아 끼운다
      const skin = `background:${attr(withAlpha(p.bubbleBg, chat.alpha))};color:${attr(p.textColor)}`
        + `;--c-quote:${attr(p.quoteColor || p.textColor)}`
        + `;--c-paren:${attr(p.parenColor || p.textColor)}`;
      const io = { stripQuotes: !!chat.hideQuotesInBubble };
      const bcls = `mk-bubble${chat.parenBreak ? ' is-parenbreak' : ''}`;
      const bubbles = [];
      while (i < lines.length) {
        const cur = speakerOf(lines[i], profiles);
        if (cur && cur.profile === p) {
          // 꼬리와 뾰족한 모서리는 한 묶음의 첫 말풍선에만 붙는다
          const head = bubbles.length === 0 ? ' is-head' : '';
          bubbles.push(
            `<div class='${bcls}${head}' data-ln='${lineOffset + i}' style='${skin}'>${inline(cur.body, f, io)}</div>`,
          );
          i++;
          continue;
        }
        // 빈 줄만 사이에 두고 같은 사람이 이어지면 한 덩어리로 본다.
        // 안 그러면 이름과 사진이 바로 아래 또 나와 딴 사람처럼 보인다.
        if (lines[i].trim() === '') {
          let j = i;
          while (j < lines.length && lines[j].trim() === '') j++;
          const nxt = j < lines.length ? speakerOf(lines[j], profiles) : null;
          if (nxt && nxt.profile === p) { i = j; continue; }
        }
        break;
      }
      const side = p.side === 'right' ? 'is-right' : 'is-left';
      // 이름·사진 표시는 프로필마다 따로 정한다
      const avaSkin = p.avatarColor ? ` style='background:${attr(p.avatarColor)}'` : '';
      const ava = p.showAvatar
        ? (p.avatar
          ? `<img class='mk-ava' src="${p.avatar}" alt=''>`
          : `<span class='mk-ava mk-ava-blank'${avaSkin}></span>`)
        : '';
      const nameSkin = p.nameColor ? ` style='color:${attr(p.nameColor)}'` : '';
      const name = p.showName ? `<div class='mk-speaker'${nameSkin}>${esc(p.name)}</div>` : '';
      out.push(`<div class='mk-chat ${side}'>${ava}<div class='mk-chat-body'>${name}`
        + `<div class='mk-bubbles'>${bubbles.join('')}</div></div></div>`);
      return;
    }

    const imgId = imgLine(t);
    if (imgId) {
      const im = byId.get(imgId);
      out.push(im ? imgTag(im) : "<div class='mk-img-missing'>사진을 찾을 수 없습니다</div>");
      i++;
      return;
    }

    if (f.code && isFence(t)) {
      const title = t.slice(3).trim();
      const body = [];
      i++;
      while (i < lines.length && !isFence(lines[i].trim())) { body.push(lines[i]); i++; }
      i++;
      const text = body.join('\n');
      out.push(!title && looksLikeHtml(text) ? codeViewer(text) : codeBox(title, text));
      return;
    }

    if (f.blockquote && /^>[1-5]?\s?/.test(t)) {
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
      return;
    }

    if (t === '') { out.push("<div class='mk-blank'></div>"); i++; return; }
    if (f.divider && /^-{3,}$/.test(t)) { out.push("<hr class='mk-divider'>"); i++; return; }

    if (f.heading && /^##\s+/.test(t)) {
      out.push(`<p class='mk-h2'>${inline(t.replace(/^##\s+/, ''), f)}</p>`); i++; return;
    }
    if (f.heading && /^#\s+/.test(t)) {
      out.push(`<p class='mk-h1'>${inline(t.replace(/^#\s+/, ''), f)}</p>`); i++; return;
    }

    out.push(`<p class='mk-p'>${inline(raw, f)}</p>`);
    i++;
  };

  /* 덩어리마다 원문 몇 번째 줄에서 왔는지를 붙여 둔다.
     자동 분할로 장을 나눈 뒤 「그 장의 원문」을 도로 오려 내려면 이게 있어야 한다. */
  while (i < lines.length) {
    const from = i;
    const mark = out.length;
    step();
    if (i <= from) i = from + 1;          // 만에 하나 제자리걸음이면 밀어 준다
    for (let k = mark; k < out.length; k++) {
      out[k] = out[k].replace(/^<([a-z0-9]+)/i, `<$1 data-lf='${lineOffset + from}' data-lt='${lineOffset + i - 1}'`);
    }
  }

  /* 말풍선과 말풍선 사이에만 놓인 빈 줄은 걷어낸다.
     원문에서는 읽기 좋으라고 한 줄 띄우는 일이 많은데, 그러면 말풍선 사이가
     빈 줄 높이에 묶여 「말풍선 간격」이 아무 일도 못 한다. 그 사이만큼은
     설정값이 맡도록 비켜 준다. (지문이 끼어 있으면 손대지 않는다) */
  // 줄 번호가 앞에 끼어 있으니 시작 부분이 아니라 클래스로 알아본다
  const isChat = (h) => h.includes("class='mk-chat ");
  const isBlank = (h) => h.includes("class='mk-blank'");
  for (let a = 0; a < out.length; a++) {
    if (!isChat(out[a])) continue;
    let b = a + 1;
    while (b < out.length && isBlank(out[b])) b++;
    if (b > a + 1 && b < out.length && isChat(out[b])) out.splice(a + 1, b - a - 1);
  }

  return out.join('');
}

export function renderWithSplitMarks(source, opts) {
  const chunks = splitChunks(source);
  let offset = 0;
  return chunks
    .map((c) => {
      const html = renderChunk(c, opts, offset);
      offset += c.split(/\r?\n/).length + 1;   // 조각 줄 수 + 분할선 한 줄
      return html;
    })
    .join('<div class="mk-splitline-wrap"><hr class="mk-splitline"><span>분할</span><hr class="mk-splitline"></div>');
}

/* 분할 후 보기·저장에서 각 조각이 원문 몇 번째 줄부터인지 */
export function chunkOffsets(source) {
  const offs = [];
  let offset = 0;
  for (const c of splitChunks(source)) {
    offs.push(offset);
    offset += c.split(/\r?\n/).length + 1;
  }
  return offs;
}

/* ── 사진 마커 ──────────────────────────────── */
export function imageOrder(source) {
  return [...String(source).matchAll(IMG_RE)].map(m => m[1]);
}

export function removeImageMarker(source, id) {
  return String(source)
    .split(/\r?\n/)
    .filter(l => l.trim() !== `[[img:${id}]]`)
    .join('\n');
}

/* ── 프로필 바꾸기 ──────────────────────────
   미리보기에서 말풍선을 누르면 그 줄의 이름표만 갈아 끼운다.
   지문은 건드리지 않고 말풍선끼리만 오간다. */
export function setSpeakerAt(source, lineNo, nextName, profiles) {
  const lines = String(source).split(/\r?\n/);
  if (lineNo < 0 || lineNo >= lines.length) return source;

  const cur = speakerOf(lines[lineNo], profiles);
  if (!cur || !nextName) return source;

  const indent = lines[lineNo].match(/^\s*/)[0];
  lines[lineNo] = `${indent}${nextName} ${NAME_SEP} ${cur.body}`;
  return lines.join('\n');
}

/* 프로필 이름을 바꿀 때 본문의 이름표도 같이 옮긴다 */
export function renameSpeaker(source, oldName, newName, profiles) {
  if (!oldName || !newName) return source;
  return String(source).split(/\r?\n/).map((l) => {
    const cur = speakerOf(l, profiles);
    if (!cur || cur.profile.name !== oldName) return l;
    const indent = l.match(/^\s*/)[0];
    return `${indent}${newName} ${NAME_SEP} ${cur.body}`;
  }).join('\n');
}

export function speakerNameAt(source, lineNo, profiles) {
  const lines = String(source).split(/\r?\n/);
  const cur = speakerOf(lines[lineNo] ?? '', profiles);
  return cur ? cur.profile.name : null;
}

/* 서식 지우기 — 마커만 걷어내고 글은 그대로 둔다. */
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
