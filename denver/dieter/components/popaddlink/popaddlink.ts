export function hydratePopAddLink(scope: Element | DocumentFragment): void {
  scope.querySelectorAll<HTMLElement>('.diet-popaddlink').forEach((root) => {
    const input = root.querySelector<HTMLInputElement>('.diet-popaddlink__input');
    const apply = root.querySelector<HTMLButtonElement>('.diet-popaddlink__apply');
    const close = root.querySelector<HTMLButtonElement>('.diet-popaddlink__close');
    const helper = root.querySelector<HTMLElement>('.diet-popaddlink__helper');
    if (!input || !apply || !close || !helper) return;

    const setState = (state: 'empty' | 'valid' | 'invalid', message = '') => {
      root.dataset.state = state;
      helper.textContent = message;
    };

    const normalizeUrl = (raw: string): { ok: boolean; url: string } => {
      const value = raw.trim();
      if (!value) return { ok: false, url: '' };
      const prefixed = /^https?:\/\//i.test(value) ? value : `https://${value}`;
      try {
        const url = new URL(prefixed);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, url: '' };
        const host = url.hostname.toLowerCase();

        // Allow localhost for dev
        if (host === 'localhost') {
          return { ok: true, url: url.toString() };
        }

        // Require at least one dot and no leading/trailing dot
        if (!host.includes('.') || host.startsWith('.') || host.endsWith('.')) {
          return { ok: false, url: '' };
        }

        const labels = host.split('.');
        // All labels must be non-empty, alphanumeric or hyphen, not starting/ending with '-'
        if (
          labels.some(
            (label) =>
              !label ||
              !/^[a-z0-9-]+$/.test(label) ||
              label.startsWith('-') ||
              label.endsWith('-'),
          )
        ) {
          return { ok: false, url: '' };
        }

        const tld = labels[labels.length - 1];
        if (tld.length < 2) return { ok: false, url: '' };

        return { ok: true, url: url.toString() };
      } catch {
        return { ok: false, url: '' };
      }
    };

    const evaluate = () => {
      const value = input.value;
      if (!value.trim()) {
        setState('empty', '');
        apply.disabled = true;
        return;
      }
      const { ok } = normalizeUrl(value);
      if (ok) {
        setState('valid', '');
        apply.disabled = false;
      } else {
        // While typing an invalid URL, show orange stroke and keep Apply disabled.
        setState('invalid', '');
        apply.disabled = true;
      }
    };

    const emitApply = () => {
      const { ok, url } = normalizeUrl(input.value);
      if (!ok) {
        return;
      }
      const event = new CustomEvent('popaddlink:submit', {
        bubbles: true,
        detail: { href: url },
      });
      root.dispatchEvent(event);
    };

    const emitCancel = () => {
      const event = new CustomEvent('popaddlink:cancel', { bubbles: true });
      root.dispatchEvent(event);
    };

    input.addEventListener('input', evaluate);
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        emitApply();
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        emitCancel();
      }
    });
    apply.addEventListener('click', emitApply);
    close.addEventListener('click', emitCancel);

    // Initial state
    setState('empty', '');
    apply.disabled = true;
  });
}
