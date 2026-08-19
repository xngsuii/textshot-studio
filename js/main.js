/* 부팅 · 탭 전환 · 미리보기 갱신 · 저장 */

import { state, loadAll, saveSoon, fontById } from './store.js';
import * as TextTab from './text-tab.js';
import * as HtmlTab from './html-tab.js';
import { nodeToBlob, downloadMany, copyToClipboard } from './capture.js';
import { toast } from './ui.js';

const $ = (id) => document.getElementById(id);

const host = () => $('stageHost');
const scroller = () => $('previewScroll');

let renderTimer = null;

/* ── 미리보기 ───────────────────────────────── */
function setDims(w, h, count = 1) {
  const s = state.output.scale;
  const label = `${Math.round(w * s)} × ${Math.round(h * s)} px`;
  $('dims').textContent = count > 1 ? `${label} · ${count}장` : label;
}

function applyZoom() {
  const h = host();
  if (state.zoom !== 'fit') { h.style.zoom = String(state.zoom); return; }
  // 패널을 꽉 채우지 않고 조금 여유를 둔다.
  const avail = (scroller().clientWidth - 56) * 0.88;
  h.style.zoom = '1';
  const natural = h.scrollWidth || 1;
  h.style.zoom = String(Math.min(1, avail / natural));
}

async function renderNow() {
  host().classList.toggle('is-checker', state.checker);
  host().style.zoom = '1';

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
  saveSoon(() => {
    const hint = $('saveHint');
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
      for (const s of stages) blobs.push(await nodeToBlob(s, { scale, format, quality, background }));
      return blobs;
    } finally { box.remove(); }
  }

  const shot = HtmlTab.getShotNode();
  if (!shot) throw new Error('미리보기가 아직 준비되지 않았습니다');
  const o = state.html.opts;
  const background = (format !== 'png' && o.transparent) ? '#FFFFFF' : null;
  const prevZoom = host().style.zoom;
  host().style.zoom = '1';
  try {
    return [await nodeToBlob(shot, { scale, format, quality, background })];
  } finally { host().style.zoom = prevZoom; }
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
    const msg = await downloadMany(blobs, state.output.filename, ext);
    toast(msg);
    busy(false, '');
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
function setTab(name) {
  state.tab = name;
  document.querySelectorAll('.tab').forEach(t => {
    const on = t.dataset.tab === name;
    t.classList.toggle('is-active', on);
    t.setAttribute('aria-selected', String(on));
  });
  document.querySelectorAll('.tabpane').forEach(p => p.classList.toggle('is-active', p.dataset.pane === name));
  $('splitSeg').hidden = name !== 'text';
  scheduleRender();
}

/* ── 시작 ───────────────────────────────────── */
function boot() {
  loadAll();

  TextTab.bindEditor(scheduleRender);
  TextTab.buildSlotBar(scheduleRender);
  TextTab.buildSettings($('textSettings'), scheduleRender);
  HtmlTab.bindEditor(scheduleRender);
  HtmlTab.buildSettings($('htmlSettings'), scheduleRender);

  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => setTab(t.dataset.tab)));

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
  });

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

  renderNow();
}

boot();
