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

export function color(value, onChange) {
  const swatch = el('input', { type: 'color', value, onInput: (e) => { hex.value = e.target.value; onChange(e.target.value); } });
  const hex = el('input', {
    type: 'text', value,
    onChange: (e) => {
      const v = e.target.value.trim();
      if (/^#[0-9a-f]{6}$/i.test(v)) { swatch.value = v; onChange(v); }
      else e.target.value = swatch.value;
    },
  });
  return el('div', { class: 'field-row' }, [swatch, hex]);
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
