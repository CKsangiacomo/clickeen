export type DropdownHydrateConfig = {
  rootSelector: string;
  triggerSelector: string;
  popoverSelector?: string;
  initialState?: 'open' | 'closed';
  onOpen?: (root: HTMLElement, popover: HTMLElement, trigger: HTMLElement) => void;
  onClose?: (root: HTMLElement, popover: HTMLElement, trigger: HTMLElement) => void;
  isInsideTarget?: (root: HTMLElement, target: Node) => boolean;
};

type HostRecord = {
  root: HTMLElement;
  trigger: HTMLElement;
  popover: HTMLElement;
  onOpen?: (root: HTMLElement, popover: HTMLElement, trigger: HTMLElement) => void;
  onClose?: (root: HTMLElement, popover: HTMLElement, trigger: HTMLElement) => void;
};

function syncPopoverGeometry(record: HostRecord): void {
  const { popover, root } = record;
  const width = popover.dataset.width;
  if (width !== 'wide' && width !== 'extra-wide') return;

  const rect = root.getBoundingClientRect();
  const extension = width === 'wide' ? 40 : 80;
  popover.style.setProperty('--popover-fixed-left', `${rect.left}px`);
  popover.style.setProperty('--popover-fixed-top', `${rect.top}px`);
  popover.style.setProperty('--popover-fixed-width', `${rect.width + extension}px`);
}

export type DropdownHydrator = {
  (scope: Element | DocumentFragment): void;
  setOpen: (root: HTMLElement, open: boolean) => void;
  destroy: (root: HTMLElement) => void;
};

export function createDropdownHydrator(config: DropdownHydrateConfig): DropdownHydrator {
  const {
    rootSelector,
    triggerSelector,
    popoverSelector = '.diet-popover',
    onOpen,
    onClose,
    initialState = 'closed',
    isInsideTarget,
  } = config;
  const hostRegistry = new Map<HTMLElement, HostRecord>();
  let globalHandlersBound = false;

  const setOpen = (record: HostRecord, open: boolean) => {
    const { root, trigger, popover } = record;
    const next = open ? 'open' : 'closed';
    if (root.dataset.state === next) {
      if (open) syncPopoverGeometry(record);
      return;
    }
    root.dataset.state = next;
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      syncPopoverGeometry(record);
      record.onOpen?.(root, popover, trigger);
    } else {
      record.onClose?.(root, popover, trigger);
      trigger.focus();
    }
  };

  const hydrate = (scope: Element | DocumentFragment): void => {
    const roots = Array.from(scope.querySelectorAll<HTMLElement>(rootSelector));
    if (!roots.length) return;

    roots.forEach((root) => {
      const existingRecord = hostRegistry.get(root);
      if (existingRecord) {
        if (root.dataset.state === 'open') syncPopoverGeometry(existingRecord);
        return;
      }

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
            const insideRoot = root.contains(target);
            const insideExtraTarget = isInsideTarget?.(root, target) ?? false;
            if (!insideRoot && !insideExtraTarget && root.dataset.state === 'open') {
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

      const syncOpenPopovers = () => {
        hostRegistry.forEach((record) => {
          if (record.root.dataset.state === 'open') syncPopoverGeometry(record);
        });
      };
      document.addEventListener('scroll', syncOpenPopovers, true);
      window.addEventListener('resize', syncOpenPopovers);
    }
  };

  hydrate.setOpen = (root: HTMLElement, open: boolean) => {
    const record = hostRegistry.get(root);
    if (record) setOpen(record, open);
  };

  hydrate.destroy = (root: HTMLElement) => {
    hostRegistry.delete(root);
  };

  return hydrate;
}
