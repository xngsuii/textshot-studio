/* 설정 패널을 만드는 작은 도구들 */

export function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2).toLowerCase(), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) if (c) n.appendChild(c);
  return n;
}

export function section(title, open, children) {
  const body = el('div', { class: 'sect-body' }, children);
  const head = el('button', { class: 'sect-head', type: 'button' }, [
    el('span', { text: title }), el('span', { class: 'chev-s' }),
  ]);
  const sect = el('div', { class: `sect${open ? ' is-open' : ''}` }, [head, body]);
  head.addEventListener('click', () => sect.classList.toggle('is-open'));
  return sect;
}

export function field(label, control) {
  return el('div', { class: 'field' }, [el('label', { text: label }), control]);
}

export function fieldWide(control) {
  return el('div', { class: 'field field-wide' }, [control]);
}

/* 좁은 칸 넷을 2×2 로. 라벨은 값 위에 얹는다. */
export function fieldGrid(fields) {
  return el('div', { class: 'field-grid' }, fields);
}

export function num(value, { min, max, step = 1, onChange }) {
  return el('input', {
    type: 'number', value, min, max, step,
    onInput: (e) => {
      const v = parseFloat(e.target.value);
      if (!Number.isNaN(v)) onChange(v);
    },
  });
}

export function range(value, { min, max, step = 1, unit = '', onChange }) {
  const out = el('span', { class: 'range-val', text: `${value}${unit}` });
  const input = el('input', {
    type: 'range', value, min, max, step,
    onInput: (e) => {
      const v = parseFloat(e.target.value);
      out.textContent = `${v}${unit}`;
      onChange(v);
    },
  });
  return el('div', { class: 'range-row' }, [input, out]);
}

/* 굵은 막대에 동그란 손잡이. 옆에 기본값으로 되돌리는 단추가 붙는다.
   지나온 자리는 --fill 로 칠한다 (파이어폭스는 ::-moz-range-progress 가 맡는다). */
export function slider(value, { min, max, step = 1, unit = '', reset, onChange }) {
  const out = el('span', { class: 'slider-val', text: `${value}${unit}` });
  const input = el('input', {
    type: 'range', class: 'slider', value, min, max, step,
    onInput: (e) => { onChange(parseFloat(e.target.value)); },
  });
  const paint = () => {
    const v = parseFloat(input.value);
    out.textContent = `${v}${unit}`;
    input.style.setProperty('--fill', `${((v - min) / (max - min)) * 100}%`);
  };
  input.addEventListener('input', paint);
  paint();

  // reset 을 주지 않으면 되돌리기 단추를 붙이지 않는다
  const btn = reset === undefined ? null : el('button', {
    class: 'slider-reset', type: 'button', text: '초기화', title: `기본값(${reset}${unit})으로`,
    onClick: () => { input.value = reset; paint(); onChange(reset); },
  });
  return el('div', { class: 'slider-row' }, [input, out, btn]);
}

/* 숫자 입력 + 증감 버튼. 직접 타이핑도 되고 버튼은 step 만큼 움직인다. */
export function stepper(value, { min, max, step = 1, decimals = 0, unit = '', onChange }) {
  const fmt = (v) => (decimals ? v.toFixed(decimals) : String(v));
  let cur = value;

  const input = el('input', {
    type: 'number', value: fmt(cur), min, max, step, class: 'step-input',
    onInput: (e) => {
      const v = parseFloat(e.target.value);
      if (Number.isNaN(v)) return;
      cur = v; onChange(v);
    },
  });

  const bump = (d) => {
    let v = Math.round((cur + d) * 1000) / 1000;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    cur = v; input.value = fmt(v); onChange(v);
  };

  return el('div', { class: 'stepper' }, [
    el('button', { type: 'button', class: 'step-btn', text: '−', title: `− ${step}`, onClick: () => bump(-step) }),
    input,
    el('button', { type: 'button', class: 'step-btn', text: '+', title: `+ ${step}`, onClick: () => bump(step) }),
    el('span', { class: 'step-unit', text: unit || '' }),
  ]);
}

