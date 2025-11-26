(function () {
  const prev = window.Dieter || {};

  function parseFields(raw) {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function createEmptyItem(fields) {
    const base = {};
    fields.forEach((f) => {
      if (f && f.key) base[f.key] = f.type === 'toggle' ? false : '';
    });
    base.id = base.id || `item_${Math.random().toString(16).slice(2)}`;
    return base;
  }

  function sanitizeString(v) {
    return typeof v === 'string' ? v : '';
  }

  function hydrateRepeatableList(scope) {
    const roots = (scope || document).querySelectorAll('.diet-repeatable-list');
    roots.forEach((root) => {
      const hidden = root.querySelector('.diet-repeatable-list__hidden');
      const path = hidden?.getAttribute('data-bob-path') || '';
      const fields = parseFields(root.getAttribute('data-fields')) || [
        { key: 'question', label: 'Question', type: 'text' },
        { key: 'answer', label: 'Answer', type: 'textarea' },
        { key: 'category', label: 'Category', type: 'text' },
      ];
      const addButtons = root.querySelectorAll('.diet-repeatable-list__footer button, .diet-repeatable-list__header .diet-btn-ic');
      const itemsContainer = root.querySelector('[data-role="items"]');
      if (!itemsContainer) return;

      let items = [createEmptyItem(fields)];

      function parseInitial() {
        if (!(hidden instanceof HTMLInputElement)) return;
        try {
          const parsed = hidden.value ? JSON.parse(hidden.value) : [];
          if (Array.isArray(parsed) && parsed.length > 0) {
            items = parsed;
          }
        } catch {
          items = [createEmptyItem(fields)];
        }
      }

      function emit() {
        if (!(hidden instanceof HTMLInputElement)) return;
        hidden.value = JSON.stringify(items);
        hidden.dispatchEvent(new Event('input', { bubbles: true }));
      }

      function updateItem(idx, key, value) {
        const next = [...items];
        next[idx] = { ...next[idx], [key]: value };
        items = next;
        emit();
      }

      function removeItem(idx) {
        if (items.length === 1) return;
        items = items.filter((_, i) => i !== idx);
        render();
        emit();
      }

      function moveItem(idx, delta) {
        const nextIdx = idx + delta;
        if (nextIdx < 0 || nextIdx >= items.length) return;
        const next = [...items];
        const [item] = next.splice(idx, 1);
        next.splice(nextIdx, 0, item);
        items = next;
        render();
        emit();
      }

      function addItem() {
        items = [...items, createEmptyItem(fields)];
        render();
        emit();
      }

      function render() {
        itemsContainer.innerHTML = '';
        items.forEach((item, idx) => {
          const card = document.createElement('div');
          card.className = 'diet-repeatable-list__item';
          const header = document.createElement('div');
          header.className = 'diet-repeatable-list__item-header';
          const label = document.createElement('div');
          label.className = 'diet-repeatable-list__item-label';
          label.textContent = `Item ${idx + 1}`;
          const actions = document.createElement('div');
          actions.className = 'diet-repeatable-list__item-actions';

          const btnUp = document.createElement('button');
          btnUp.className = 'diet-btn-ic';
          btnUp.type = 'button';
          btnUp.dataset.size = 'xs';
          btnUp.dataset.variant = 'neutral';
          btnUp.innerHTML = '<span class="diet-btn-ic__icon" data-icon="chevron.up"></span>';
          btnUp.addEventListener('click', () => moveItem(idx, -1));

          const btnDown = document.createElement('button');
          btnDown.className = 'diet-btn-ic';
          btnDown.type = 'button';
          btnDown.dataset.size = 'xs';
          btnDown.dataset.variant = 'neutral';
          btnDown.innerHTML = '<span class="diet-btn-ic__icon" data-icon="chevron.down"></span>';
          btnDown.addEventListener('click', () => moveItem(idx, 1));

          const btnDel = document.createElement('button');
          btnDel.className = 'diet-btn-ic';
          btnDel.type = 'button';
          btnDel.dataset.size = 'xs';
          btnDel.dataset.variant = 'neutral';
          btnDel.innerHTML = '<span class="diet-btn-ic__icon" data-icon="trash"></span>';
          btnDel.addEventListener('click', () => removeItem(idx));

          actions.append(btnUp, btnDown, btnDel);
          header.append(label, actions);
          card.append(header);

          const fieldsWrap = document.createElement('div');
          fieldsWrap.className = 'diet-repeatable-list__fields';
          fields.forEach((field) => {
            if (!field || !field.key) return;
            const row = document.createElement('div');
            row.className = 'diet-repeatable-list__row';
            const labelEl = document.createElement('label');
            labelEl.className = 'label-s';
            labelEl.textContent = field.label || field.key;
            row.append(labelEl);
            if (field.type === 'toggle') {
              const toggle = document.createElement('input');
              toggle.type = 'checkbox';
              toggle.checked = Boolean(item[field.key]);
              toggle.addEventListener('change', (e) => updateItem(idx, field.key, e.target.checked));
              row.append(toggle);
            } else if (field.type === 'textarea') {
              const textarea = document.createElement('textarea');
              textarea.value = sanitizeString(item[field.key]);
              textarea.placeholder = field.placeholder || '';
              textarea.addEventListener('input', (e) => updateItem(idx, field.key, e.target.value));
              row.append(textarea);
            } else {
              const input = document.createElement('input');
              input.type = 'text';
              input.value = sanitizeString(item[field.key]);
              input.placeholder = field.placeholder || '';
              input.addEventListener('input', (e) => updateItem(idx, field.key, e.target.value));
              row.append(input);
            }
            fieldsWrap.append(row);
          });

          card.append(fieldsWrap);
          itemsContainer.append(card);
        });
      }

      addButtons.forEach((btn) => btn.addEventListener('click', addItem));

      parseInitial();
      render();
    });
  }

  window.Dieter = { ...prev, hydrateRepeatableList };
})();
