export function hydrateDatepicker(scope: Element | DocumentFragment): void {
  scope.querySelectorAll<HTMLElement>('.diet-datepicker').forEach((root) => {
    const control = root.querySelector<HTMLElement>('.diet-datepicker__control');
    const hidden = root.querySelector<HTMLInputElement>('.diet-datepicker__field');
    const dateInput = root.querySelector<HTMLInputElement>('.diet-datepicker__date');
    const timeInput = root.querySelector<HTMLInputElement>('.diet-datepicker__time');
    if (!control || !hidden || !dateInput || !timeInput) return;
    if (control.dataset.datepickerWired === 'true') return;
    control.dataset.datepickerWired = 'true';

    const parseIsoDateTime = (value: string): { date: string; time: string } | null => {
      const raw = String(value || '').trim();
      if (!raw) return null;
      const match = raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?$/);
      if (!match) return null;
      return { date: match[1], time: match[2] };
    };

    const writeVisibleFromHidden = () => {
      const parsed = parseIsoDateTime(hidden.value);
      if (!parsed) {
        if (dateInput.value) dateInput.value = '';
        if (timeInput.value) timeInput.value = '';
        return;
      }
      if (dateInput.value !== parsed.date) dateInput.value = parsed.date;
      if (timeInput.value !== parsed.time) timeInput.value = parsed.time;
    };

    const composeDateTimeValue = (): string => {
      const date = dateInput.value.trim();
      const time = timeInput.value.trim();
      if (!date && !time) return '';
      if (!date) return '';
      return `${date}T${time || '00:00'}`;
    };

    const emitHiddenUpdate = (type: 'input' | 'change') => {
      const nextValue = composeDateTimeValue();
      if (hidden.value === nextValue) return;
      hidden.value = nextValue;
      hidden.dispatchEvent(new Event(type, { bubbles: true }));
    };

    const focusInput = (event: PointerEvent | MouseEvent) => {
      if ('button' in event && typeof event.button === 'number' && event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('button') || target.closest('[data-datepicker-keep-focus]')) return;
      if (document.activeElement !== dateInput) {
        dateInput.focus({ preventScroll: true });
      }
    };

    control.addEventListener('pointerdown', focusInput);
    control.addEventListener('click', (event) => {
      if ((event.target as HTMLElement | null)?.tagName === 'INPUT') return;
      focusInput(event);
    });

    dateInput.addEventListener('input', () => emitHiddenUpdate('input'));
    dateInput.addEventListener('change', () => emitHiddenUpdate('change'));
    timeInput.addEventListener('input', () => emitHiddenUpdate('input'));
    timeInput.addEventListener('change', () => emitHiddenUpdate('change'));

    hidden.addEventListener('external-sync', () => {
      writeVisibleFromHidden();
    });

    const handleEnter = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        (event.currentTarget as HTMLInputElement).blur();
      }
    };
    dateInput.addEventListener('keydown', handleEnter);
    timeInput.addEventListener('keydown', handleEnter);

    writeVisibleFromHidden();
  });
}
