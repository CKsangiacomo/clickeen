import { Command, type TexteditState } from './textedit-types';

function buttonHTML(command: Command, icon: string): string {
  return `
    <button type="button" class="diet-btn-ic" data-size="sm" data-variant="neutral" data-command="${command}">
      <span class="diet-btn-ic__icon" data-icon="${icon}"></span>
    </button>
  `;
}

export function createState(root: HTMLElement): TexteditState {
  const allowLinksAttr = root.getAttribute('data-allow-links');
  const allowLinks =
    allowLinksAttr == null
      ? true
      : !['false', '0', 'no'].includes(allowLinksAttr.trim().toLowerCase());
  const control = root.querySelector<HTMLElement>('.diet-textedit__control');
  const popover = root.querySelector<HTMLElement>('.diet-popover');
  const editor = root.querySelector<HTMLElement>('.diet-textedit__editor');
  const preview = root.querySelector<HTMLElement>('.diet-textedit__preview');
  const previewText = root.querySelector<HTMLElement>('.diet-textedit__previewin');
  const hiddenInput = root.querySelector<HTMLInputElement>('.diet-textedit__field');

  if (!control || !popover || !editor || !preview || !previewText || !hiddenInput) {
    throw new Error('[textedit] missing DOM nodes');
  }

  const palette = document.createElement('div');
  palette.className = 'diet-textedit__palette is-hidden';
  palette.innerHTML = `
    <div class="diet-textedit__toolbarrow">
      <div class="diet-textedit__group diet-textedit__group--format">
        ${buttonHTML(Command.Bold, 'bold')}
        ${buttonHTML(Command.Italic, 'italic')}
        ${buttonHTML(Command.Underline, 'underline')}
        ${buttonHTML(Command.Strike, 'strikethrough')}
        ${buttonHTML(Command.Link, 'link')}
      </div>
      <span class="diet-textedit__divider is-hidden"></span>
      <div class="diet-textedit__group diet-textedit__group--clear">
        ${buttonHTML(Command.ClearFormat, 'arrow.counterclockwise')}
        ${buttonHTML(Command.ClearLinks, 'personalhotspot.slash')}
      </div>
    </div>
    <div class="diet-textedit__linkform is-hidden" data-validity="empty">
      <div class="diet-textedit__linkinner">
        <div class="diet-textedit__linkheader">
          <span class="diet-textedit__linktitle label">Link this text</span>
          <button type="button" class="diet-btn-txt diet-textedit__linkapply" data-size="xs" data-variant="primary"><span class="diet-btn-txt__label">Apply link</span></button>
        </div>
        <div class="diet-textfield" data-size="md">
          <label class="diet-textfield__control">
            <input type="text" class="diet-textfield__field diet-textedit__linkinput" placeholder="link url" />
          </label>
        </div>
        <div class="diet-textedit__linkoptions">
          <label class="diet-toggle diet-toggle--split" data-size="sm">
            <span class="diet-toggle__label label-small">Open link in a new tab</span>
            <input class="diet-toggle__input sr-only diet-textedit__linknewtab" type="checkbox" />
            <span class="diet-toggle__switch"><span class="diet-toggle__knob"></span></span>
          </label>
          <label class="diet-toggle diet-toggle--split" data-size="sm">
            <span class="diet-toggle__label label-small">Add \"no follow\" to link</span>
            <input class="diet-toggle__input sr-only diet-textedit__linknofollow" type="checkbox" />
            <span class="diet-toggle__switch"><span class="diet-toggle__knob"></span></span>
          </label>
        </div>
        <button type="button" class="diet-btn-txt diet-textedit__linkremove" data-size="xs" data-variant="secondary"><span class="diet-btn-txt__label">Remove link</span></button>
      </div>
    </div>
  `;
  popover.appendChild(palette);

  const iconButton = root.querySelector<HTMLSpanElement>('.diet-textedit__icon .diet-btn-ic');
  if (iconButton) {
    const iconSize = root.dataset.size === 'lg' ? 'sm' : 'xs';
    iconButton.setAttribute('data-size', iconSize);
  }

  const paletteButtons = new Map<Command, HTMLButtonElement>();
  palette.querySelectorAll<HTMLButtonElement>('button[data-command]').forEach((btn) => {
    paletteButtons.set(btn.dataset.command as Command, btn);
  });
  const paletteLinkButton = paletteButtons.get(Command.Link) ?? null;
  const clearFormatButton = paletteButtons.get(Command.ClearFormat);
  const clearLinksButton = paletteButtons.get(Command.ClearLinks);
  const toolbarDivider = palette.querySelector<HTMLElement>('.diet-textedit__divider');
  if (!clearFormatButton || !clearLinksButton || !toolbarDivider) {
    throw new Error('[textedit] missing clear buttons or divider');
  }
  const linkForm = palette.querySelector<HTMLElement>('.diet-textedit__linkform')!;
  const linkTitle = palette.querySelector<HTMLElement>('.diet-textedit__linktitle')!;
  const linkInput = palette.querySelector<HTMLInputElement>('.diet-textedit__linkinput')!;
  const linkNewTab = palette.querySelector<HTMLInputElement>('.diet-textedit__linknewtab')!;
  const linkNoFollow = palette.querySelector<HTMLInputElement>('.diet-textedit__linknofollow')!;
  const linkApply = palette.querySelector<HTMLButtonElement>('.diet-textedit__linkapply')!;
  const linkRemove = palette.querySelector<HTMLButtonElement>('.diet-textedit__linkremove')!;
  linkApply.disabled = true;
  linkRemove.style.display = 'none';

  if (!allowLinks) {
    const linkButton = paletteButtons.get(Command.Link);
    if (linkButton) linkButton.style.display = 'none';
    clearLinksButton.classList.add('is-hidden');
    linkForm.classList.add('is-hidden');
  }

  return {
    root,
    control,
    popover,
    editor,
    preview,
    previewText,
    hiddenInput,
    allowLinks,
    palette,
    paletteButtons,
    paletteLinkButton,
    hasInteracted: false,
    pointerDown: false,
    linkForm,
    linkTitle,
    linkInput,
    linkNewTab,
    linkNoFollow,
    linkApply,
    linkRemove,
    initialLink: null,
    linkSnippet: '',
    tempMarker: null,
    linkValidity: 'empty',
    clearFormatButton,
    clearLinksButton,
    toolbarDivider,
    selection: null,
    activeAnchor: null,
  };
}
