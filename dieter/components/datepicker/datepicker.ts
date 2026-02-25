export function hydrateDatepicker(scope: Element | DocumentFragment): void {
  scope.querySelectorAll<HTMLElement>('.diet-datepicker').forEach((root) => {
    const control = root.querySelector<HTMLElement>('.diet-datepicker__control');
    const input = root.querySelector<HTMLInputElement>('.diet-datepicker__field');
    if (!control || !input) return;
    if (control.dataset.datepickerWired === 'true') return;
    control.dataset.datepickerWired = 'true';

    const focusInput = (event: PointerEvent | MouseEvent) => {
      if ('button' in event && typeof event.button === 'number' && event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('button') || target.closest('[data-datepicker-keep-focus]')) return;
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
