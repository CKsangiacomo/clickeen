export function resolvePathFromTarget(target: EventTarget | null): string | null {
  if (!target || !(target instanceof HTMLElement)) return null;
  const direct = target.closest<HTMLElement>('[data-bob-path]');
  if (direct) return direct.getAttribute('data-bob-path');

  const editor = target.closest<HTMLElement>('.diet-dropdown-edit__editor');
  const controlRoot = editor?.closest<HTMLElement>('.diet-dropdown-edit');
  if (controlRoot) {
    const hidden = controlRoot.querySelector<HTMLElement>('[data-bob-path]');
    if (hidden) return hidden.getAttribute('data-bob-path');
  }
  return null;
}
function expectsJsonArrayField(input: HTMLElement): boolean {
  return (
    input.classList.contains('diet-repeater__field') ||
    input.classList.contains('diet-object-manager__field') ||
    input.classList.contains('diet-bulk-edit__field')
  );
}

export function parseDieterJsonFieldValue(input: HTMLInputElement, rawValue: string): { ok: true; value: unknown } | { ok: false } {
  if (input.dataset.dieterJson == null) return { ok: false };
  const trimmed = rawValue.trim();
  if (!trimmed) return { ok: false };
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (expectsJsonArrayField(input) && !Array.isArray(parsed)) return { ok: false };
    return { ok: true, value: parsed };
  } catch {
    return { ok: false };
  }
}

function serializeDieterJsonArrayValue(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '[]';
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) return trimmed;
    } catch {
      // Fall through to default.
    }
  }
  return '[]';
}

function serializeDieterJsonValue(value: unknown, fallback = ''): string {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      return JSON.stringify(value);
    }
  }
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

export function serializeDieterJsonFieldValue(input: HTMLInputElement, value: unknown): string {
  if (expectsJsonArrayField(input)) {
    return serializeDieterJsonArrayValue(value);
  }
  if (input.classList.contains('diet-dropdown-upload__value-field') && value === null) {
    return 'null';
  }
  if (input.classList.contains('diet-date-range-picker__field') && value === null) {
    return 'null';
  }
  return serializeDieterJsonValue(value);
}
