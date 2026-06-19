import type { CompiledControl } from '../types';

function normalizeCopilotAlias(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function labelFromPath(path: string): string {
  const last = path.split('.').filter(Boolean).pop() || path;
  return last
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
}

function humanizeChoiceLabel(input: string): string {
  const normalized = input
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  if (!normalized) return '';
  return normalized
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLowerCase();
      if (lower === 'cta') return 'CTA';
      if (lower === 'faq') return 'FAQ';
      return lower.slice(0, 1).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

function choiceLabelFromPath(path: string): string {
  if (!path) return '';

  const typographyRole = path.match(/^typography\.roles\.([^.]+)\./);
  if (typographyRole?.[1]) return humanizeChoiceLabel(typographyRole[1]);
  if (path === 'typography.globalFamily') return 'Global typography';

  if (path === 'headerCta.enabled') return 'Header CTA visibility';
  if (path === 'headerCta.label') return 'Header CTA label';
  if (path.endsWith('.action.enabled')) return 'Action button visibility';
  if (path.endsWith('.action.label')) return 'Action button label';
  if (path.startsWith('countdown.actions.during.')) return 'Countdown action';
  if (path.startsWith('countdown.actions.after.')) return 'Finished action';

  if (path.startsWith('localeSwitcher.') || path.startsWith('appearance.localeSwitcher')) return 'Locale switcher';
  if (path.startsWith('behavior.socialShare.')) return 'Social share';
  if (path.startsWith('behavior.showBacklink')) return 'Made with Clickeen';

  if (path.startsWith('headerCta.') || path.startsWith('appearance.headerCta.') || path === 'header.ctaPlacement') {
    return 'Header CTA';
  }
  if (path.startsWith('header.')) return 'Header';
  if (path.startsWith('stage.')) return 'Stage';
  if (path.startsWith('pod.')) return 'Pod';

  return '';
}

function choiceLabelForControl(control: CompiledControl, label: string): string {
  const path = control.path || '';
  const text = `${label} ${control.groupLabel || ''}`.toLowerCase();
  const pathChoiceLabel = choiceLabelFromPath(path);
  if (pathChoiceLabel) return pathChoiceLabel;
  if (path.includes('.action.') || /\baction\b/.test(text)) {
    return 'Action button';
  }
  if (text.includes('stage') && text.includes('pod')) return 'Stage/Pod appearance';
  return humanizeChoiceLabel(control.groupLabel || label);
}

export function buildCopilotVocabulary(
  control: CompiledControl,
): Pick<CompiledControl, 'copilotAliases' | 'copilotAmbiguityGroup' | 'copilotChoiceLabel'> {
  const label = control.label || labelFromPath(control.path);
  const baseAliases = [label];
  const labelText = `${label} ${control.groupLabel || ''}`.toLowerCase();
  const labelOnly = label.toLowerCase().trim();
  const isVisibilityToggle = /^(show|hide|enable|disable)\b/.test(labelText);
  const isCtaLabelControl =
    /(^|\.)label$/.test(control.path) || /\b(cta|button|action) label\b/.test(labelOnly);
  const roleAliases: string[] = [];
  if (isVisibilityToggle && /\b(cta|button|action)\b/.test(labelText)) {
    roleAliases.push('button', 'cta');
  }
  if (!isVisibilityToggle && isCtaLabelControl && /\b(cta|button|action)\b/.test(labelText)) {
    roleAliases.push('button', 'cta');
  }
  if (!isVisibilityToggle && /^(title|headline|heading)$/.test(labelOnly)) roleAliases.push('title', 'headline');
  if (!isVisibilityToggle && /^(subtitle|subheading)$/.test(labelOnly)) roleAliases.push('subtitle');
  if (!isVisibilityToggle && /\bbackground\b/.test(labelText)) roleAliases.push('background');
  if (!isVisibilityToggle && /\b(share|social)\b/.test(labelText)) roleAliases.push('social share', 'share');
  if (!isVisibilityToggle && /\b(branding|made with clickeen)\b/.test(labelText)) roleAliases.push('made with clickeen', 'branding');

  const aliases = Array.from(new Set([...baseAliases, ...roleAliases].map(normalizeCopilotAlias).filter(Boolean)));
  const exactLabelAmbiguityGroup = labelOnly ? `label:${normalizeCopilotAlias(labelOnly)}` : undefined;
  const visibilityAmbiguityGroup = isVisibilityToggle ? `visibility:${normalizeCopilotAlias(labelOnly)}` : undefined;

  let shellAmbiguityGroup: string | undefined;
  if (labelOnly === 'size') shellAmbiguityGroup = 'size';
  else if (/\bfont family\b/.test(labelText)) shellAmbiguityGroup = 'font-family';
  else if (/\bfont size\b/.test(labelText) || (/\bsize\b/.test(labelOnly) && control.path.startsWith('typography.'))) {
    shellAmbiguityGroup = 'font-size';
  } else if (/\btext color\b/.test(labelText)) shellAmbiguityGroup = 'text-color';
  else if (labelOnly === 'border') shellAmbiguityGroup = 'border';
  else if (/\b(corner radius|radius)\b/.test(labelOnly)) shellAmbiguityGroup = 'radius';
  else if (/\bpadding\b/.test(labelOnly)) shellAmbiguityGroup = 'padding';
  else if (labelOnly === 'position') shellAmbiguityGroup = 'position';
  else if (labelOnly === 'open link in') shellAmbiguityGroup = 'open-link';
  else if (labelOnly === 'icon' || labelOnly.startsWith('icon ')) {
    shellAmbiguityGroup = `icon:${normalizeCopilotAlias(labelOnly)}`;
  } else if (labelOnly === 'color' && control.path.startsWith('typography.')) {
    shellAmbiguityGroup = 'font-color';
  } else if (
    /\b(line height|line spacing|letter spacing|font weight|font style)\b/.test(labelText) ||
    (['style', 'weight'].includes(labelOnly) && control.path.startsWith('typography.'))
  ) {
    shellAmbiguityGroup = 'typography';
  }

  const ambiguityGroup = shellAmbiguityGroup
    ? shellAmbiguityGroup
    : roleAliases.includes('background')
      ? 'background'
    : roleAliases.includes('button')
    ? 'button'
      : roleAliases.includes('title')
        ? 'title'
        : visibilityAmbiguityGroup
          ? visibilityAmbiguityGroup
          : exactLabelAmbiguityGroup
            ? exactLabelAmbiguityGroup
            : undefined;
  return {
    copilotAliases: aliases,
    copilotChoiceLabel: choiceLabelForControl(control, label),
    ...(ambiguityGroup ? { copilotAmbiguityGroup: ambiguityGroup } : {}),
  };
}

export function validateCopilotVocabulary(controls: CompiledControl[]): void {
  const aliases = new Map<string, CompiledControl>();
  controls.forEach((control) => {
    for (const alias of control.copilotAliases ?? []) {
      const existing = aliases.get(alias);
      if (!existing) {
        aliases.set(alias, control);
        continue;
      }
      if (existing.path === control.path) continue;
      if (existing.copilotAmbiguityGroup && existing.copilotAmbiguityGroup === control.copilotAmbiguityGroup) continue;
      throw new Error(
        `[BobCompiler] Copilot alias collision "${alias}" between "${existing.path}" and "${control.path}" requires a shared ambiguity group`,
      );
    }
  });
}
