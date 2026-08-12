import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import { $isLinkNode, $toggleLink, LinkNode } from '@lexical/link';
import { registerRichText } from '@lexical/rich-text';
import { $forEachSelectedTextNode } from '@lexical/selection';
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  COMMAND_PRIORITY_HIGH,
  createEditor,
  FORMAT_TEXT_COMMAND,
  IS_BOLD,
  IS_ITALIC,
  IS_STRIKETHROUGH,
  IS_UNDERLINE,
  KEY_ENTER_COMMAND,
  TextNode,
  type LexicalEditor,
  type LexicalNode,
  type RangeSelection,
  type TextFormatType,
} from 'lexical';
import { createDropdownHydrator } from '../shared/dropdownToggle';

const EXTERNAL_SYNC_TAG = 'clickeen-dropdown-edit-external-sync';
const SUPPORTED_TEXT_FORMAT = IS_BOLD | IS_ITALIC | IS_UNDERLINE | IS_STRIKETHROUGH;
const states = new Map<HTMLElement, DropdownEditState>();

const Command = {
  Bold: 'bold',
  Italic: 'italic',
  Underline: 'underline',
  Strike: 'strike',
  Link: 'link',
  ClearFormat: 'clear-format',
} as const;

type Command = (typeof Command)[keyof typeof Command];

interface DropdownEditState {
  root: HTMLElement;
  control: HTMLElement;
  popover: HTMLElement;
  editorElement: HTMLElement;
  editor: LexicalEditor;
  headerValue: HTMLElement;
  headerValueLabel: HTMLElement;
  hiddenInput: HTMLInputElement;
  paletteButtons: Map<Command, HTMLButtonElement>;
  linkSheet: HTMLElement;
  linkPopover: HTMLElement;
  linkActionButton: HTMLButtonElement;
  linkMode: 'add' | 'remove';
  savedLinkSelection: RangeSelection | null;
  pendingExternal?: string;
}

const hydrateHost = createDropdownHydrator({
  rootSelector: '.diet-dropdown-edit',
  triggerSelector: '.diet-dropdown-edit__control',
  popoverSelector: ':scope > .diet-popover',
  onOpen: (root) => {
    const state = states.get(root);
    state?.editor.focus();
  },
  onClose: (root) => {
    const state = states.get(root);
    if (!state) return;
    closeLinkSheet(state);
    if (state.pendingExternal !== undefined) {
      applyExternalValue(state, state.pendingExternal);
      state.pendingExternal = undefined;
    }
  },
});

export function hydrateDropdownEdit(scope: Element | DocumentFragment): void {
  scope.querySelectorAll<HTMLElement>('.diet-dropdown-edit').forEach((root) => {
    if (states.has(root)) return;
    const state = createState(root);
    states.set(root, state);
    installHandlers(state);
    applyExternalValue(state, state.hiddenInput.value);
    state.hiddenInput.addEventListener('external-sync', (event) => {
      const value = (event as CustomEvent<{ value: string }>).detail.value;
      if (state.root.dataset.state === 'open') {
        state.pendingExternal = value;
        return;
      }
      applyExternalValue(state, value);
    });
  });

  hydrateHost(scope);
}

export function destroyDropdownEdit(root: HTMLElement): void {
  const state = states.get(root);
  state?.editor.setRootElement(null);
  states.delete(root);
  hydrateHost.destroy(root);
}

