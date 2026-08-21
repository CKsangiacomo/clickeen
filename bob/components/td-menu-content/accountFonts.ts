'use client';

import {
  accountFontLibraryToFamilyOptions,
  type AccountFontFamilyOption,
  type AccountFontLibrary,
} from '@clickeen/widget-foundation';
import typographyCopy from '../../l10n/editor/typography/en.json';

function createTextSpan(document: Document, className: string, text: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  return span;
}

function createGroupLabel(document: Document, label: string): HTMLDivElement {
  const group = document.createElement('div');
  group.className = 'diet-dropdown-actions__group-label overline-small';
  group.setAttribute('role', 'presentation');
  group.textContent = label;
  return group;
}

function createMenuAction(args: {
  document: Document;
  option: AccountFontFamilyOption;
  currentValue: string;
  size: string;
}): HTMLButtonElement {
  const button = args.document.createElement('button');
  const value = args.option.value ?? '';
  const selected = value === args.currentValue;
  button.type = 'button';
  button.className = selected
    ? 'diet-btn-menuactions diet-dropdown-actions__menuaction is-selected'
    : 'diet-btn-menuactions diet-dropdown-actions__menuaction';
  button.dataset.size = args.size;
  button.dataset.value = value;
  button.dataset.label = args.option.label;
  if (args.option.weights) button.dataset.weights = args.option.weights;
  if (args.option.styles) button.dataset.styles = args.option.styles;
  button.setAttribute('role', 'option');
  if (selected) {
    button.setAttribute('aria-selected', 'true');
    button.dataset.selected = 'true';
  }

  const label = createTextSpan(args.document, 'diet-btn-menuactions__label', '');
  label.appendChild(createTextSpan(args.document, 'diet-dropdown-actions__menuaction-text', args.option.label));
  if (args.option.badge) {
    const badge = createTextSpan(args.document, 'diet-dropdown-actions__badge caption', args.option.badge);
    label.appendChild(badge);
  }
  button.appendChild(label);

  const check = createTextSpan(args.document, 'diet-dropdown-actions__check diet-icon', '');
  check.setAttribute('aria-hidden', 'true');
  check.dataset.icon = 'checkmark';
  button.appendChild(check);

  return button;
}

function installTypographyCapabilityFilter(args: {
  container: HTMLElement;
  targetSuffix: '.weight' | '.fontStyle';
  capability: 'weights' | 'styles';
}): void {
  const inputs = Array.from(
    args.container.querySelectorAll<HTMLInputElement>(
      `[data-bob-path^="typography.roles."][data-bob-path$="${args.targetSuffix}"]`,
    ),
  );

  inputs.forEach((input) => {
    const targetPath = input.dataset.bobPath!;
    const familyPath = targetPath.slice(0, -args.targetSuffix.length) + '.family';
    const familyInput = args.container.querySelector<HTMLInputElement>(
      `[data-bob-path="${familyPath}"]`,
    );
    const root = input.closest<HTMLElement>('.diet-dropdown-actions');
    const familyRoot = familyInput?.closest<HTMLElement>('.diet-dropdown-actions');
    const trigger = root?.querySelector<HTMLElement>('.diet-dropdown-actions__control');
    if (!familyInput || !familyRoot || !root || !trigger) return;

    const update = () => {
      const familyAction = Array.from(
        familyRoot.querySelectorAll<HTMLButtonElement>('.diet-dropdown-actions__menuaction'),
      ).find((action) => action.dataset.value === familyInput.value);
      const allowed = (familyAction?.dataset[args.capability] ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      if (allowed.length === 0) return;

      root.querySelectorAll<HTMLButtonElement>('.diet-dropdown-actions__menuaction').forEach((action) => {
        const isAllowed = allowed.includes(action.dataset.value ?? '');
        action.hidden = !isAllowed;
        action.disabled = !isAllowed;
      });
    };

    familyInput.addEventListener('input', update);
    trigger.addEventListener('click', update);
    update();
  });
}

export function applyAccountFontLibraryToTypographyMenus(args: {
  container: HTMLElement;
  fontLibrary: AccountFontLibrary | null;
}): void {
  if (!args.fontLibrary) return;
  const options = accountFontLibraryToFamilyOptions(args.fontLibrary, {
    categories: typographyCopy.fontCategories,
    usage: typographyCopy.fontUsage,
  });
  if (!options.length) return;

  const inputs = Array.from(
    args.container.querySelectorAll<HTMLInputElement>('[data-bob-path^="typography.roles."][data-bob-path$=".family"]'),
  );
  inputs.forEach((input) => {
    const root = input.closest<HTMLElement>('.diet-dropdown-actions');
    const menu = root?.querySelector<HTMLElement>('.diet-dropdown-actions__menu');
    if (!root || !menu) return;
    const currentValue = input.value || '';
    const size = root.dataset.size || 'md';
    const fragment = input.ownerDocument.createDocumentFragment();
    options.forEach((option) => {
      if (option.isGroupHeader) {
        fragment.appendChild(createGroupLabel(input.ownerDocument, option.label));
        return;
      }
      if (!option.value) return;
      fragment.appendChild(createMenuAction({ document: input.ownerDocument, option, currentValue, size }));
    });
    menu.replaceChildren(fragment);
  });

  installTypographyCapabilityFilter({
    container: args.container,
    targetSuffix: '.weight',
    capability: 'weights',
  });
  installTypographyCapabilityFilter({
    container: args.container,
    targetSuffix: '.fontStyle',
    capability: 'styles',
  });
}
