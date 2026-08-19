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
  font: 'pretendard',
  fontSize: 17,
  lineHeight: 1.9,
  letterSpacing: 0,
  align: 'left',
  paraGap: 10,
  breakMode: 'word',            // word: 단어 단위 / char: 글자 단위

  width: 800,
  ratio: 'auto',
  padTop: 56, padRight: 48, padBottom: 56, padLeft: 48,
  padLinked: false,

  bg: '#FFFFFF',
  bgImage: '',                  // data URL
  bgFit: 'cover',               // cover | contain | tile
  bgOpacity: 100,

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
  bubbleRadius: 16,
  bubbleGap: 8,
  bubbleMaxWidth: 76,        // %
  bubblePadV: 9,
  bubblePadH: 13,
  hideQuotesInBubble: false,   // 말풍선 안 따옴표 기호를 감출지

  transparent: false,
};

export const MAX_SLOTS = 5;
export const MAX_PROFILES = 6;

/* 말풍선 프로필. 이름은 본문에서 「이름 | 대사」로 쓰이므로 비워 두면 안 된다.
   오른쪽은 본인 자리라 이름과 사진을 기본으로 감춘다. */
export const DEFAULT_PROFILES = [
  {
    id: 'p1', name: '나', side: 'right',
    bubbleBg: '#2F6B6B', textColor: '#FFFFFF', quoteColor: '#FFFFFF', parenColor: '#BED8D6',
    avatar: '', showName: false, showAvatar: false,
  },
  {
    id: 'p2', name: '상대', side: 'left',
    bubbleBg: '#EFF1F1', textColor: '#1A1A1A', quoteColor: '#1F5D8C', parenColor: '#8C9594',
    avatar: '', showName: true, showAvatar: true,
  },
];

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
        state.text.images = Array.isArray(d.text.images) ? d.text.images : [];
        state.text.profiles = Array.isArray(d.text.profiles) && d.text.profiles.length
          ? d.text.profiles.map(p => ({
            showName: p.side !== 'right', showAvatar: p.side !== 'right',
            quoteColor: p.textColor, parenColor: p.textColor, ...p,
          }))
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
    if (raw) templates = JSON.parse(raw) || {};
  } catch (e) { console.warn('템플릿 복원 실패', e); }
}

let saveTimer = null;
export function saveSoon(onDone) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(LS_DOC, JSON.stringify({
        text: state.text, html: state.html,
        output: state.output, activeTemplate: state.activeTemplate,
      }));
      onDone?.(null);
    } catch (e) {
      // 사진을 넣으면 브라우저 저장 한도(대개 5MB)를 넘기기 쉽다
      console.warn('자동 저장 실패', e);
      onDone?.(e);
    }
  }, 400);
}

export function persistTemplates() {
  localStorage.setItem(LS_TPL, JSON.stringify(templates));
}

export function setTemplates(next) {
  templates = next;
  persistTemplates();
}
