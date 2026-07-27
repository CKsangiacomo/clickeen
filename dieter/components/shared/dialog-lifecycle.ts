export type DialogDismissReason = 'escape' | 'backdrop';

export type DialogLifecycleOptions = {
  dialog: HTMLDialogElement;
  initialFocus?: string | HTMLElement | (() => HTMLElement | null);
  requestDismiss: (reason: DialogDismissReason) => void;
};

export type DialogLifecycle = {
  open: (opener?: HTMLElement | null) => void;
  close: () => void;
  destroy: () => void;
};

const focusableSelector = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function resolveInitialFocus(
  dialog: HTMLDialogElement,
  target: DialogLifecycleOptions['initialFocus'],
): HTMLElement | null {
  if (typeof target === 'function') return target();
  if (typeof target === 'string') return dialog.querySelector<HTMLElement>(target);
  return target ?? dialog.querySelector<HTMLElement>(focusableSelector);
}

export function createDialogLifecycle(options: DialogLifecycleOptions): DialogLifecycle {
  const { dialog, requestDismiss } = options;
  let opener: HTMLElement | null = null;
  let previousBodyOverflow = '';
  let pageLocked = false;

  const restorePage = () => {
    if (!pageLocked || dialog.open) return;
    pageLocked = false;
    document.body.style.overflow = previousBodyOverflow;
    if (opener?.isConnected) opener.focus();
    opener = null;
  };

  const onCancel = (event: Event) => {
    event.preventDefault();
    requestDismiss('escape');
  };

  const onClick = (event: MouseEvent) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    const outside =
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom;
    if (outside) requestDismiss('backdrop');
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter(
      (element) =>
        (element.tabIndex >= 0 || element.isContentEditable) &&
        !element.matches(':disabled') &&
        !element.closest('[inert]') &&
        getComputedStyle(element).visibility !== 'hidden' &&
        element.getClientRects().length > 0,
    );
    if (focusable.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  dialog.addEventListener('cancel', onCancel);
  dialog.addEventListener('click', onClick);
  dialog.addEventListener('keydown', onKeyDown);
  dialog.addEventListener('close', restorePage);

  return {
    open(nextOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null) {
      if (dialog.open) return;
      dialog.showModal();
      opener = nextOpener;
      previousBodyOverflow = document.body.style.overflow;
      pageLocked = true;
      document.body.style.overflow = 'hidden';
      (resolveInitialFocus(dialog, options.initialFocus) ?? dialog).focus();
    },
    close() {
      if (!dialog.open) return;
      dialog.close();
      restorePage();
    },
    destroy() {
      if (dialog.open) {
        dialog.close();
        restorePage();
      }
      dialog.removeEventListener('cancel', onCancel);
      dialog.removeEventListener('click', onClick);
      dialog.removeEventListener('keydown', onKeyDown);
      dialog.removeEventListener('close', restorePage);
    },
  };
}
