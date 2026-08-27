/* 상태 + localStorage + 폰트 목록 */

export const FONTS = [
  {
    id: 'pretendard', label: 'Pretendard', source: 'cdn',
    stack: '"Pretendard Variable", Pretendard, sans-serif',
    css: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.css',
  },
  {
    id: 'noto-sans-kr', label: 'Noto Sans KR', source: 'cdn',
    stack: '"Noto Sans KR", sans-serif',
    css: 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap',
  },
  {
    id: 'noto-serif-kr', label: 'Noto Serif KR', source: 'cdn',
    stack: '"Noto Serif KR", serif',
    css: 'https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@300;400;600;700&display=swap',
  },
  {
    id: 'nanum-myeongjo', label: '나눔명조', source: 'cdn',
    stack: '"Nanum Myeongjo", serif',
    css: 'https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700;800&display=swap',
  },
  {
    id: 'gowun-batang', label: '고운바탕', source: 'cdn',
    stack: '"Gowun Batang", serif',
    css: 'https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&display=swap',
  },
  // ─ 아래 넷은 CDN에 없어 폰트 파일을 직접 넣어야 함 (assets/fonts/README.md 참고)
  //   files 의 경로는 확장자를 뺀 것. woff2 를 먼저 찾고 없으면 woff 로 넘어간다.
  { id: 'maruburi',  label: '마루 부리',     source: 'local', stack: '"MaruBuri", serif',
    files: [['assets/fonts/MaruBuri-Regular', 400], ['assets/fonts/MaruBuri-Bold', 700]] },
  { id: 'kopub-dotum', label: 'KoPub 돋움',  source: 'local', stack: '"KoPubWorldDotum", sans-serif',
    files: [['assets/fonts/KoPubWorldDotum-Medium', 400], ['assets/fonts/KoPubWorldDotum-Bold', 700]] },
  { id: 'kopub-batang', label: 'KoPub 바탕', source: 'local', stack: '"KoPubWorldBatang", serif',
    files: [['assets/fonts/KoPubWorldBatang-Medium', 400], ['assets/fonts/KoPubWorldBatang-Bold', 700]] },
  { id: 'chosun', label: '조선일보명조',      source: 'local', stack: '"ChosunilboNM", serif',
    files: [['assets/fonts/ChosunilboNM', 400]] },
];

export const fontById = (id) => FONTS.find(f => f.id === id) || FONTS[0];

/* 캔버스 비율 — 값은 높이÷너비. 자동이면 글 길이만큼 늘어난다. */
export const RATIOS = {
  auto: null,
  '9:16': 16 / 9,
  '4:5': 5 / 4,
  '1:1': 1,
  '5:4': 4 / 5,
  '16:9': 9 / 16,
};

export const RATIO_ORDER = ['auto', '9:16', '4:5', '1:1', '5:4', '16:9'];
export const RATIO_LABEL = { auto: '자동' };

