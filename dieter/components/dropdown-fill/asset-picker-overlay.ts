export type AssetPickerOverlayItem = {
  assetId: string;
  normalizedFilename: string;
  contentType: string;
  sizeLabel: string;
  usageCount: number;
  url: string;
};

type AssetPickerOverlayCallbacks = {
  onUse: (item: AssetPickerOverlayItem) => void;
  onOpenChange?: (open: boolean) => void;
};

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export class AssetPickerOverlay {
  private readonly root: HTMLDivElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly messageEl: HTMLElement;
  private readonly rowsEl: HTMLElement;
  private readonly callbacks: AssetPickerOverlayCallbacks;
  private anchor: HTMLElement | null = null;
  private openState = false;
  private readonly handleDocumentPointerDown: (event: PointerEvent) => void;
  private readonly handleDocumentKeydown: (event: KeyboardEvent) => void;
  private readonly handleViewportChange: () => void;

  constructor(callbacks: AssetPickerOverlayCallbacks) {
    this.callbacks = callbacks;
    this.root = document.createElement('div');
    this.root.className = 'diet-popover diet-dropdown-fill__asset-picker diet-dropdown-fill__asset-picker-portal';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', 'Choose from assets');
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="diet-popover__header">
        <span class="diet-popover__header-label label-s">Choose from assets</span>
        <button
          type="button"
          class="diet-btn-ic diet-popover__header-trigger diet-dropdown-fill__asset-picker-close"
          data-size="sm"
          data-variant="neutral"
          aria-label="Close assets list"
        >
          <span class="diet-btn-ic__icon" aria-hidden="true" data-icon="multiply"></span>
        </button>
      </div>
      <div class="diet-popover__body">
        <p class="diet-dropdown-fill__asset-picker-message body-s" data-role="asset-picker-message"></p>
        <div class="diet-dropdown-fill__asset-picker-tablewrap">
          <table class="diet-dropdown-fill__asset-picker-table">
            <thead>
              <tr>
                <th class="label-s">Asset</th>
                <th class="label-s">Type</th>
                <th class="label-s">Size</th>
                <th class="label-s">Usage</th>
                <th class="label-s">Action</th>
              </tr>
            </thead>
            <tbody data-role="asset-picker-rows"></tbody>
          </table>
        </div>
      </div>
    `;

    const closeButton = this.root.querySelector<HTMLButtonElement>('.diet-dropdown-fill__asset-picker-close');
    const messageEl = this.root.querySelector<HTMLElement>('[data-role="asset-picker-message"]');
    const rowsEl = this.root.querySelector<HTMLElement>('[data-role="asset-picker-rows"]');
    if (!closeButton || !messageEl || !rowsEl) {
      throw new Error('[dropdown-fill] asset picker overlay missing DOM nodes');
    }
    this.closeButton = closeButton;
    this.messageEl = messageEl;
    this.rowsEl = rowsEl;

    this.handleDocumentPointerDown = (event: PointerEvent) => {
      if (!this.openState) return;
      const target = event.target as Node | null;
      if (!target) return;
      if (this.root.contains(target)) return;
      if (this.anchor?.contains(target)) return;
      this.close();
    };
    this.handleDocumentKeydown = (event: KeyboardEvent) => {
      if (!this.openState) return;
      if (event.key !== 'Escape') return;
      this.close();
    };
    this.handleViewportChange = () => {
      if (!this.openState) return;
      this.position();
    };

    document.body.appendChild(this.root);
    this.bindStaticHandlers();
  }

  private bindStaticHandlers(): void {
    this.closeButton.addEventListener('click', (event) => {
      event.preventDefault();
      this.close();
    });
  }

  private bindOpenHandlers(): void {
    document.addEventListener('pointerdown', this.handleDocumentPointerDown, true);
    document.addEventListener('keydown', this.handleDocumentKeydown);
    window.addEventListener('resize', this.handleViewportChange);
    window.addEventListener('scroll', this.handleViewportChange, true);
  }

  private unbindOpenHandlers(): void {
    document.removeEventListener('pointerdown', this.handleDocumentPointerDown, true);
    document.removeEventListener('keydown', this.handleDocumentKeydown);
    window.removeEventListener('resize', this.handleViewportChange);
    window.removeEventListener('scroll', this.handleViewportChange, true);
  }

  private position(): void {
    if (!this.openState) return;
    if (!this.anchor?.isConnected) {
      this.close();
      return;
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 12;
    const gap = 8;
    const maxWidth = Math.max(260, viewportWidth - margin * 2);
    const width = Math.min(480, maxWidth);

    this.root.style.inlineSize = `${Math.round(width)}px`;

    const anchorRect = this.anchor.getBoundingClientRect();
    let left = anchorRect.left;
    left = clampNumber(left, margin, Math.max(margin, viewportWidth - width - margin));

    let top = anchorRect.bottom + gap;
    const currentHeight = this.root.getBoundingClientRect().height || 320;
    const minBelowSpace = 220;
    if (viewportHeight - top - margin < minBelowSpace) {
      top = Math.max(margin, anchorRect.top - gap - currentHeight);
    }

    const maxBlockSize = Math.max(180, viewportHeight - top - margin);
    this.root.style.insetInlineStart = `${Math.round(left)}px`;
    this.root.style.insetBlockStart = `${Math.round(top)}px`;
    this.root.style.maxBlockSize = `${Math.round(maxBlockSize)}px`;
  }

  isOpen(): boolean {
    return this.openState;
  }

  open(anchor: HTMLElement): void {
    this.anchor = anchor;
    if (this.openState) {
      this.position();
      return;
    }
    this.openState = true;
    this.bindOpenHandlers();
    this.root.hidden = false;
    this.callbacks.onOpenChange?.(true);
    this.position();
    requestAnimationFrame(() => this.position());
  }

  close(): void {
    if (!this.openState) return;
    this.openState = false;
    this.unbindOpenHandlers();
    this.root.hidden = true;
    this.callbacks.onOpenChange?.(false);
  }

  contains(target: Node): boolean {
    return this.root.contains(target);
  }

  setMessage(message: string): void {
    this.messageEl.textContent = message;
  }

  setRows(items: AssetPickerOverlayItem[]): void {
    this.rowsEl.innerHTML = '';
    if (!items.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 5;
      td.className = 'body-s';
      td.textContent = 'No image assets found.';
      tr.appendChild(td);
      this.rowsEl.appendChild(tr);
      return;
    }

    items.forEach((item) => {
      const tr = document.createElement('tr');

      const nameCell = document.createElement('td');
      nameCell.className = 'body-s';
      nameCell.textContent = item.normalizedFilename;
      tr.appendChild(nameCell);

      const typeCell = document.createElement('td');
      typeCell.className = 'body-s';
      typeCell.textContent = item.contentType;
      tr.appendChild(typeCell);

      const sizeCell = document.createElement('td');
      sizeCell.className = 'body-s';
      sizeCell.textContent = item.sizeLabel;
      tr.appendChild(sizeCell);

      const usageCell = document.createElement('td');
      usageCell.className = 'body-s';
      usageCell.textContent = String(item.usageCount);
      tr.appendChild(usageCell);

      const actionCell = document.createElement('td');
      const useButton = document.createElement('button');
      useButton.type = 'button';
      useButton.className = 'diet-btn-txt diet-dropdown-fill__asset-picker-use';
      useButton.setAttribute('data-size', 'sm');
      useButton.setAttribute('data-variant', 'line1');
      useButton.innerHTML = '<span class="diet-btn-txt__label body-s">Use</span>';
      useButton.addEventListener('click', (event) => {
        event.preventDefault();
        this.callbacks.onUse(item);
        this.close();
      });
      actionCell.appendChild(useButton);
      tr.appendChild(actionCell);

      this.rowsEl.appendChild(tr);
    });
  }

  destroy(): void {
    this.unbindOpenHandlers();
    this.close();
    this.root.remove();
  }
}
