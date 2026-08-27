/* 템플릿 — 스타일 묶음을 이름으로 저장/덮어쓰기.
   자동 서식 on/off 는 템플릿에 넣지 않는다 (전역 설정). */

import { state, templates, persistTemplates, DEFAULT_STYLE } from './store.js';
import { el, toast } from './ui.js';
import { downloadBlob } from './capture.js';

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
      const row = el('div', { class: `tpl-row${state.activeTemplate === name ? ' is-active' : ''}` }, [
        el('button', {
          class: 'tpl-name', type: 'button', text: name, title: '적용',
          onClick: () => {
            Object.assign(state.text.style, JSON.parse(JSON.stringify(templates[name])));
            state.activeTemplate = name;
            onApply();
            rerender();
            toast(`「${name}」 적용`);
          },
        }),
        el('button', {
          class: 'tpl-act', type: 'button', text: '덮어쓰기',
          onClick: () => {
            templates[name] = JSON.parse(JSON.stringify(state.text.style));
            persistTemplates();
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
      templates[name] = JSON.parse(JSON.stringify(state.text.style));
      persistTemplates();
      state.activeTemplate = name;
      nameInput.value = '';
      paint();
      toast(`「${name}」 저장`);
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

  /* 파일 이름에 못 쓰는 글자를 걷어낸다 */
  const safeName = (s) => String(s).replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 40);

  /* 내보낸 파일이 죄다 같은 이름이면 나중에 뭐가 뭔지 모른다.
     고른 템플릿(없으면 딱 하나뿐인 템플릿)의 이름을 뒤에 붙인다. */
  function exportName() {
    const names = Object.keys(templates);
    const tag = safeName(state.activeTemplate || (names.length === 1 ? names[0] : ''));
    return tag ? `textshot-templates_${tag}.json` : 'textshot-templates.json';
  }

  const exportBtn = el('button', {
    class: 'btn btn-ghost btn-sm', type: 'button', text: 'JSON 내보내기',
    onClick: () => {
      const blob = new Blob([JSON.stringify(templates, null, 2)], { type: 'application/json' });
      const name = exportName();
      downloadBlob(blob, name);
      toast(`${name} 으로 내보냈습니다`);
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
      el('div', { class: 'hint', text: '템플릿은 이 브라우저에만 저장됩니다. 데이터를 지우면 사라지니 JSON으로 백업해 두세요.' }),
    ]),
    refresh: paint,
  };
}