/* ── 기본 스타일 (= 기본 템플릿) ────────────── */
export const DEFAULT_STYLE = {
  // 스킨 — 정해진 겉모습을 그릴 때만 덮어씌운다. 빈 값이면 내 색 그대로.
  skin: '',

  font: 'pretendard',
  fontSize: 15,
  lineHeight: 1.7,
  letterSpacing: 0,
  align: 'left',
  paraGap: 5,
  squeeze: 100,                 // 장평 % — 100 이면 글자를 그대로 둔다
  breakMode: 'word',            // word: 단어 단위 / char: 글자 단위

  width: 800,
  ratio: 'auto',
  autoSplit: false,             // 비율을 정했을 때 넘치는 만큼 다음 장으로 넘긴다
  columns: false,               // 책 내지처럼 두 단으로 나눠 흘린다 (비율이 자동일 때만)
  columnGap: 48,
  padTop: 84, padRight: 84, padBottom: 84, padLeft: 84,
  padLinked: false,

  bgMode: 'solid',              // solid 단색 / grad 두 색 / clear 투명
  bg: '#FFFFFF',
  bg2: '#E9EEF2',               // 두 색일 때 아래쪽 색
  bgImage: '',                  // data URL
  bgFit: 'cover',               // cover | contain | tile
  bgOpacity: 100,
  bgX: 50, bgY: 50,             // 꽉 채움일 때 보이는 자리 (%). 미리보기에서 끌어 옮긴다.
  bgBlur: 0,
  bgAsHeader: false,            // 배경 대신 본문 위 띠로 쓴다
  bgHeaderH: 220,

  fg: '#1A1A1A',
  actionColor: '#8A8F98',
  quoteColor: '#1F5D8C',
  parenColor: '#B0B4B8',
  dividerColor: '#D8D8D8',
  headingColor: '#111417',
  bqColor: '#14746F',
  hlColor: '#FFE9A3',
  codeBg: '#23282D',
  codeFg: '#E6E9EC',
  codeTitleColor: '#8FA0AE',

  // 「색」 버튼이 넣는 {c1 …} ~ {c5 …} 에 대응한다. 최대 5개.
  slots: [
    { name: '대사 A', color: '#1F5D8C' },
    { name: '대사 B', color: '#8B3A4A' },
  ],

  // 말풍선 공통 모양 (이름·사진 표시 여부는 프로필마다 따로)
  bubbleStyle: 'round',        // round 기본 / tail 꼬리 / corner 모서리만 뾰족
  avatarShape: 'square',       // square 라운드 사각 / circle 원형
  avatarSize: 100,             // 프로필 사진 크기 % — 100 이면 글자 크기의 2.5배
  bubbleRadius: 16,
  bubbleAlpha: 100,            // 말풍선 투명도 — 프로필 구분 없이 모두에 걸린다
  bubbleGap: 8,                // 말풍선 덩어리 사이의 간격
  nameGap: 3,                  // 이름과 말풍선 사이
  nameBold: false,
  bubbleMaxWidth: 76,        // %
  bubblePadV: 9,
  bubblePadH: 13,
  hideQuotesInBubble: false,   // 말풍선 안 따옴표 기호를 감출지
  parenBreakInBubble: false,   // 말풍선 안 괄호를 늘 새 줄에 둘지

  transparent: false,

  // 캔버스 아래에 남기는 한 줄 — 이름과 소속
  signOn: true,                // 꺼 두면 적어 두었어도 그리지 않는다
  signName: '',
  signOrg: '',
  signSep: 'dot',              // dot 가운데점 / bar 세로줄
  signAlign: 'right',
  signSize: 12,
  signGap: 32,
  signColor: '#9AA0A6',
};

export const MAX_SLOTS = 5;

/* 이름표 기본색. 예전에는 본문색을 62% 로 흐리게 깔았는데 그 결과와 비슷한 회색이다. */
export const NAME_COLOR = '#717171';

/* 말풍선 프로필. 이름은 본문에서 「이름 | 대사」로 쓰이므로 비워 두면 안 된다.
   오른쪽은 본인 자리라 이름과 사진을 기본으로 감춘다. */
export const DEFAULT_PROFILES = [
  {
    id: 'p1', name: '나', side: 'right',
    bubbleBg: '#2F6B6B',
    textColor: '#FFFFFF', quoteColor: '#FFFFFF', parenColor: '#BED8D6',
    nameColor: NAME_COLOR,
    avatar: '', avatarColor: '', showName: false, showAvatar: false,
  },
  {
    id: 'p2', name: '상대', side: 'left',
    bubbleBg: '#EFF1F1',
    textColor: '#1A1A1A', quoteColor: '#1F5D8C', parenColor: '#8C9594',
    nameColor: NAME_COLOR,
    avatar: '', avatarColor: '', showName: true, showAvatar: true,
  },
];

/* 새로 만드는 프로필. 개수에는 제한을 두지 않는다. */
export function newProfile(n = 1) {
  return {
    id: 'p' + Math.random().toString(36).slice(2, 7),
    name: `프로필${n}`, side: 'left',
    bubbleBg: '#EFF1F1', textColor: '#1A1A1A',
    quoteColor: '#1A1A1A', parenColor: '#8A8F98', nameColor: NAME_COLOR,
    avatar: '', avatarColor: '', showName: true, showAvatar: true,
  };
}

/* 자동 서식 — 항목별로 껐다 켠다. 템플릿에는 넣지 않는다. */
export const DEFAULT_FORMATS = {
  bold: true, action: true, italic: true, quote: true, paren: true,
  highlight: true, divider: true, heading: true, blockquote: true, code: true,
};

