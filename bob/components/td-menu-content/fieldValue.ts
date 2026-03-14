export function resolvePathFromTarget(target: EventTarget | null): string | null {
  if (!target || !(target instanceof HTMLElement)) return null;
  const direct = target.closest<HTMLElement>('[data-bob-path]');
  if (direct) return direct.getAttribute('data-bob-path');

  const controlRoot = target.closest<HTMLElement>('.diet-dropdown-edit, .diet-textedit');
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

export function parseBobJsonValue(input: HTMLInputElement, rawValue: string): unknown | null {
  if (input.dataset.bobJson == null) return null;
  const trimmed = rawValue.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (expectsJsonArrayField(input) && !Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function serializeBobJsonArrayValue(value: unknown): string {
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

function serializeBobJsonValue(value: unknown, fallback = ''): string {
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

export function serializeBobJsonFieldValue(input: HTMLInputElement, value: unknown): string {
  if (expectsJsonArrayField(input)) {
    return serializeBobJsonArrayValue(value);
  }
  return serializeBobJsonValue(value);
}
