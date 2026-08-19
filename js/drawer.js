/* 모바일 서랍 — 편집기를 아래에서 끌어 올린다.

   아이폰에서는 키보드가 뜰 때 position:fixed 가 제대로 붙어 있지 않고,
   window.innerHeight 도 줄어들지 않는다. 그래서 bottom:0 으로 두지 않고
   visualViewport 를 읽어 top 을 직접 계산해 넣는다. */

const MOBILE = '(max-width: 768px)';
const PEEK = 96;
const MIN_H = 56;

let drawer = null;
let grip = null;
let snap = 'peek';        // peek | half | full
let dragging = false;
let onChange = () => {};

export const isMobile = () => window.matchMedia(MOBILE).matches;

function viewport() {
  const v = window.visualViewport;
  return { h: v ? v.height : window.innerHeight, top: v ? v.offsetTop : 0 };
}

function snapHeights() {
  const { h } = viewport();
  return { peek: PEEK, half: Math.round(h * 0.45), full: Math.round(h * 0.88) };
}

function place(height) {
  if (!drawer) return;
  const { h, top } = viewport();
  const clamped = Math.max(MIN_H, Math.min(height, h - 8));
  drawer.style.height = clamped + 'px';
  drawer.style.top = Math.round(top + h - clamped) + 'px';
  document.documentElement.style.setProperty('--drawer-h', clamped + 'px');
}

export function setSnap(next, animate = true) {
  snap = next;
  drawer.classList.toggle('is-animating', animate);
  place(snapHeights()[next]);
  drawer.classList.toggle('is-peek', next === 'peek');
  if (animate) setTimeout(() => drawer.classList.remove('is-animating'), 260);
  onChange(next);
}

function nearestSnap(height) {
  const hs = snapHeights();
  return Object.entries(hs)
    .sort((a, b) => Math.abs(a[1] - height) - Math.abs(b[1] - height))[0][0];
}

/* 키보드가 올라오면 시각적 뷰포트가 줄어든다. 입력 중이면 그 공간을 꽉 채운다. */
function relayout() {
  if (!isMobile()) { reset(); return; }
  const { h } = viewport();
  const typing = document.activeElement
    && ['TEXTAREA', 'INPUT'].includes(document.activeElement.tagName);
  place(typing ? h - 8 : snapHeights()[snap]);
}

function reset() {
  if (!drawer) return;
  drawer.style.height = '';
  drawer.style.top = '';
  drawer.classList.remove('is-peek', 'is-animating');
  document.documentElement.style.removeProperty('--drawer-h');
}

function onPointerDown(e) {
  if (!isMobile()) return;
  dragging = true;
  const startY = e.clientY;
  const startH = drawer.getBoundingClientRect().height;
  grip.setPointerCapture(e.pointerId);
  drawer.classList.remove('is-animating');

  const move = (ev) => { if (dragging) place(startH - (ev.clientY - startY)); };
  const up = () => {
    dragging = false;
    grip.removeEventListener('pointermove', move);
    grip.removeEventListener('pointerup', up);
    grip.removeEventListener('pointercancel', up);
    setSnap(nearestSnap(drawer.getBoundingClientRect().height));
  };
  grip.addEventListener('pointermove', move);
  grip.addEventListener('pointerup', up);
  grip.addEventListener('pointercancel', up);
  e.preventDefault();
}

export function initDrawer(opts = {}) {
  drawer = document.getElementById('editorPane');
  grip = document.getElementById('drawerGrip');
  onChange = opts.onChange || (() => {});
  if (!drawer || !grip) return;

  grip.addEventListener('pointerdown', onPointerDown);
  grip.addEventListener('click', () => {
    // 탭하면 다음 단으로
    setSnap(snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'peek');
  });

  const vv = window.visualViewport;
  vv?.addEventListener('resize', relayout);
  vv?.addEventListener('scroll', relayout);
  window.addEventListener('orientationchange', () => setTimeout(relayout, 250));
  window.matchMedia(MOBILE).addEventListener('change', () => {
    if (isMobile()) setSnap('peek', false); else reset();
  });

  // 글을 쓰기 시작하면 서랍을 키운다
  document.getElementById('src')?.addEventListener('focus', () => { if (isMobile()) relayout(); });
  document.getElementById('htmlSrc')?.addEventListener('focus', () => { if (isMobile()) relayout(); });
  document.addEventListener('focusout', () => { if (isMobile()) setTimeout(relayout, 100); });

  if (isMobile()) setSnap('peek', false);
}

/* 서랍 안 [편집] / [설정] 전환 */
export function initDrawerModes() {
  const pane = document.getElementById('editorPane');
  document.querySelectorAll('.dm-btn').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.dm-btn').forEach(x => x.classList.remove('is-active'));
      b.classList.add('is-active');
      pane.classList.toggle('mode-settings', b.dataset.dmode === 'settings');
      if (isMobile() && snap === 'peek') setSnap('half');
    });
  });
}