export function color(value, onChange) {
  const swatch = el('input', { type: 'color', value, onInput: (e) => { hex.value = e.target.value; onChange(e.target.value); } });
  const hex = el('input', {
    type: 'text', value, class: 'hex-input',
    onChange: (e) => {
      const v = e.target.value.trim();
      if (/^#[0-9a-f]{6}$/i.test(v)) { swatch.value = v; onChange(v); }
      else e.target.value = swatch.value;
    },
  });
  return el('div', { class: 'field-row' }, [swatch, hex]);
}

/* 라벨을 위에 얹은 좁은 색상 칸. 여러 개를 격자로 늘어놓을 때 쓴다. */
export function colorCell(label, value, onChange) {
  return el('div', { class: 'ccell' }, [
    el('span', { class: 'ccell-l', text: label }),
    color(value, onChange),
  ]);
}

export function colorGrid(cols, cells) {
  return el('div', { class: `ccell-grid cols-${cols}` }, cells);
}

/* 토글 줄에 나란히 끼우는 퍼센트 칸. 생김새는 토글과 맞춘다. */
export function pct(label, value, onChange, title) {
  const input = el('input', {
    type: 'number', class: 'alpha-input', min: 0, max: 100, step: 5, value,
    onInput: (e) => {
      const v = parseFloat(e.target.value);
      if (Number.isNaN(v)) return;
      onChange(Math.max(0, Math.min(100, v)));
    },
  });
  return el('label', { class: 'tgl tgl-pct', title: title || null }, [
    el('span', { class: 'tgl-name', text: label }),
    input,
    el('span', { class: 'alpha-u', text: '%' }),
  ]);
}

/* 버튼 아래에 뜨는 작은 차림표. 바깥을 누르면 닫힌다.
   색 고르개를 안에 담으므로 안쪽을 눌러서는 닫지 않는다. */
let openPop = null;
let lastClose = { anchor: null, t: 0 };

export function closePopup() {
  if (!openPop) return;
  lastClose = { anchor: openPop.__anchor, t: Date.now() };
  document.removeEventListener('pointerdown', onOutside, true);
  document.removeEventListener('scroll', closePopup, true);
  window.removeEventListener('resize', closePopup);
  openPop.remove();
  openPop = null;
}

function onOutside(e) {
  if (openPop && !openPop.contains(e.target)) closePopup();
}

export function popup(anchor, rows) {
  // 열려 있는 차림표는 바깥 누름이 이미 닫았다. 같은 버튼을 다시 누른 것이면 그대로 둔다.
  if (lastClose.anchor === anchor && Date.now() - lastClose.t < 300) {
    lastClose = { anchor: null, t: 0 };
    return null;
  }
  closePopup();
  const menu = el('div', { class: 'popup' }, rows);
  menu.__anchor = anchor;
  document.body.appendChild(menu);
  openPop = menu;

  const r = anchor.getBoundingClientRect();
  const left = Math.max(8, Math.min(r.left, window.innerWidth - menu.offsetWidth - 8));
  // 아래로 넘치면 버튼 위쪽에 붙인다
  const below = r.bottom + 4;
  const top = below + menu.offsetHeight + 8 > window.innerHeight
    ? Math.max(8, r.top - menu.offsetHeight - 4)
    : below;
  menu.style.left = Math.round(left) + 'px';
  menu.style.top = Math.round(top) + 'px';

  // 지금 이 클릭이 곧바로 닫아 버리지 않도록 한 틱 뒤에 건다
  setTimeout(() => {
    if (openPop !== menu) return;
    document.addEventListener('pointerdown', onOutside, true);
    // 설정칸이 스크롤되면 버튼과 어긋나므로 닫는다
    document.addEventListener('scroll', closePopup, true);
    window.addEventListener('resize', closePopup);
  }, 0);
  return menu;
}

/* 손잡이를 잡고 끌어 순서를 바꾼다.
   끌리는 칸은 손끝을 그대로 따라가고(투명도는 건드리지 않는다),
   나머지가 처음 재 둔 자리를 오가며 비켜 준다. */
export function dragGrip(label = '끌어서 순서 바꾸기') {
  return el('button', {
    class: 'drag-grip', type: 'button', title: label, 'aria-label': label,
    html: "<svg viewBox='0 0 10 16' aria-hidden='true'>"
      + "<circle cx='3' cy='3.5' r='1.15'/><circle cx='7' cy='3.5' r='1.15'/>"
      + "<circle cx='3' cy='8' r='1.15'/><circle cx='7' cy='8' r='1.15'/>"
      + "<circle cx='3' cy='12.5' r='1.15'/><circle cx='7' cy='12.5' r='1.15'/></svg>",
  });
}

/* axis 로 움직일 방향을 묶을 수 있다.
   'y' 세로만 (한 줄짜리 목록) / 'x' 가로만 / 'both' 둘 다 (칸이 여러 열일 때) */
export function dragSort(container, itemSel, onDrop, { axis = 'both' } = {}) {
  let drag = null;

  const shift = () => {
    const { items, rects, from, to } = drag;
    items.forEach((n, j) => {
      if (j === from) return;
      let k = j;
      if (from < to && j > from && j <= to) k = j - 1;
      else if (from > to && j >= to && j < from) k = j + 1;
      n.style.transform = k === j ? ''
        : `translate(${rects[k].left - rects[j].left}px, ${rects[k].top - rects[j].top}px)`;
    });
  };

  container.addEventListener('pointerdown', (e) => {
    const grip = e.target.closest?.('.drag-grip');
    if (!grip || !container.contains(grip)) return;
    const el = grip.closest(itemSel);
    const items = [...container.querySelectorAll(itemSel)];
    const from = items.indexOf(el);
    if (from < 0 || items.length < 2) return;

    e.preventDefault();
    closePopup();
    try { grip.setPointerCapture(e.pointerId); } catch { /* 포인터를 못 잡아도 끌기는 된다 */ }
    drag = {
      grip, items, from, to: from, id: e.pointerId,
      rects: items.map(n => n.getBoundingClientRect()),
      x: e.clientX, y: e.clientY,
    };
    container.classList.add('is-sorting');
    el.classList.add('is-dragging');
  });

  container.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    // 묶어 둔 방향으로는 따라가지 않는다
    const dx = axis === 'y' ? 0 : e.clientX - drag.x;
    const dy = axis === 'x' ? 0 : e.clientY - drag.y;
    drag.items[drag.from].style.transform = `translate(${dx}px, ${dy}px)`;
    // 처음 재 둔 자리를 기준으로 손끝이 어느 칸 위에 있는지 본다.
    // 묶어 둔 방향은 손끝이 옆으로 빗나가도 못 본 척한다.
    let to = drag.to;
    drag.rects.forEach((r, j) => {
      const inX = axis === 'y' || (e.clientX >= r.left && e.clientX <= r.right);
      const inY = axis === 'x' || (e.clientY >= r.top && e.clientY <= r.bottom);
      if (inX && inY) to = j;
    });
    if (to !== drag.to) { drag.to = to; shift(); }
  });

  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { items, from, to } = drag;
    items.forEach(n => { n.style.transform = ''; n.classList.remove('is-dragging'); });
    container.classList.remove('is-sorting');
    drag = null;
    if (to !== from) onDrop(from, to);
  };
  container.addEventListener('pointerup', end);
  container.addEventListener('pointercancel', end);
}