function createState(root: HTMLElement): DropdownEditState {
  const control = root.querySelector<HTMLElement>('.diet-dropdown-edit__control')!;
  const popover = root.querySelector<HTMLElement>(':scope > .diet-popover')!;
  const editorElement = root.querySelector<HTMLElement>('.diet-dropdown-edit__editor')!;
  const headerValue = root.querySelector<HTMLElement>('.diet-dropdown-header-value')!;
  const headerValueLabel = root.querySelector<HTMLElement>('.diet-dropdown-edit__label')!;
  const hiddenInput = root.querySelector<HTMLInputElement>('.diet-dropdown-edit__field')!;
  const palette = root.querySelector<HTMLElement>('.diet-dropdown-edit__palette')!;
  const linkSheet = root.querySelector<HTMLElement>('.diet-dropdown-edit__linksheet')!;
  const linkPopover = linkSheet.querySelector<HTMLElement>('.diet-popaddlink')!;
  const linkActionButton = linkPopover.querySelector<HTMLButtonElement>(
    '.diet-dropdown-edit__link-action',
  )!;
  const paletteButtons = new Map<Command, HTMLButtonElement>();
  palette.querySelectorAll<HTMLButtonElement>('button[data-command]').forEach((button) => {
    paletteButtons.set(button.dataset.command as Command, button);
  });

  const editor = createEditor({
    html: {
      export: new Map([[TextNode, exportInlineText]]),
    },
    namespace: 'clickeen-dropdown-edit',
    nodes: [LinkNode],
    theme: {
      text: {
        strikethrough: 'diet-dropdown-edit__text--strikethrough',
        underline: 'diet-dropdown-edit__text--underline',
        underlineStrikethrough: 'diet-dropdown-edit__text--underline-strikethrough',
      },
    },
    onError(error) {
      throw error;
    },
  });
  registerRichText(editor);
  editor.registerNodeTransform(TextNode, (textNode) => {
    const format = textNode.getFormat() & SUPPORTED_TEXT_FORMAT;
    if (textNode.getFormat() !== format) textNode.setFormat(format);
    if (textNode.getStyle()) textNode.setStyle('');
  });
  editor.registerCommand(
    KEY_ENTER_COMMAND,
    (event) => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return false;
      event?.preventDefault();
      selection.insertLineBreak(false);
      return true;
    },
    COMMAND_PRIORITY_HIGH,
  );
  editor.setRootElement(editorElement);

  return {
    root,
    control,
    popover,
    editorElement,
    editor,
    headerValue,
    headerValueLabel,
    hiddenInput,
    paletteButtons,
    linkSheet,
    linkPopover,
    linkActionButton,
    linkMode: 'add',
    savedLinkSelection: null,
  };
}

function installHandlers(state: DropdownEditState): void {
  const { editor, editorElement, linkPopover, paletteButtons } = state;

  paletteButtons.forEach((button, command) => {
    button.addEventListener('pointerdown', (event) => event.preventDefault());
    button.addEventListener('click', () => handleCommand(state, command));
  });

  linkPopover.addEventListener('popaddlink:submit', (event) => {
    if (state.linkMode === 'remove') {
      removeLink(state);
      return;
    }
    const href = (event as CustomEvent<{ href: string }>).detail.href;
    applyLink(state, href);
  });
  linkPopover.addEventListener('popaddlink:cancel', () => closeLinkSheet(state));
  state.root.addEventListener('diet-dropdown-edit:close-linksheet', () => closeLinkSheet(state));

  editor.registerUpdateListener(({ dirtyElements, dirtyLeaves, tags }) => {
    updateToolbar(state);
    if (tags.has(EXTERNAL_SYNC_TAG) || (dirtyElements.size === 0 && dirtyLeaves.size === 0)) {
      return;
    }
    commitValue(state, exportInline(editor));
  });

  editorElement.addEventListener('focus', () => updateToolbar(state));
}

function handleCommand(state: DropdownEditState, command: Command): void {
  const formatByCommand: Partial<Record<Command, TextFormatType>> = {
    [Command.Bold]: 'bold',
    [Command.Italic]: 'italic',
    [Command.Underline]: 'underline',
    [Command.Strike]: 'strikethrough',
  };
  const format = formatByCommand[command];
  if (format) {
    state.editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
    return;
  }
  if (command === Command.Link) {
    openLinkSheet(state);
    return;
  }
  if (command === Command.ClearFormat) {
    state.editor.update(
      () => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || selection.isCollapsed()) return;
        $forEachSelectedTextNode((textNode) => {
          textNode.setFormat(0);
          textNode.setStyle('');
        });
      },
      { discrete: true },
    );
  }
}

function updateToolbar(state: DropdownEditState): void {
  state.editor.read(() => {
    const selection = $getSelection();
    const rangeSelection = $isRangeSelection(selection) ? selection : null;
    const selectedLink = rangeSelection ? $findSelectedLink(rangeSelection) : null;
    const hasSelectedText = Boolean(rangeSelection && !rangeSelection.isCollapsed());
    const formatByCommand: Partial<Record<Command, TextFormatType>> = {
      [Command.Bold]: 'bold',
      [Command.Italic]: 'italic',
      [Command.Underline]: 'underline',
      [Command.Strike]: 'strikethrough',
    };

    state.paletteButtons.forEach((button, command) => {
      const format = formatByCommand[command];
      if (format) {
        const active = Boolean(rangeSelection?.hasFormat(format));
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      }
    });

    const linkButton = state.paletteButtons.get(Command.Link);
    if (linkButton) {
      linkButton.disabled = !hasSelectedText && !selectedLink;
      linkButton.classList.toggle('is-active', Boolean(selectedLink));
      linkButton.setAttribute('aria-pressed', selectedLink ? 'true' : 'false');
    }
    const clearButton = state.paletteButtons.get(Command.ClearFormat);
    if (clearButton) clearButton.disabled = !hasSelectedText;
  });
}

