function syncSelected(group: HTMLElement) {
  const inputs = Array.from(group.querySelectorAll<HTMLInputElement>('.diet-tab__input'));
  inputs.forEach((input) => {
    const label = group.querySelector<HTMLLabelElement>(`label[for="${input.id}"]`);
    if (!label) return;
    label.setAttribute('role', 'tab');
    label.setAttribute('aria-selected', input.checked ? 'true' : 'false');
    if (input.checked) {
      label.setAttribute('tabindex', '0');
    } else {
      label.setAttribute('tabindex', '-1');
    }
  });
}

export function hydrateTabs(scope: Element | DocumentFragment): void {
  scope.querySelectorAll<HTMLElement>('.diet-tabs').forEach((group) => {
    if (group.dataset.tabsWired === 'true') return;
    group.dataset.tabsWired = 'true';

    syncSelected(group);

    group.addEventListener('change', (event) => {
      if (!(event.target instanceof HTMLInputElement)) return;
      if (!event.target.classList.contains('diet-tab__input')) return;
      syncSelected(group);
    });

    group.addEventListener('keydown', (event) => {
      const activeLabel = group.querySelector<HTMLLabelElement>('label[role="tab"][aria-selected="true"]');
      if (!activeLabel) return;
      const tabs = Array.from(group.querySelectorAll<HTMLLabelElement>('label[role="tab"]'));
      const currentIndex = tabs.indexOf(activeLabel);
      if (currentIndex === -1) return;

      let nextIndex = currentIndex;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        nextIndex = (currentIndex + 1) % tabs.length;
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      } else {
        return;
      }

      event.preventDefault();
      const nextLabel = tabs[nextIndex];
      const inputId = nextLabel.getAttribute('for');
      if (!inputId) return;
      const input = group.querySelector<HTMLInputElement>(`#${inputId}`);
      if (!input) return;
      input.checked = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      nextLabel.focus();
    });
  });
}