/* 차림표 한 줄. control 을 넘기면 그 칸을 눌러도 control 이 눌린다. */
export function popupRow(label, { onClick, control, danger } = {}) {
  const kids = [el('span', { class: 'popup-l', text: label }), control || null];
  if (control) return el('label', { class: 'popup-row' }, kids);
  return el('button', { class: `popup-row${danger ? ' is-danger' : ''}`, type: 'button', onClick }, kids);
}

export function select(value, options, onChange) {
  const s = el('select', { onChange: (e) => onChange(e.target.value) },
    options.map(([v, label]) => el('option', { value: v, text: label, selected: v === value })));
  s.value = value;
  return s;
}

export function seg(value, options, onChange) {
  const wrap = el('div', { class: 'seg-inline' });
  options.forEach(([v, label]) => {
    const isText = typeof label === 'string';
    const b = el('button', {
      type: 'button', text: isText ? label : null,
      class: v === value ? 'is-active' : '',
      onClick: () => {
        [...wrap.children].forEach(c => c.classList.remove('is-active'));
        b.classList.add('is-active');
        onChange(v);
      },
    }, isText ? [] : [label]);
    wrap.appendChild(b);
  });
  return wrap;
}

/* 모양 미리보기가 붙은 선택 칸 이름표 — 원형·라운드 사각처럼 말로만 하면
   헷갈리는 것에 쓴다. shape 는 CSS 클래스 이름. */
