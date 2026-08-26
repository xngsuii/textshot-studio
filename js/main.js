/* 부팅 · 탭 전환 · 미리보기 갱신 · 저장 */

import { state, loadAll, saveSoon, fontById } from './store.js';
import * as TextTab from './text-tab.js';
import * as HtmlTab from './html-tab.js';
import * as Capture from './capture.js';
import { nodeToBlob, downloadMany, copyToClipboard, shareBlobs } from './capture.js';
import { ensureFont } from './fonts.js';
import { initDrawer, initDrawerModes, isMobile } from './drawer.js';
import { toast } from './ui.js';

/* index.html 의 app-version 과 짝을 이룬다. 브라우저가 둘 중 하나만 새로
   받으면 화면은 새것인데 동작은 옛것인 상태가 되어 원인 찾기가 어렵다.
   어긋나면 하단에 알려 준다. 고칠 때 두 값을 같이 올릴 것. */
const APP_VERSION = '18';

const $ = (id) => document.getElementById(id);

const host = () => $('stageHost');
const sizer = () => $('stageSizer');
const scroller = () => $('previewScroll');

/* 지금 배율. transform 으로 줄이므로 DOM 에서 읽지 않고 여기에 들고 있는다. */
let zoomLevel = 1;

/* 화면에 보이는 것을 그대로 줄인다.
   zoom 을 쓰면 레이아웃을 다시 계산해 글줄이 다시 접히지만,
   transform 은 이미 그려진 것을 그대로 줄이므로 줄바꿈이 바뀌지 않는다. */
function applyScale(z) {
  const h = host();
  zoomLevel = z;
  h.style.transform = z === 1 ? '' : `scale(${z})`;
  // transform 은 자리를 원래 크기대로 차지하므로 스크롤 범위를 따로 맞춰 준다
  const s = sizer();
  s.style.width = Math.ceil(h.offsetWidth * z) + 'px';
  s.style.height = Math.ceil(h.offsetHeight * z) + 'px';
}

let renderTimer = null;

/* ── 미리보기 ───────────────────────────────── */
function setDims(w, h, count = 1) {
  const s = state.output.scale;
  const label = `${Math.round(w * s)} × ${Math.round(h * s)} px`;
  $('dims').textContent = count > 1 ? `${label} · ${count}장` : label;
}

function applyZoom() {
  const h = host();
  if (state.zoom !== 'fit') { applyScale(state.zoom); showZoom(state.zoom); return; }

  // 「맞춤」은 가로세로 모두 들어와야 한다. 너비만 맞추면 세로로 긴 글에서
  // 100% 와 다를 바가 없어진다. 모바일에서는 아래를 서랍이 덮으므로
  // 안쪽 여백을 빼고 재야 실제로 보이는 만큼에 맞는다.
  applyScale(1);                        // 원래 크기를 재기 위해 잠시 되돌린다
  const box = scroller();
  const cs = getComputedStyle(box);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  const availW = (box.clientWidth - padX) * 0.96;
  const availH = (box.clientHeight - padY) * 0.98;
  const natW = h.offsetWidth || 1;
  const natH = h.offsetHeight || 1;
  const z = Math.min(1, availW / natW, availH / natH);
  applyScale(z);
  showZoom(z);
}

/* ── 배율 ────────────────────────────────────
   100% 나 50% 로 보면 화면 밖으로 넘쳐 스크롤로만 훑어야 한다.
   − 를 눌러 지금 보이는 그대로 한 단계씩 줄인다.
   100% 위로는 올리지 않는다. 그 이상은 또렷해지지 않고 뿌옇게 커지기만 한다. */
const ZOOM_STEPS = [0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.65, 0.8, 1];
const ZOOM_MIN = ZOOM_STEPS[0];
const ZOOM_MAX = 1;

function stepZoom(dir) {
  const cur = currentZoom();
  const next = dir < 0
    ? [...ZOOM_STEPS].reverse().find(z => z < cur - 0.001)
    : ZOOM_STEPS.find(z => z > cur + 0.001);
  if (next === undefined) return;
  setZoom(next);
}