export const DEFAULT_OUTPUT = {
  scale: 2,
  format: 'png',
  quality: 0.92,
  filename: 'excerpt',
  embedSource: true,     // PNG 안에 원문을 같이 심어 나중에 다시 불러올 수 있게
};

export const DEFAULT_HTML = {
  widthMode: 'auto',      // auto | manual
  width: 800,
  padOn: false,
  padTop: 24, padRight: 24, padBottom: 24, padLeft: 24, padLinked: true,
  padBg: '#FFFFFF',
  transparent: true,            // 코드가 정한 배경을 그대로 살리는 쪽이 기본
  trim: true,                   // 결과 이미지 가장자리의 빈 테두리를 잘라낸다
};

/* ── 상태 ───────────────────────────────────── */
const LS_DOC = 'textshot:doc:v1';
const LS_TPL = 'textshot:templates:v1';
const LS_PIC = 'textshot:photos:v1';

/* ── 사진 곳간 ──────────────────────────────────
   본문과 템플릿이 같은 사진을 따로따로 담으면 한 장이 두 벌, 세 벌이 된다.
   프로필 일곱에 템플릿 하나만 있어도 사진이 열네 장 분량이 되어 브라우저
   저장 한도(사이트당 5MB 남짓)를 금세 넘긴다.

   그래서 사진은 이 곳간에 딱 한 벌만 두고, 프로필과 본문에는 「ph:열쇠」라는
   쪽지만 남긴다. 같은 사진을 몇 군데서 쓰든 자리는 한 장 몫이다.

   메모리에서는 예전처럼 그냥 data URL 이다. 담고 꺼낼 때만 바꿔치기하므로
   그리는 쪽 코드는 이 일을 몰라도 된다. */
let photos = {};

/* data URL 로 열쇠를 만든다. 길이를 붙여 다른 사진이 같은 열쇠를 갖는 일을 막는다. */
function photoKey(url) {
  let h = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) {
    h ^= url.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36) + '-' + url.length.toString(36);
}

const packPic = (url) => {
  if (typeof url !== 'string' || !url.startsWith('data:')) return url || '';
  const k = photoKey(url);
  photos[k] = url;
  return 'ph:' + k;
};

const unpackPic = (v) => (
  typeof v === 'string' && v.startsWith('ph:') ? (photos[v.slice(3)] || '') : (v || '')
);

const packProfiles = (list) => (list || []).map(p => ({ ...p, avatar: packPic(p.avatar) }));
const packImages = (list) => (list || []).map(im => ({ ...im, data: packPic(im.data) }));

/* 아무도 안 쓰는 사진은 버린다. 본문과 템플릿을 모두 훑고 남은 것만 남긴다. */
function sweepPhotos() {
  const used = new Set();
  // 메모리에서는 data URL, 담긴 뒤에는 「ph:열쇠」다. 둘 다 알아본다.
  const note = (v) => {
    if (typeof v !== 'string' || !v) return;
    if (v.startsWith('ph:')) used.add(v.slice(3));
    else if (v.startsWith('data:')) used.add(photoKey(v));
  };
  for (const p of state.text.profiles) note(p.avatar);
  for (const im of state.text.images) note(im.data);
  for (const t of Object.values(templates)) {
    for (const p of (t?.profiles || [])) note(p.avatar);
  }
  for (const k of Object.keys(photos)) if (!used.has(k)) delete photos[k];
}

/* 여러 칸을 한꺼번에 담는다.

   반드시 옛 것을 먼저 비우고 새 것을 쓴다. 저장 공간이 거의 찬 상태에서
   새 것부터 쓰려 하면 자리가 모자라 실패하는데, 그러면 자리를 차지하고 있던
   옛 것이 그대로 남아 영영 줄어들지 않는다. (사진을 본문 안에 통째로 담던
   시절의 저장물이 딱 이 꼴이었다 — 6MB 를 물고 있어 1.9MB 짜리 새 저장물이
   들어갈 자리가 없었다.)

   글로 다 만들어 두고 지우기 시작하므로, 만들다 잘못돼도 지워지지 않는다. */
function writeAll(pairs) {
  const built = pairs.map(([k, make]) => [k, make()]);
  for (const [k] of built) localStorage.removeItem(k);
  for (const [k, v] of built) localStorage.setItem(k, v);
}

function clone(o) { return JSON.parse(JSON.stringify(o)); }