export function shapeLabel(shape, text) {
  return el('span', { class: 'shape-opt' }, [
    el('span', { class: `shape-dot shape-${shape}` }),
    el('span', { text }),
  ]);
}

/* 켜고 끄는 스위치. 체크박스보다 눈에 잘 들어와 목록에 쓴다. */
export function toggle(label, value, onChange, note, title) {
  const input = el('input', { type: 'checkbox', onChange: (e) => onChange(e.target.checked) });
  input.checked = !!value;
  return el('label', { class: 'tgl', title: title || null }, [
    el('span', { class: 'tgl-name', text: label }),
    note ? el('code', { class: 'tgl-mark', text: note }) : null,
    input,
    el('span', { class: 'tgl-track' }, [el('span', { class: 'tgl-knob' })]),
  ]);
}

export function check(label, value, onChange) {
  const input = el('input', { type: 'checkbox', onChange: (e) => onChange(e.target.checked) });
  input.checked = !!value;
  return el('label', { class: 'check' }, [input, el('span', { text: label })]);
}

/* 상하좌우 여백 — 잠금이 켜지면 네 값이 함께 움직인다 */
export function padGrid(obj, keys, getLinked, onChange) {
  const labels = ['위', '오른쪽', '아래', '왼쪽'];
  const inputs = [];
  const cells = keys.map((k, i) => {
    const input = el('input', {
      type: 'number', value: obj[k], min: 0, max: 400,
      onInput: (e) => {
        const v = parseFloat(e.target.value);
        if (Number.isNaN(v)) return;
        if (getLinked()) { keys.forEach((kk, j) => { obj[kk] = v; inputs[j].value = v; }); }
        else obj[k] = v;
        onChange();
      },
    });
    inputs.push(input);
    return el('div', { class: 'pad-cell' }, [input, el('span', { text: labels[i] })]);
  });
  return el('div', { class: 'pad-grid' }, cells);
}

let toastTimer = null;
/* action 을 주면 「되돌리기」 같은 단추가 하나 붙는다. 그때는 좀 더 오래 둔다. */
export function toast(msg, ms = 2200, action = null) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  clearTimeout(toastTimer);
  if (action) {
    t.appendChild(el('button', {
      class: 'toast-act', type: 'button', text: action.label,
      onClick: () => { t.hidden = true; clearTimeout(toastTimer); action.onClick(); },
    }));
  }
  t.hidden = false;
  toastTimer = setTimeout(() => { t.hidden = true; }, action ? Math.max(ms, 6000) : ms);
}
/* 확인창. confirm() 은 고를 수 있는 게 둘뿐이라 「본문만/서식까지」를 못 담는다.
   actions 의 각 항목이 버튼 하나가 되고, 누르면 창을 닫고 onClick 을 부른다. */
export function modal({ title, body = [], actions = [] }) {
  const card = el('div', { class: 'modal-card', role: 'dialog' }, [
    title ? el('div', { class: 'modal-title', text: title }) : null,
    el('div', { class: 'modal-body' }, body),
    el('div', { class: 'modal-acts' }, actions.map(a => el('button', {
      class: `btn btn-sm${a.primary ? ' btn-primary' : ' btn-ghost'}${a.danger ? ' is-danger' : ''}`,
      type: 'button', text: a.label,
      onClick: () => { close(); a.onClick?.(); },
    }))),
  ]);
  const back = el('div', { class: 'modal-back' }, [card]);

  function close() {
    document.removeEventListener('keydown', onKey, true);
    back.remove();
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
  }
  back.addEventListener('pointerdown', (e) => { if (e.target === back) close(); });
  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(back);
  card.querySelector('.btn-primary, .btn')?.focus();
  return close;
}
