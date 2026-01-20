export function hydrateValuefield(scope: Element | DocumentFragment): void {
  scope.querySelectorAll<HTMLElement>('.diet-valuefield').forEach((root) => {
    const control = root.querySelector<HTMLElement>('.diet-valuefield__control');
    const input = root.querySelector<HTMLInputElement>('.diet-valuefield__field');
    if (!control || !input) return;
    if (control.dataset.valuefieldWired === 'true') return;
    control.dataset.valuefieldWired = 'true';

    const syncWidth = () => {
      const raw = input.value || '';
      const length = Math.max(1, String(raw).length);
      root.style.setProperty('--valuefield-ch', `${length}ch`);
    };

    const focusInput = (event: PointerEvent | MouseEvent) => {
      if ('button' in event && typeof event.button === 'number' && event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('button') || target.closest('[data-valuefield-keep-focus]')) return;
      if (document.activeElement !== input) {
        input.focus({ preventScroll: true });
      }
    };

    control.addEventListener('pointerdown', focusInput);
    control.addEventListener('click', (event) => {
      if ((event.target as HTMLElement | null)?.tagName === 'INPUT') return;
      focusInput(event);
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        input.blur();
      }
    });

    input.addEventListener('input', syncWidth);
    input.addEventListener('change', syncWidth);
    syncWidth();
  });
}