function currentZoom() {
  return zoomLevel;
}

function showZoom(z) {
  const el = $('zoomLabel');
  el.textContent = state.zoom === 'fit' ? '' : `${Math.round(z * 100)}%`;
}

function setZoom(z) {
  const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
  state.zoom = clamped;
  applyScale(clamped);
  document.querySelectorAll('#zoomSeg .seg-btn').forEach((b) => {
    b.classList.toggle('is-active', parseFloat(b.dataset.zoom) === clamped);
  });
  showZoom(clamped);
}

async function renderNow() {
  host().classList.toggle('is-checker', state.checker);
  applyScale(1);

  if (state.tab === 'text') {
    const stages = TextTab.renderPreview(host());
    const first = stages[0];
    setDims(first.offsetWidth, first.offsetHeight, stages.length);
    $('statusMsg').textContent = '';
    $('statusMsg').className = 'status-msg';
  } else {
    const shot = await HtmlTab.renderPreview(host());
    if (shot) {
      const r = shot.getBoundingClientRect();
      setDims(Math.ceil(r.width), Math.ceil(r.height), 1);
    } else {
      $('dims').textContent = '—';
    }
  }
  applyZoom();
}

function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(renderNow, 220);
  saveSoon((err) => {
    const hint = $('saveHint');
    if (err) {
      // 사진을 여러 장 넣으면 브라우저 저장 한도를 넘긴다
      hint.textContent = '자동 저장 안 됨 — 사진 용량 초과';
      hint.classList.add('is-warn');
      return;
    }
    hint.classList.remove('is-warn');
    hint.textContent = '저장됨';
    setTimeout(() => { hint.textContent = ''; }, 1200);
  });
}

/* ── 내보내기 ───────────────────────────────── */
function offscreen() {
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:-100000px;top:0;z-index:-1;';
  document.body.appendChild(box);
  return box;
}

/* 배율이 캔버스 한계를 넘으면 조용히 빈 이미지가 나온다. 미리 낮추고 알린다. */
function safeScale(node, wanted) {
  const s = Capture.fitScale(node, wanted);
  if (s !== wanted) toast(`이미지가 너무 커서 배율을 ${s}x 로 낮춰 저장합니다`);
  return s;
}

async function collectBlobs() {
  const { scale, format, quality } = state.output;

  if (state.tab === 'text') {
    const st = state.text.style;
    const background = (format !== 'png' && st.transparent) ? '#FFFFFF' : null;
    const box = offscreen();
    try {
      const stages = TextTab.buildExportStages();
      stages.forEach(s => box.appendChild(s));
      const blobs = [];
      let s = scale;
      for (const stage of stages) s = Math.min(s, Capture.fitScale(stage, scale));
      if (s !== scale) toast(`이미지가 너무 커서 배율을 ${s}x 로 낮춰 저장합니다`);
      for (const stage of stages) blobs.push(await nodeToBlob(stage, { scale: s, format, quality, background }));
      return blobs;
    } finally { box.remove(); }
  }

  const shot = HtmlTab.getShotNode();
  if (!shot) throw new Error('미리보기가 아직 준비되지 않았습니다');
  const o = state.html.opts;
  const background = (format !== 'png' && o.transparent) ? '#FFFFFF' : null;
  // 축소된 상태 그대로 찍으면 크기가 어긋나므로 잠시 원래대로 돌린다
  const prev = zoomLevel;
  applyScale(1);
  try {
    const s = safeScale(shot, scale);
    return [await nodeToBlob(shot, { scale: s, format, quality, background, trim: o.trim })];
  } finally { applyScale(prev); }
}

function busy(on, msg = '') {
  $('saveBtn').disabled = on;
  $('copyBtn').disabled = on;
  $('statusMsg').textContent = msg;
  $('statusMsg').className = 'status-msg';
}

