const enum Command {
  Bold = 'bold',
  Italic = 'italic',
  Underline = 'underline',
  Strike = 'strike',
  Link = 'link',
  ClearFormat = 'clear-format',
  ClearLinks = 'clear-links',
}

type LinkValidity = 'empty' | 'valid' | 'invalid';

interface LinkState {
  url: string;
  newTab: boolean;
  noFollow: boolean;
}

interface TexteditState {
  root: HTMLElement;
  control: HTMLElement;
  popover: HTMLElement;
  editor: HTMLElement;
  preview: HTMLElement;
  previewText: HTMLElement;
  hiddenInput: HTMLInputElement;
  allowLinks: boolean;

  palette: HTMLElement;
  paletteButtons: Map<Command, HTMLButtonElement>;
  paletteLinkButton: HTMLButtonElement | null;
  hasInteracted: boolean;
  pointerDown: boolean;
  linkForm: HTMLElement;
  linkTitle: HTMLElement;
  linkInput: HTMLInputElement;
  linkNewTab: HTMLInputElement;
  linkNoFollow: HTMLInputElement;
  linkApply: HTMLButtonElement;
  linkRemove: HTMLButtonElement;
  initialLink: LinkState | null;
  linkSnippet: string;
  linkValidity: LinkValidity;

  selection: Range | null;
  activeAnchor: HTMLAnchorElement | null;
  tempMarker: HTMLElement | null;
  clearFormatButton: HTMLButtonElement;
  clearLinksButton: HTMLButtonElement;
  toolbarDivider: HTMLElement;
}

export { Command };
export type { LinkState, LinkValidity, TexteditState };
