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
    unit ? el('span', { class: 'step-unit', text: unit }) : null,
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

export function select(value, options, onChange) {
  const s = el('select', { onChange: (e) => onChange(e.target.value) },
    options.map(([v, label]) => el('option', { value: v, text: label, selected: v === value })));
  s.value = value;
  return s;
}

export function seg(value, options, onChange) {
  const wrap = el('div', { class: 'seg-inline' });
  options.forEach(([v, label]) => {
    const b = el('button', {
      type: 'button', text: label,
      class: v === value ? 'is-active' : '',
      onClick: () => {
        [...wrap.children].forEach(c => c.classList.remove('is-active'));
        b.classList.add('is-active');
        onChange(v);
      },
    });
    wrap.appendChild(b);
  });
  return wrap;
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
export function toast(msg, ms = 2200) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}