/* 직접 넣은 폰트는 파일 전체를 이미지에 심어야 해서 처음 한 번이 오래 걸린다.
   그 뒤로는 캐시가 돌아 곧바로 끝난다. */
function workingMessage() {
  if (state.tab !== 'text') return '이미지를 만드는 중…';
  const f = fontById(state.text.style.font);
  return f.source === 'local'
    ? `${f.label} 폰트를 이미지에 심는 중… 처음 한 번만 오래 걸립니다`
    : '이미지를 만드는 중…';
}

async function doSave() {
  busy(true, workingMessage());
  try {
    const blobs = await collectBlobs();
    const ext = state.output.format === 'jpg' ? 'jpg' : state.output.format;

    // 폰에서는 공유 시트가 먼저다. 사진첩 저장도 거기서 고른다.
    let msg;
    if (isMobile() && await shareBlobs(blobs, state.output.filename, ext)) {
      msg = blobs.length > 1 ? `${blobs.length}장 공유` : '공유 시트를 열었습니다';
    } else {
      msg = await downloadMany(blobs, state.output.filename, ext);
    }
    toast(msg);
    busy(false, '');
    // 잘라내기가 걸리면 저장된 크기가 미리보기와 다를 수 있어 실제 값을 보여 준다
    const sz = Capture.lastSize;
    if (sz) $('dims').textContent = `${sz.w} × ${sz.h} px`
      + (blobs.length > 1 ? ` · ${blobs.length}장` : '');
  } catch (e) {
    console.error(e);
    busy(false, '');
    $('statusMsg').textContent = `저장 실패: ${e.message}`;
    $('statusMsg').className = 'status-msg is-warn';
  }
}

async function doCopy() {
  busy(true, workingMessage());
  try {
    const saved = state.output.format;
    state.output.format = 'png';           // 클립보드는 PNG 만 안정적
    const blobs = await collectBlobs();
    state.output.format = saved;
    await copyToClipboard(blobs[0]);
    toast(blobs.length > 1 ? '첫 장을 클립보드에 복사했습니다' : '클립보드에 복사했습니다');
    busy(false, '');
  } catch (e) {
    console.error(e);
    busy(false, '');
    $('statusMsg').textContent = `복사 실패: ${e.message}`;
    $('statusMsg').className = 'status-msg is-warn';
  }
}

/* ── 탭 ─────────────────────────────────────── */
function moveThumb() {
  const active = document.querySelector('.toggle-opt.is-active');
  if (!active) return;
  const thumb = $('toggleThumb');
  thumb.style.width = active.offsetWidth + 'px';
  thumb.style.transform = `translateX(${active.offsetLeft}px)`;
}

function setTab(name) {
  state.tab = name;
  document.querySelectorAll('.toggle-opt').forEach(t => {
    const on = t.dataset.tab === name;
    t.classList.toggle('is-active', on);
    t.setAttribute('aria-selected', String(on));
  });
  moveThumb();
  document.querySelectorAll('.tabpane').forEach(p => p.classList.toggle('is-active', p.dataset.pane === name));
  $('splitSeg').hidden = name !== 'text';
  scheduleRender();
}

