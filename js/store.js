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

/* ── 기본 스타일 (= 기본 템플릿) ────────────── */
export const DEFAULT_STYLE = {
  font: 'pretendard',
  fontSize: 17,
  lineHeight: 1.9,
  letterSpacing: 0,
  align: 'left',
  paraGap: 10,

  width: 800,
  padTop: 56, padRight: 48, padBottom: 56, padLeft: 48,
  padLinked: false,

  bg: '#FFFFFF',
  fg: '#1A1A1A',
  actionColor: '#8A8F98',
  quoteColor: '#1F5D8C',
  parenColor: '#B0B4B8',
  dividerColor: '#D8D8D8',
  headingColor: '#111417',
  bqColor: '#14746F',
  codeBg: '#23282D',
  codeFg: '#E6E9EC',
  codeTitleColor: '#8FA0AE',
  // 「색1~색5」 버튼이 넣는 {c1 …} ~ {c5 …} 에 대응한다
  colorSlots: ['#1F5D8C', '#8B3A4A', '#2F6B4F', '#8A5A2B', '#5B4B8A'],
  transparent: false,
};

/* 자동 서식 — 항목별로 껐다 켠다. 템플릿에는 넣지 않는다. */
export const DEFAULT_FORMATS = {
  bold: true, action: true, italic: true, quote: true, paren: true,
  divider: true, heading: true, blockquote: true, code: true,
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
  transparent: false,
};

/* ── 상태 ───────────────────────────────────── */
const LS_DOC = 'textshot:doc:v1';
const LS_TPL = 'textshot:templates:v1';

function clone(o) { return JSON.parse(JSON.stringify(o)); }

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
        if (!Array.isArray(state.text.style.colorSlots)) {
          state.text.style.colorSlots = clone(DEFAULT_STYLE.colorSlots);
        }
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
export function saveSoon(onSaved) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(LS_DOC, JSON.stringify({
        text: state.text, html: state.html,
        output: state.output, activeTemplate: state.activeTemplate,
      }));
      onSaved?.();
    } catch (e) { console.warn('자동 저장 실패', e); }
  }, 400);
}

export function persistTemplates() {
  localStorage.setItem(LS_TPL, JSON.stringify(templates));
}

export function setTemplates(next) {
  templates = next;
  persistTemplates();
}