/* 예전 버전은 색 슬롯이 색상 문자열 배열이었다. 이름을 가진 객체로 옮긴다. */
export function normalizeSlots(raw) {
  if (!Array.isArray(raw) || !raw.length) return clone(DEFAULT_STYLE.slots);
  return raw.slice(0, MAX_SLOTS).map((s, i) => (
    typeof s === 'string'
      ? { name: `색${i + 1}`, color: s }
      : { name: s?.name || `색${i + 1}`, color: s?.color || '#1F5D8C' }
  ));
}

export const state = {
  tab: 'text',
  collapsed: false,
  zoom: 'fit',
  splitView: 'before',
  checker: false,

  text: {
    source: '',
    formats: clone(DEFAULT_FORMATS),
    style: clone(DEFAULT_STYLE),
    images: [],          // { id, data, width }  본문에 [[img:id]] 로 자리를 잡는다
    profiles: clone(DEFAULT_PROFILES),
  },
  html: {
    source: '',
    opts: clone(DEFAULT_HTML),
  },
  output: clone(DEFAULT_OUTPUT),
  activeTemplate: null,
};

export let templates = {};

/* ── 저장/복원 ──────────────────────────────── */
export function loadAll() {
  // 사진 곳간을 먼저 연다. 본문과 템플릿의 쪽지를 풀려면 이게 있어야 한다.
  try {
    photos = JSON.parse(localStorage.getItem(LS_PIC) || '{}') || {};
  } catch (e) { console.warn('사진 복원 실패', e); photos = {}; }

  try {
    const raw = localStorage.getItem(LS_DOC);
    if (raw) {
      const d = JSON.parse(raw);
      if (d.text) {
        state.text.source = d.text.source ?? '';
        // 예전 버전은 autoFormat 이 참/거짓 하나였다. 항목별 설정으로 옮긴다.
        if (typeof d.text.autoFormat === 'boolean') {
          for (const k of Object.keys(state.text.formats)) state.text.formats[k] = d.text.autoFormat;
        }
        Object.assign(state.text.formats, d.text.formats || {});
        Object.assign(state.text.style, d.text.style || {});
        state.text.style.slots = normalizeSlots(state.text.style.slots ?? d.text.style?.colorSlots);
        delete state.text.style.colorSlots;
        // A4·A5·B5 를 쓰던 설정은 자동으로 되돌린다
        if (!(state.text.style.ratio in RATIOS)) state.text.style.ratio = 'auto';
        state.text.images = (Array.isArray(d.text.images) ? d.text.images : [])
          .map(im => ({ ...im, data: unpackPic(im.data) }))
          .filter(im => im.data);
        // 투명도를 프로필마다 두던 시절의 값을 전체 설정 하나로 모은다
        if (d.text.style && d.text.style.bubbleAlpha === undefined) {
          const olds = (d.text.profiles || [])
            .map(p => (p?.bubbleBg === 'transparent' ? 0 : p?.bubbleAlpha))
            .filter(v => typeof v === 'number');
          if (olds.length) state.text.style.bubbleAlpha = Math.min(...olds);
        }
        state.text.profiles = Array.isArray(d.text.profiles) && d.text.profiles.length
          ? d.text.profiles.map(p => {
            const q = {
              showName: p.side !== 'right', showAvatar: p.side !== 'right',
              quoteColor: p.textColor, parenColor: p.textColor,
              nameColor: NAME_COLOR, avatarColor: '', ...p,
            };
            // 투명 여부만 있던 시절의 값
            if (q.bubbleBg === 'transparent') { q.bubbleBg = '#EFF1F1'; q.bubbleAlpha = 0; }
            q.avatar = unpackPic(q.avatar);
            return q;
          })
          : clone(DEFAULT_PROFILES);
      }
      if (d.html) {
        state.html.source = d.html.source ?? '';
        Object.assign(state.html.opts, d.html.opts || {});
      }
      Object.assign(state.output, d.output || {});
      state.activeTemplate = d.activeTemplate ?? null;
    }
  } catch (e) { console.warn('문서 복원 실패', e); }

  try {
    const raw = localStorage.getItem(LS_TPL);
    const saved = raw ? (JSON.parse(raw) || {}) : {};
    templates = {};
    for (const [name, t] of Object.entries(saved)) {
      templates[name] = t && t.style
        ? { ...t, profiles: (t.profiles || []).map(p => ({ ...p, avatar: unpackPic(p.avatar) })) }
        : t;
    }
  } catch (e) { console.warn('템플릿 복원 실패', e); }
}

