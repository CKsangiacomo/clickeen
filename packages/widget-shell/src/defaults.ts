import type { WidgetShellCoreLabels, WidgetShellCoreSize } from './contract';

export const DEFAULT_WIDGET_SHELL_CORE_SIZE: WidgetShellCoreSize = {
  mode: 'auto',
  fixedHeight: 360,
  minHeight: 280,
  preferredVw: 32,
  maxHeight: 640,
};

export const DEFAULT_WIDGET_SHELL_CORE_LABELS: WidgetShellCoreLabels = {
  singular: 'Content',
  plural: 'Content',
  sizeCluster: 'Content size',
};

export const WIDGET_SHELL_FACTORY_DEFAULTS = {
  header: {
    alignment: 'left',
    ctaPlacement: 'below',
    enabled: true,
    gap: 28,
    innerGap: 18,
    placement: 'left',
    showSubtitle: true,
    textGap: 8,
    subtitleHtml:
      'Start with a polished Clickeen widget, customize it in Builder, and publish it anywhere your site needs it.',
    title: 'Build your widget in minutes',
  },
  headerCta: {
    enabled: true,
    href: 'https://www.clickeen.com',
    iconEnabled: true,
    iconName: 'arrowshape.turn.up.right',
    iconPlacement: 'right',
    openMode: 'new-tab',
    label: 'Get started',
  },
  stage: {
    alignment: 'center',
    background: {
      color: '#efefef',
      type: 'color',
    },
    canvas: {
      height: 0,
      mode: 'viewport',
      width: 0,
    },
    insideShadow: {
      all: {
        alpha: 0,
        blur: 0,
        color: '#000000',
        enabled: false,
        inset: true,
        spread: 0,
        x: 0,
        y: 0,
      },
      bottom: {
        alpha: 12,
        blur: 16,
        color: '#000000',
        enabled: false,
        inset: true,
        spread: -12,
        x: 0,
        y: -12,
      },
      layer: 'below-content',
      left: {
        alpha: 12,
        blur: 16,
        color: '#000000',
        enabled: false,
        inset: true,
        spread: -12,
        x: 12,
        y: 0,
      },
      linked: true,
      right: {
        alpha: 12,
        blur: 16,
        color: '#000000',
        enabled: false,
        inset: true,
        spread: -12,
        x: -12,
        y: 0,
      },
      top: {
        alpha: 12,
        blur: 16,
        color: '#000000',
        enabled: false,
        inset: true,
        spread: -12,
        x: 0,
        y: 12,
      },
    },
    padding: {
      desktop: {
        all: 60,
        bottom: 60,
        left: 60,
        linked: true,
        right: 60,
        top: 60,
      },
      mobile: {
        all: 40,
        bottom: 40,
        left: 40,
        linked: true,
        right: 40,
        top: 40,
      },
    },
    shadow: {
      alpha: 0,
      blur: 0,
      color: '#000000',
      enabled: false,
      inset: false,
      spread: 0,
      x: 0,
      y: 0,
    },
  },
  pod: {
    background: {
      color: '#ffffff',
      type: 'color',
    },
    contentWidth: 1200,
    insideShadow: {
      all: {
        alpha: 0,
        blur: 0,
        color: '#000000',
        enabled: false,
        inset: true,
        spread: 0,
        x: 0,
        y: 0,
      },
      bottom: {
        alpha: 12,
        blur: 16,
        color: '#000000',
        enabled: false,
        inset: true,
        spread: -12,
        x: 0,
        y: -12,
      },
      layer: 'below-content',
      left: {
        alpha: 12,
        blur: 16,
        color: '#000000',
        enabled: false,
        inset: true,
        spread: -12,
        x: 12,
        y: 0,
      },
      linked: true,
      right: {
        alpha: 12,
        blur: 16,
        color: '#000000',
        enabled: false,
        inset: true,
        spread: -12,
        x: -12,
        y: 0,
      },
      top: {
        alpha: 12,
        blur: 16,
        color: '#000000',
        enabled: false,
        inset: true,
        spread: -12,
        x: 0,
        y: 12,
      },
    },
    padding: {
      desktop: {
        all: 60,
        bottom: 60,
        left: 60,
        linked: true,
        right: 60,
        top: 60,
      },
      mobile: {
        all: 40,
        bottom: 40,
        left: 40,
        linked: true,
        right: 40,
        top: 40,
      },
    },
    radius: '4xl',
    radiusBL: '4xl',
    radiusBR: '4xl',
    radiusLinked: true,
    radiusTL: '4xl',
    radiusTR: '4xl',
    shadow: {
      alpha: 0,
      blur: 0,
      color: '#000000',
      enabled: false,
      inset: false,
      spread: 0,
      x: 0,
      y: 0,
    },
    widthMode: 'full',
  },
  coreSize: {
    fixedHeight: 360,
    maxHeight: 640,
    minHeight: 280,
    mode: 'auto',
    preferredVw: 32,
  },
  localeSwitcher: {
    attachTo: 'stage',
    enabled: false,
    position: 'top-right',
  },
  behavior: {
    showBacklink: true,
    socialShare: {
      channels: {
        copy: true,
        discord: true,
        email: true,
        facebook: true,
        instagram: true,
        line: true,
        linkedin: true,
        messenger: true,
        reddit: true,
        signal: true,
        slack: true,
        sms: true,
        teams: true,
        telegram: true,
        tiktok: true,
        wechat: true,
        whatsapp: true,
        x: true,
      },
      attachTo: 'stage',
      enabled: false,
      position: 'top-right',
    },
  },
  appearance: {
    headerCta: {
      background: {
        color: 'var(--color-system-blue)',
        type: 'color',
      },
      border: {
        color: 'transparent',
        enabled: false,
        width: 1,
      },
      iconSize: 16,
      iconSizePreset: 'm',
      paddingBlock: 18,
      paddingInline: 18,
      paddingLinked: true,
      radius: 'lg',
      sizePreset: 'custom',
      textColor: {
        color: 'var(--color-system-white)',
        type: 'color',
      },
    },
    localeSwitcherBackground: {
      color: 'var(--color-system-white)',
      type: 'color',
    },
    localeSwitcherTextColor: {
      color: 'var(--color-system-black)',
      type: 'color',
    },
    localeSwitcherBorder: {
      color: 'var(--color-system-gray-5)',
      enabled: true,
      width: 1,
    },
    localeSwitcherRadius: 'md',
    localeSwitcherPaddingInline: 12,
    localeSwitcherPaddingBlock: 8,
    podBorder: {
      color: 'var(--color-system-gray-5)',
      enabled: false,
      width: 1,
    },
  },
  typography: {
    globalFamily: 'Inter',
    roles: {
      title: {
        color: {
          color: 'var(--color-system-black)',
          type: 'color',
        },
        family: 'Inter',
        fontStyle: 'normal',
        lineHeightCustom: 1,
        lineHeightPreset: 'snug',
        sizeCustom: 56,
        sizePreset: 'l',
        trackingCustom: 0,
        trackingPreset: 'tight',
        weight: '700',
      },
      body: {
        color: {
          color: 'var(--color-system-gray)',
          type: 'color',
        },
        family: 'Inter',
        fontStyle: 'normal',
        lineHeightCustom: 1.45,
        lineHeightPreset: 'normal',
        sizeCustom: 20,
        sizePreset: 's',
        trackingCustom: 0,
        trackingPreset: 'tight',
        weight: '400',
      },
      button: {
        color: {
          color: 'var(--color-system-white)',
          type: 'color',
        },
        family: 'Inter',
        fontStyle: 'normal',
        lineHeightCustom: 1.2,
        lineHeightPreset: 'tight',
        sizeCustom: 16,
        sizePreset: 'm',
        trackingCustom: 0,
        trackingPreset: 'tight',
        weight: '500',
      },
      localeSwitcher: {
        color: {
          color: 'var(--color-system-black)',
          type: 'color',
        },
        family: 'Inter',
        fontStyle: 'normal',
        lineHeightCustom: 1.2,
        lineHeightPreset: 'normal',
        sizeCustom: 14,
        sizePreset: 's',
        trackingCustom: 0,
        trackingPreset: 'normal',
        weight: '500',
      },
    },
    roleScales: {
      title: {
        xs: '20px',
        s: '28px',
        m: '36px',
        l: '44px',
        xl: '60px',
      },
      body: {
        xs: '14px',
        s: '16px',
        m: '18px',
        l: '22px',
        xl: '24px',
      },
      button: {
        xs: '13px',
        s: '15px',
        m: '18px',
        l: '20px',
        xl: '24px',
      },
      localeSwitcher: {
        l: '20px',
        m: '18px',
        s: '15px',
        xl: '24px',
        xs: '13px',
      },
    },
  },
} as const;

export type WidgetShellFactoryDefaults = typeof WIDGET_SHELL_FACTORY_DEFAULTS;

export function createWidgetShellFactoryDefaults(): WidgetShellFactoryDefaults {
  return JSON.parse(JSON.stringify(WIDGET_SHELL_FACTORY_DEFAULTS)) as WidgetShellFactoryDefaults;
}

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
