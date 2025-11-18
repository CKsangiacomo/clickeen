export function hydrateTextfield(scope: Element | DocumentFragment): void {
  scope.querySelectorAll<HTMLElement>('.diet-textfield').forEach((root) => {
    const control = root.querySelector<HTMLElement>('.diet-textfield__control');
    const input = root.querySelector<HTMLInputElement>('.diet-textfield__field');
    if (!control || !input) return;
    if (control.dataset.textfieldWired === 'true') return;
    control.dataset.textfieldWired = 'true';

    const focusInput = (event: PointerEvent | MouseEvent) => {
      if ('button' in event && typeof event.button === 'number' && event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      // Ignore clicks on buttons or disabled elements inside the control
      if (target.closest('button') || target.closest('[data-textfield-keep-focus]')) return;
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
  });
}