/* ── 시작 ───────────────────────────────────── */
function boot() {
  loadAll();
  ensureFont('pretendard');            // 화면 UI 용. 스테이지 폰트와 같은 파일을 쓴다.

  TextTab.bindEditor(scheduleRender);
  TextTab.buildSlotBar(scheduleRender);
  TextTab.buildProfileBar(scheduleRender);
  TextTab.buildSettings($('textSettings'), scheduleRender);
  TextTab.bindPreviewClicks(host(), scheduleRender);
  TextTab.bindBgDrag(host(), scheduleRender);
  HtmlTab.bindEditor(scheduleRender);
  HtmlTab.buildSettings($('htmlSettings'), scheduleRender);

  document.querySelectorAll('.toggle-opt').forEach(t => t.addEventListener('click', () => setTab(t.dataset.tab)));
  // UI 폰트가 들어오면 글자 폭이 달라지므로 손잡이를 다시 맞춘다
  document.fonts?.ready.then(moveThumb).catch(() => {});
  window.addEventListener('resize', moveThumb);

  $('resetBtn').addEventListener('click', () => {
    const where = state.tab === 'text' ? '텍스트 발췌' : 'HTML';
    if (!confirm(`${where} 설정을 전부 기본값으로 되돌릴까요? 써 둔 글은 그대로 남습니다.`)) return;
    if (state.tab === 'text') {
      TextTab.resetSettings();
      TextTab.buildSlotBar(scheduleRender);
      TextTab.buildProfileBar(scheduleRender);
      TextTab.buildSettings($('textSettings'), scheduleRender);
    } else {
      HtmlTab.resetSettings();
      HtmlTab.buildSettings($('htmlSettings'), scheduleRender);
    }
    toast('설정을 기본값으로 되돌렸습니다');
    scheduleRender();
  });

  $('collapseBtn').addEventListener('click', () => {
    state.collapsed = !state.collapsed;
    $('workspace').classList.toggle('is-collapsed', state.collapsed);
    $('collapseBtn').textContent = state.collapsed ? '편집기 열기' : '편집기 닫기';
    setTimeout(applyZoom, 0);
  });

  $('zoomSeg').addEventListener('click', (e) => {
    const b = e.target.closest('.seg-btn');
    if (!b) return;
    [...$('zoomSeg').children].forEach(c => c.classList.remove('is-active'));
    b.classList.add('is-active');
    state.zoom = b.dataset.zoom === 'fit' ? 'fit' : parseFloat(b.dataset.zoom);
    applyZoom();
    if (state.zoom !== 'fit') showZoom(state.zoom);
  });

  $('zoomOut').addEventListener('click', () => stepZoom(-1));
  $('zoomIn').addEventListener('click', () => stepZoom(1));

  $('splitSeg').addEventListener('click', (e) => {
    const b = e.target.closest('.seg-btn');
    if (!b) return;
    [...$('splitSeg').children].forEach(c => c.classList.remove('is-active'));
    b.classList.add('is-active');
    state.splitView = b.dataset.split;
    renderNow();
  });

  $('checkerBg').addEventListener('change', (e) => {
    state.checker = e.target.checked;
    host().classList.toggle('is-checker', state.checker);
  });

  $('saveBtn').addEventListener('click', doSave);
  $('copyBtn').addEventListener('click', doCopy);

  window.addEventListener('resize', () => { if (state.zoom === 'fit') applyZoom(); });

  window.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.key === 's') { e.preventDefault(); doSave(); }
    else if (e.key.toLowerCase() === 'c' && e.shiftKey) { e.preventDefault(); doCopy(); }
    else if (e.key === 'Enter') { e.preventDefault(); renderNow(); }
  });

  // 화면과 코드가 서로 다른 판인지 확인해 둔다
  const pageVer = document.querySelector('meta[name="app-version"]')?.content;
  const verEl = $('appVersion');
  if (pageVer && pageVer !== APP_VERSION) {
    verEl.textContent = `옛 버전이 남아 있습니다 (화면 ${pageVer} · 코드 ${APP_VERSION}) — 새로고침하세요`;
    verEl.classList.add('is-warn');
  } else {
    verEl.textContent = `v${APP_VERSION}`;
  }

  initDrawer({ onChange: () => { if (state.zoom === 'fit') applyZoom(); } });
  initDrawerModes();

  // 폰에서는 다운로드보다 공유 시트가 자연스럽다
  const labelSave = () => { $('saveBtn').textContent = isMobile() ? '공유' : '이미지 저장'; };
  labelSave();
  window.matchMedia('(max-width: 768px)').addEventListener('change', labelSave);

  // 탭 표시·손잡이 위치·첫 렌더를 한 경로로 처리한다
  setTab(state.tab);
}

boot();