let saveTimer = null;
export function saveSoon(onDone) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const text = {
        ...state.text,
        profiles: packProfiles(state.text.profiles),
        images: packImages(state.text.images),
      };
      sweepPhotos();
      writeAll([
        [LS_PIC, () => JSON.stringify(photos)],
        [LS_DOC, () => JSON.stringify({
          text, html: state.html,
          output: state.output, activeTemplate: state.activeTemplate,
        })],
      ]);
      onDone?.(null);
    } catch (e) {
      // 사진이 아주 많으면 그래도 한도를 넘길 수 있다
      console.warn('자동 저장 실패', e);
      onDone?.(e);
    }
  }, 400);
}

/* 템플릿의 프로필 사진도 곳간을 함께 쓴다. 본문과 같은 사진이면 자리를
   더 먹지 않는다. 던지고 끝내면 누른 단추가 먹통이 되므로 참·거짓으로 알린다. */
export function persistTemplates() {
  try {
    const out = {};
    for (const [name, t] of Object.entries(templates)) {
      out[name] = t && t.style
        ? { ...t, profiles: packProfiles(t.profiles) }
        : t;
    }
    sweepPhotos();
    writeAll([
      [LS_PIC, () => JSON.stringify(photos)],
      [LS_TPL, () => JSON.stringify(out)],
    ]);
    return true;
  } catch (e) {
    console.warn('템플릿 저장 실패', e);
    return false;
  }
}

/* 지금 담아 둔 양 — 글자 하나에 2바이트를 쓴다 */
export function storedBytes() {
  let n = 0;
  for (const k of [LS_DOC, LS_TPL, LS_PIC]) n += (localStorage.getItem(k) || '').length * 2;
  return n;
}

/* 곳간에 든 사진 수와 그 양 */
export function photoStats() {
  const keys = Object.keys(photos);
  let bytes = 0;
  for (const k of keys) bytes += photos[k].length * 2;
  return { count: keys.length, bytes };
}

const keyOfPic = (v) => {
  if (typeof v !== 'string' || !v) return null;
  if (v.startsWith('ph:')) return v.slice(3);
  if (v.startsWith('data:')) return photoKey(v);
  return null;
};

/* 사진이 어디에 매여 있는지.

   템플릿에도 프로필 사진이 담기므로, 본문에서 프로필을 지워도 템플릿이
   아직 그 사진을 쓰고 있으면 자리는 그대로다. 그걸 눈에 보이게 한다. */
export function photoUsage() {
  const inDoc = new Set();
  const inTpl = new Set();
  for (const p of state.text.profiles) { const k = keyOfPic(p.avatar); if (k) inDoc.add(k); }
  for (const im of state.text.images) { const k = keyOfPic(im.data); if (k) inDoc.add(k); }
  for (const t of Object.values(templates)) {
    for (const p of (t?.profiles || [])) { const k = keyOfPic(p.avatar); if (k) inTpl.add(k); }
  }
  let tplOnly = 0;
  let tplOnlyBytes = 0;
  for (const k of inTpl) {
    if (inDoc.has(k)) continue;
    tplOnly++;
    tplOnlyBytes += (photos[k] || '').length * 2;
  }
  return { ...photoStats(), tplOnly, tplOnlyBytes };
}

/* 템플릿 하나가 붙들고 있는 사진 수 */
export function templatePhotoCount(t) {
  return (t?.profiles || []).filter(p => keyOfPic(p.avatar)).length;
}

/* 템플릿이 붙들고 있는 사진을 놓아 준다. 이름·위치·색은 그대로 남는다.
   그 템플릿을 적용하면 사진만 지금 프로필의 것을 쓴다. */
export function dropTemplatePhotos() {
  for (const t of Object.values(templates)) {
    for (const p of (t?.profiles || [])) p.avatar = '';
  }
  return persistTemplates();
}

/* 담아 둔 것을 전부 비운다 */
export function clearStored() {
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith('textshot:')) localStorage.removeItem(k);
  }
  photos = {};
}

export function setTemplates(next) {
  templates = next;
  persistTemplates();
}
