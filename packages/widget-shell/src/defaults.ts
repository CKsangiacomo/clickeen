import type { WidgetShellCoreLabels, WidgetShellCoreSize } from './contract';

export const DEFAULT_WIDGET_SHELL_CORE_SIZE: WidgetShellCoreSize = {
  mode: 'auto',
  fixedHeight: 0,
  minHeight: 0,
  preferredVw: 0,
  maxHeight: 0,
};

export const DEFAULT_WIDGET_SHELL_CORE_LABELS: WidgetShellCoreLabels = {
  singular: 'Content',
  plural: 'Content',
  sizeCluster: 'Content size',
};

export type WidgetShellHeaderDefaults = {
  enabled: boolean;
  title: string;
  showSubtitle: boolean;
  subtitleHtml: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
  alignment: 'left' | 'center' | 'right';
  gap: number;
  textGap: number;
  ctaPlacement: 'right' | 'below';
  innerGap: number;
};

export type WidgetShellHeaderCtaDefaults = {
  enabled: boolean;
  label: string;
  href: string;
  openMode: 'same-tab' | 'new-tab' | 'new-window';
  iconEnabled: boolean;
  iconPlacement: 'left' | 'right';
  iconName: string;
};

export type WidgetShellDefaultState = {
  header: WidgetShellHeaderDefaults;
  headerCta: WidgetShellHeaderCtaDefaults;
  uiLabels: {
    core: WidgetShellCoreLabels;
  };
  coreSize: WidgetShellCoreSize;
};

export function createWidgetShellDefaultState(args: {
  header: Partial<WidgetShellHeaderDefaults> & Pick<WidgetShellHeaderDefaults, 'title'>;
  headerCta?: Partial<WidgetShellHeaderCtaDefaults>;
  coreLabels?: Partial<WidgetShellCoreLabels>;
  coreSize?: Partial<WidgetShellCoreSize>;
}): WidgetShellDefaultState {
  return {
    header: {
      enabled: true,
      showSubtitle: false,
      subtitleHtml: '',
      placement: 'top',
      alignment: 'center',
      gap: 24,
      textGap: 8,
      ctaPlacement: 'below',
      innerGap: 16,
      ...args.header,
    },
    headerCta: {
      enabled: false,
      label: '',
      href: '',
      openMode: 'same-tab',
      iconEnabled: false,
      iconPlacement: 'right',
      iconName: 'arrow.right',
      ...(args.headerCta ?? {}),
    },
    uiLabels: {
      core: {
        ...DEFAULT_WIDGET_SHELL_CORE_LABELS,
        ...(args.coreLabels ?? {}),
      },
    },
    coreSize: {
      ...DEFAULT_WIDGET_SHELL_CORE_SIZE,
      ...(args.coreSize ?? {}),
    },
  };
}