function openLinkSheet(state: DropdownEditState): void {
  let href = '';
  let selection: RangeSelection | null = null;
  state.editor.read(() => {
    const current = $getSelection();
    if (!$isRangeSelection(current)) return;
    const selectedLink = $findSelectedLink(current);
    if (current.isCollapsed() && !selectedLink) return;
    selection = current.clone();
    href = selectedLink?.getURL() ?? '';
  });
  if (!selection) return;

  state.savedLinkSelection = selection;
  const input = state.linkPopover.querySelector<HTMLInputElement>('.diet-popaddlink__input')!;
  const hasLink = href.length > 0;
  state.linkMode = hasLink ? 'remove' : 'add';
  state.linkActionButton.dataset.type = hasLink ? 'secondary' : 'primary';
  state.linkActionButton.querySelector<HTMLElement>('.diet-button__label')!.textContent = hasLink
    ? state.linkActionButton.dataset.removeLabel!
    : state.linkActionButton.dataset.addLabel!;
  input.value = href;
  input.readOnly = hasLink;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  state.root.classList.add('has-linksheet');
  state.linkSheet.setAttribute('aria-hidden', 'false');
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}

function applyLink(state: DropdownEditState, href: string): void {
  const selection = state.savedLinkSelection;
  if (!selection) return;
  state.editor.update(
    () => {
      $setSelection(selection.clone());
      $toggleLink(href, { rel: null });
    },
    { discrete: true },
  );
  closeLinkSheet(state);
  state.editor.focus();
}

function removeLink(state: DropdownEditState): void {
  const selection = state.savedLinkSelection;
  if (!selection) return;
  state.editor.update(
    () => {
      $setSelection(selection.clone());
      $toggleLink(null);
    },
    { discrete: true },
  );
  closeLinkSheet(state);
  state.editor.focus();
}

function closeLinkSheet(state: DropdownEditState): void {
  state.root.classList.remove('has-linksheet');
  state.linkSheet.setAttribute('aria-hidden', 'true');
  state.savedLinkSelection = null;
}

function $findSelectedLink(selection: RangeSelection): LinkNode | null {
  let node: LexicalNode | null = selection.anchor.getNode();
  while (node) {
    if ($isLinkNode(node)) return node;
    node = node.getParent();
  }
  return null;
}

function applyExternalValue(state: DropdownEditState, value: string): void {
  state.editor.update(
    () => {
      const parsed = new DOMParser().parseFromString(`<p>${value}</p>`, 'text/html');
      const nodes = $generateNodesFromDOM(state.editor, parsed);
      const root = $getRoot();
      root.clear();
      root.append(...nodes);
    },
    { discrete: true, tag: EXTERNAL_SYNC_TAG },
  );
  state.hiddenInput.value = value;
  updatePreview(state, value);
  updateToolbar(state);
}

function commitValue(state: DropdownEditState, value: string): void {
  state.hiddenInput.value = value;
  updatePreview(state, value);
  state.hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
}

function updatePreview(state: DropdownEditState, value: string): void {
  const body = new DOMParser().parseFromString(value, 'text/html').body;
  body.querySelectorAll('br').forEach((lineBreak) => lineBreak.replaceWith(' '));
  const preview = body.textContent!.replace(/\s+/g, ' ').trim();
  const hasValue = value.length > 0;
  state.headerValue.dataset.muted = hasValue ? 'false' : 'true';
  state.headerValueLabel.textContent = hasValue
    ? preview
    : state.headerValue.dataset.placeholder!;
}

function exportInline(editor: LexicalEditor): string {
  return editor.read(() => {
    const root = $getRoot();
    if (root.getTextContent() === '') return '';
    const html = $generateHtmlFromNodes(editor, null);
    const body = new DOMParser().parseFromString(html, 'text/html').body;
    return Array.from(body.children)
      .map((block) => (block.innerHTML === '<br>' ? '' : block.innerHTML))
      .join('<br>');
  });
}

function exportInlineText(_editor: LexicalEditor, target: LexicalNode) {
  const textNode = target as TextNode;
  let element: Text | HTMLElement = document.createTextNode(textNode.getTextContent());
  for (const [format, tagName] of [
    ['bold', 'strong'],
    ['italic', 'em'],
    ['underline', 'u'],
    ['strikethrough', 's'],
  ] as const) {
    if (!textNode.hasFormat(format)) continue;
    const wrapper = document.createElement(tagName);
    wrapper.append(element);
    element = wrapper;
  }
  return { element };
}
