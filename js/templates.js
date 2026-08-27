/* 템플릿 — 스타일과 말풍선 프로필을 한 묶음으로 이름 붙여 저장/덮어쓰기.
   자동 서식 on/off 는 템플릿에 넣지 않는다 (전역 설정). */

import { state, templates, persistTemplates, DEFAULT_STYLE, templatePhotoCount } from './store.js';
import { el, toast } from './ui.js';
import { downloadBlob } from './capture.js';

const clone = (o) => JSON.parse(JSON.stringify(o));

/* 지금 설정 한 벌. 프로필은 사진까지 그대로 담는다. */
function pack() {
  return { style: clone(state.text.style), profiles: clone(state.text.profiles) };
}

/* 예전에는 스타일만 담았다. 그때 저장한 것은 style 키가 없으니 통째로 스타일로 본다. */
function unpack(t) {
  return t && t.style ? { style: t.style, profiles: t.profiles } : { style: t, profiles: null };
}

/* 본문에서 「이름 |」으로 실제 쓰이고 있는 화자 이름 */
function speakersInUse() {
  const lines = String(state.text.source).split(/\r?\n/);
  return state.text.profiles
    .map(p => p.name)
    .filter(n => n && lines.some(l => l.trimStart().startsWith(n)
      && /^\s*\|/.test(l.trimStart().slice(n.length))));
}

/* 프로필까지 바꾸면 본문의 이름표가 안 맞아 말풍선이 풀릴 수 있다. 미리 묻는다. */
function okToSwapProfiles(name, next) {
  if (!next || !next.length) return true;
  const have = new Set(next.map(p => p.name));
  const lost = speakersInUse().filter(n => !have.has(n));
  if (!lost.length) return true;
  return confirm(`「${name}」의 프로필에는 ${lost.map(n => `「${n}」`).join(' ')} 이(가) 없습니다.\n`
    + '그 줄은 말풍선이 아니라 그냥 글로 나옵니다. 그래도 적용할까요?');
}

export function buildTemplateSection(onApply, rerender) {
  const list = el('div', { class: 'tpl-list' });

  function paint() {
    list.textContent = '';
    const names = Object.keys(templates).sort();
    if (!names.length) {
      list.appendChild(el('div', { class: 'empty', text: '저장된 템플릿이 없습니다.' }));
      return;
    }
    for (const name of names) {
      const pics = templatePhotoCount(templates[name]);
      const row = el('div', { class: `tpl-row${state.activeTemplate === name ? ' is-active' : ''}` }, [
        el('button', {
          class: 'tpl-name', type: 'button', text: name, title: '적용',
          onClick: () => {
            const { style, profiles } = unpack(templates[name]);
            if (!okToSwapProfiles(name, profiles)) return;
            Object.assign(state.text.style, clone(style));
            if (profiles && profiles.length) state.text.profiles = clone(profiles);
            state.activeTemplate = name;
            onApply();
            rerender();
            toast(profiles ? `「${name}」 적용 — 프로필까지` : `「${name}」 적용`);
          },
        }),
        pics ? el('span', { class: 'tpl-pics', text: `사진 ${pics}`, title: '이 템플릿이 붙들고 있는 사진 수' }) : null,
        el('button', {
          class: 'tpl-act', type: 'button', text: '덮어쓰기',
          onClick: () => {
            const keep = templates[name];
            templates[name] = pack();
            if (!persistTemplates()) {
              templates[name] = keep;
              toast('저장 공간이 모자랍니다. 프로필 사진을 줄여 보세요');
              return;
            }
            state.activeTemplate = name;
            paint();
            toast(`「${name}」 덮어씀`);
          },
        }),
        el('button', {
          class: 'tpl-act del', type: 'button', text: '삭제',
          onClick: () => {
            if (!confirm(`「${name}」 템플릿을 삭제할까요?`)) return;
            delete templates[name];
            if (state.activeTemplate === name) state.activeTemplate = null;
            persistTemplates();
            paint();
          },
        }),
      ]);
      list.appendChild(row);
    }
  }
  paint();

  const nameInput = el('input', { type: 'text', placeholder: '새 템플릿 이름' });

  const saveBtn = el('button', {
    class: 'btn btn-ghost btn-sm', type: 'button', text: '현재 설정 저장',
    onClick: () => {
      const name = nameInput.value.trim();
      if (!name) { toast('이름을 입력하세요'); return; }
      if (templates[name] && !confirm(`「${name}」 이(가) 이미 있습니다. 덮어쓸까요?`)) return;
      const keep = templates[name];
      templates[name] = pack();
      if (!persistTemplates()) {
        if (keep) templates[name] = keep; else delete templates[name];
        toast('저장 공간이 모자랍니다. 프로필 사진을 줄여 보세요');
        return;
      }
      state.activeTemplate = name;
      nameInput.value = '';
      paint();
      toast(`「${name}」 저장 — 프로필까지`);
    },
  });

  const resetBtn = el('button', {
    class: 'btn btn-ghost btn-sm', type: 'button', text: '기본값으로',
    onClick: () => {
      Object.assign(state.text.style, JSON.parse(JSON.stringify(DEFAULT_STYLE)));
      state.activeTemplate = null;
      onApply();
      rerender();
      toast('기본 템플릿으로 되돌림');
    },
  });

  const exportBtn = el('button', {
    class: 'btn btn-ghost btn-sm', type: 'button', text: 'JSON 내보내기',
    onClick: () => {
      const blob = new Blob([JSON.stringify(templates, null, 2)], { type: 'application/json' });
      downloadBlob(blob, 'textshot-templates.json');
      toast('템플릿을 파일로 내보냈습니다');
    },
  });

  const fileInput = el('input', {
    type: 'file', accept: 'application/json', style: 'display:none',
    onChange: async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('형식이 올바르지 않습니다');
        let added = 0;
        for (const [k, v] of Object.entries(parsed)) {
          if (v && typeof v === 'object') { templates[k] = v; added++; }
        }
        persistTemplates();
        paint();
        toast(`${added}개 템플릿을 불러왔습니다`);
      } catch (err) {
        toast(`불러오기 실패: ${err.message}`);
      }
      e.target.value = '';
    },
  });

  const importBtn = el('button', {
    class: 'btn btn-ghost btn-sm', type: 'button', text: 'JSON 불러오기',
    onClick: () => fileInput.click(),
  });

  return {
    node: el('div', { style: 'display:flex;flex-direction:column;gap:10px' }, [
      list,
      el('div', { class: 'field-row' }, [nameInput, saveBtn]),
      el('div', { class: 'field-row' }, [resetBtn, exportBtn, importBtn, fileInput]),
      el('div', { class: 'hint', text: '템플릿에는 스타일과 말풍선 프로필(이름·색·사진)이 함께 담깁니다. '
        + '적용하면 지금 프로필을 그 템플릿의 것으로 갈아 끼웁니다.' }),
      el('div', { class: 'hint', text: '템플릿은 이 브라우저에만 저장됩니다. 데이터를 지우면 사라지니 JSON으로 백업해 두세요.' }),
    ]),
    refresh: paint,
  };
}
