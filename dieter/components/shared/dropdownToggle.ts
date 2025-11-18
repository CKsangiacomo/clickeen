export type DropdownHydrateConfig = {
  rootSelector: string;
  triggerSelector: string;
  popoverSelector?: string;
  initialState?: 'open' | 'closed';
  onOpen?: (root: HTMLElement, popover: HTMLElement, trigger: HTMLElement) => void;
  onClose?: (root: HTMLElement, popover: HTMLElement, trigger: HTMLElement) => void;
};

type HostRecord = {
  root: HTMLElement;
  trigger: HTMLElement;
  popover: HTMLElement;
  onOpen?: (root: HTMLElement, popover: HTMLElement, trigger: HTMLElement) => void;
  onClose?: (root: HTMLElement, popover: HTMLElement, trigger: HTMLElement) => void;
};

export function createDropdownHydrator(config: DropdownHydrateConfig) {
  const {
    rootSelector,
    triggerSelector,
    popoverSelector = '.diet-popover',
    onOpen,
    onClose,
    initialState = 'closed',
  } = config;
  const hostRegistry = new Map<HTMLElement, HostRecord>();
  let globalHandlersBound = false;

  const setOpen = (record: HostRecord, open: boolean) => {
    const { root, trigger, popover } = record;
    const next = open ? 'open' : 'closed';
    if (root.dataset.state === next) return;
    root.dataset.state = next;
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      record.onOpen?.(root, popover, trigger);
    } else {
      record.onClose?.(root, popover, trigger);
    }
  };

  return function hydrate(scope: Element | DocumentFragment): void {
    const roots = Array.from(scope.querySelectorAll<HTMLElement>(rootSelector));
    if (!roots.length) return;

    roots.forEach((root) => {
      if (hostRegistry.has(root)) return;

      const trigger = root.querySelector<HTMLElement>(triggerSelector);
      const popover = root.querySelector<HTMLElement>(popoverSelector);
      if (!trigger || !popover) return;

      const record: HostRecord = { root, trigger, popover, onOpen, onClose };
      hostRegistry.set(root, record);

      trigger.addEventListener('click', (event) => {
        event.stopPropagation();
        setOpen(record, root.dataset.state !== 'open');
      });

      const requestedState = root.dataset.state || initialState;
      setOpen(record, requestedState === 'open');
    });

    if (!globalHandlersBound) {
      globalHandlersBound = true;

      document.addEventListener(
        'pointerdown',
        (event) => {
          const target = event.target as Node | null;
          if (!target) return;

          hostRegistry.forEach((record) => {
            const { root } = record;
            if (!root.contains(target) && root.dataset.state === 'open') {
              setOpen(record, false);
            }
          });
        },
        true,
      );

      document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        hostRegistry.forEach((record) => {
          const { root } = record;
          if (root.dataset.state === 'open') setOpen(record, false);
        });
      });
    }
  };
}
