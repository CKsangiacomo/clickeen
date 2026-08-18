import Mustache from 'mustache';
import type { RuntimeTypographyData } from './font-library';
import { annotateWidgetRenderCoordinates, type WidgetSoftware } from './widget-software';

export type WidgetStyleRenderContext = {
  locale: string;
  typographyData: RuntimeTypographyData;
};

type ValueRecord = Record<string, any>;
type CssSection = () => (
  source: string,
  renderTemplate: (template: string) => string,
) => string;

const TRACKING_PRESETS: Record<string, string> = {
  tighter: '-0.03em',
  tight: '-0.015em',
  normal: '0em',
  wide: '0.015em',
  wider: '0.03em',
};

const LINE_HEIGHT_PRESETS: Record<string, string> = {
  snug: '1',
  tight: '1.15',
  relaxed: '1.4',
  loose: '1.6',
};

const DEFAULT_ROLE_LINE_HEIGHT: Record<string, string> = {
  title: 'var(--lh-tight)',
  body: 'var(--lh-body)',
  section: 'var(--lh-tight)',
  question: 'var(--lh-tight)',
  answer: 'var(--lh-body)',
  heading: 'var(--lh-tight)',
  timer: '1',
  label: 'var(--lh-tight)',
  button: 'var(--lh-tight)',
  localeSwitcher: 'var(--lh-tight)',
};

const SCRIPT_NORMAL_LINE_HEIGHT: Record<string, Record<string, string>> = {
  japanese: {
    title: '1.28',
    section: '1.3',
    question: '1.38',
    body: '1.58',
    answer: '1.62',
    button: '1.24',
  },
  korean: {
    title: '1.26',
    section: '1.3',
    question: '1.36',
    body: '1.54',
    answer: '1.58',
    button: '1.22',
  },
  zhHans: {
    title: '1.24',
    section: '1.28',
    question: '1.34',
    body: '1.52',
    answer: '1.56',
    button: '1.2',
  },
  zhHant: {
    title: '1.24',
    section: '1.28',
    question: '1.34',
    body: '1.52',
    answer: '1.56',
    button: '1.2',
  },
};

const SCRIPT_FONTS: Record<
  string,
  Record<'sans' | 'serif', { fonts: string[]; specs: Record<string, string> }>
> = {
  latin: {
    sans: { fonts: [], specs: {} },
    serif: { fonts: [], specs: {} },
  },
  japanese: {
    sans: {
      fonts: ['Noto Sans JP', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', 'Meiryo'],
      specs: { 'Noto Sans JP': 'Noto+Sans+JP:wght@100..900' },
    },
    serif: {
      fonts: ['Noto Serif JP', 'Hiragino Mincho ProN', 'Yu Mincho'],
      specs: { 'Noto Serif JP': 'Noto+Serif+JP:wght@200..900' },
    },
  },
  korean: {
    sans: {
      fonts: ['Noto Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic'],
      specs: { 'Noto Sans KR': 'Noto+Sans+KR:wght@100..900' },
    },
    serif: {
      fonts: ['Noto Serif KR', 'Batang', 'AppleMyungjo'],
      specs: { 'Noto Serif KR': 'Noto+Serif+KR:wght@200..900' },
    },
  },
  zhHans: {
    sans: {
      fonts: ['Noto Sans SC', 'PingFang SC', 'Microsoft YaHei'],
      specs: { 'Noto Sans SC': 'Noto+Sans+SC:wght@100..900' },
    },
    serif: {
      fonts: ['Noto Serif SC', 'Songti SC', 'STSong'],
      specs: { 'Noto Serif SC': 'Noto+Serif+SC:wght@200..900' },
    },
  },
  zhHant: {
    sans: {
      fonts: ['Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei'],
      specs: { 'Noto Sans TC': 'Noto+Sans+TC:wght@100..900' },
    },
    serif: {
      fonts: ['Noto Serif TC', 'PMingLiU', 'MingLiU'],
      specs: { 'Noto Serif TC': 'Noto+Serif+TC:wght@200..900' },
    },
  },
  arabic: {
    sans: {
      fonts: ['Noto Sans Arabic', 'Tahoma', 'Arial'],
      specs: { 'Noto Sans Arabic': 'Noto+Sans+Arabic:wght@100..900' },
    },
    serif: {
      fonts: ['Noto Naskh Arabic', 'Amiri', 'Traditional Arabic'],
      specs: { 'Noto Naskh Arabic': 'Noto+Naskh+Arabic:wght@400..700' },
    },
  },
  hebrew: {
    sans: {
      fonts: ['Noto Sans Hebrew', 'Arial'],
      specs: { 'Noto Sans Hebrew': 'Noto+Sans+Hebrew:wght@100..900' },
    },
    serif: {
      fonts: ['Noto Serif Hebrew', 'Times New Roman'],
      specs: { 'Noto Serif Hebrew': 'Noto+Serif+Hebrew:wght@100..900' },
    },
  },
  thai: {
    sans: {
      fonts: ['Noto Sans Thai', 'Tahoma', 'Arial'],
      specs: { 'Noto Sans Thai': 'Noto+Sans+Thai:wght@100..900' },
    },
    serif: {
      fonts: ['Noto Serif Thai', 'Tahoma', 'Arial'],
      specs: { 'Noto Serif Thai': 'Noto+Serif+Thai:wght@100..900' },
    },
  },
  devanagari: {
    sans: {
      fonts: ['Noto Sans Devanagari', 'Nirmala UI', 'Mangal'],
      specs: { 'Noto Sans Devanagari': 'Noto+Sans+Devanagari:wght@100..900' },
    },
    serif: {
      fonts: ['Noto Serif Devanagari', 'Nirmala UI', 'Mangal'],
      specs: { 'Noto Serif Devanagari': 'Noto+Serif+Devanagari:wght@100..900' },
    },
  },
  bengali: {
    sans: {
      fonts: ['Noto Sans Bengali', 'Nirmala UI', 'Vrinda'],
      specs: { 'Noto Sans Bengali': 'Noto+Sans+Bengali:wght@100..900' },
    },
    serif: {
      fonts: ['Noto Serif Bengali', 'Nirmala UI', 'Vrinda'],
      specs: { 'Noto Serif Bengali': 'Noto+Serif+Bengali:wght@100..900' },
    },
  },
  cyrillic: {
    sans: { fonts: ['Noto Sans', 'Arial'], specs: { 'Noto Sans': 'Noto+Sans:wght@100..900' } },
    serif: {
      fonts: ['Noto Serif', 'Georgia', 'Times New Roman'],
      specs: { 'Noto Serif': 'Noto+Serif:wght@100..900' },
    },
  },
};

const RESPONSIVE_SCRIPT_SELECTORS: Array<{ script: string; selectors: string[] }> = [
  { script: 'latin', selectors: ['html[lang]'] },
  { script: 'japanese', selectors: ['html:lang(ja)'] },
  { script: 'korean', selectors: ['html:lang(ko)'] },
  { script: 'zhHans', selectors: ['html:lang(zh)'] },
  {
    script: 'zhHant',
    selectors: ['html:lang(zh-Hant)', 'html:lang(zh-TW)', 'html:lang(zh-HK)', 'html:lang(zh-MO)'],
  },
  {
    script: 'arabic',
    selectors: ['ar', 'fa', 'ur', 'ps', 'sd', 'ug', 'ku', 'ckb', 'ks'].map(
      (locale) => `html:lang(${locale})`,
    ),
  },
  { script: 'hebrew', selectors: ['html:lang(he)', 'html:lang(yi)'] },
  { script: 'thai', selectors: ['html:lang(th)'] },
  {
    script: 'devanagari',
    selectors: ['hi', 'mr', 'ne', 'sa'].map((locale) => `html:lang(${locale})`),
  },
  {
    script: 'bengali',
    selectors: ['bn', 'as'].map((locale) => `html:lang(${locale})`),
  },
  {
    script: 'cyrillic',
    selectors: ['ru', 'uk', 'bg', 'mk', 'sr', 'be', 'kk', 'ky', 'mn', 'tg', 'tt'].map(
      (locale) => `html:lang(${locale})`,
    ),
  },
];

function valueAt(state: ValueRecord, path: string): any {
  return path.split('.').reduce((value, key) => value[key], state);
}

function cssSection(render: (source: string) => string): CssSection {
  return () => (source, renderTemplate) => render(renderTemplate(source).trim());
}

function fillBackground(fill: ValueRecord): string {
  const renderers: Record<string, (value: ValueRecord) => string> = {
    none: () => 'transparent',
    color: (value) => value.color,
    gradient: (value) => {
      const gradient = value.gradient;
      const stops = gradient.stops
        .map((stop: ValueRecord) => `${stop.color} ${stop.position}%`)
        .join(', ');
      const functions: Record<string, string> = {
        linear: `linear-gradient(${gradient.angle}deg, ${stops})`,
        radial: `radial-gradient(circle, ${stops})`,
        conic: `conic-gradient(from ${gradient.angle}deg, ${stops})`,
      };
      return functions[gradient.kind];
    },
    image: (value) =>
      `url(${JSON.stringify(value.image.src)}) ${value.image.position} / ${value.image.fit} ${value.image.repeat}`,
    video: () => 'transparent',
  };
  return renderers[fill.type](fill);
}

function fillColor(fill: ValueRecord): string {
  return fill.type === 'none' ? 'transparent' : fill.color;
}

function radiusToken(value: string): string {
  return value === 'none' ? '0' : `var(--control-radius-${value})`;
}

function radii(card: ValueRecord): string {
  if (card.radiusLinked) {
    const radius = radiusToken(card.radius);
    return `${radius} ${radius} ${radius} ${radius}`;
  }
  return [card.radiusTL, card.radiusTR, card.radiusBR, card.radiusBL].map(radiusToken).join(' ');
}

function borderWidth(border: ValueRecord): string {
  return border.enabled && border.width > 0 ? `${border.width}px` : '0px';
}

function borderColor(border: ValueRecord): string {
  return border.enabled && border.width > 0 ? border.color : 'transparent';
}

function shadowCss(shadow: ValueRecord, inset: boolean): string {
  if (!shadow.enabled || shadow.alpha === 0) return 'none';
  return `${inset ? 'inset ' : ''}${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.spread}px color-mix(in oklab, ${shadow.color}, transparent ${100 - shadow.alpha}%)`;
}

function insideShadowCss(group: ValueRecord): string {
  const shadows = group.linked ? [group.all] : [group.top, group.right, group.bottom, group.left];
  const rendered = shadows
    .filter((shadow) => shadow.enabled && shadow.alpha > 0)
    .map((shadow) => shadowCss(shadow, true));
  return rendered.length ? rendered.join(', ') : 'none';
}

function shadowGutters(shadow: ValueRecord): Record<string, number> {
  if (!shadow.enabled || shadow.alpha === 0) return { top: 0, right: 0, bottom: 0, left: 0 };
  const extent = Math.max(0, Math.ceil(shadow.blur * 1.5 + shadow.spread));
  return {
    top: Math.max(0, extent - shadow.y),
    right: Math.max(0, extent + shadow.x),
    bottom: Math.max(0, extent + shadow.y),
    left: Math.max(0, extent - shadow.x),
  };
}

function paddingSide(box: ValueRecord, side: string): number {
  return box.linked ? box.all : box[side];
}

function scriptForLocale(locale: string): string {
  const parts = locale.toLowerCase().replace(/_/g, '-').split('-');
  if (parts.includes('hans')) return 'zhHans';
  if (parts.includes('hant')) return 'zhHant';
  if (parts.includes('jpan') || parts[0] === 'ja') return 'japanese';
  if (parts.includes('kore') || parts[0] === 'ko') return 'korean';
  if (parts[0] === 'zh')
    return parts.includes('tw') || parts.includes('hk') || parts.includes('mo')
      ? 'zhHant'
      : 'zhHans';
  if (
    parts.includes('arab') ||
    ['ar', 'fa', 'ur', 'ps', 'sd', 'ug', 'ku', 'ckb', 'ks'].includes(parts[0])
  )
    return 'arabic';
  if (parts.includes('hebr') || ['he', 'yi'].includes(parts[0])) return 'hebrew';
  if (parts.includes('thai') || parts[0] === 'th') return 'thai';
  if (parts.includes('deva') || ['hi', 'mr', 'ne', 'sa'].includes(parts[0])) return 'devanagari';
  if (parts.includes('beng') || ['bn', 'as'].includes(parts[0])) return 'bengali';
  if (
    parts.includes('cyrl') ||
    ['ru', 'uk', 'bg', 'mk', 'sr', 'be', 'kk', 'ky', 'mn', 'tg', 'tt'].includes(parts[0])
  )
    return 'cyrillic';
  return 'latin';
}

function fontToken(family: string): string {
  return family.includes(' ') ? JSON.stringify(family) : family;
}

function familyCss(args: {
  family: string;
  script: string;
  typographyData: RuntimeTypographyData;
}): string {
  const familyClass = args.typographyData.curatedFonts[args.family].familyClass;
  const scriptFonts = SCRIPT_FONTS[args.script][familyClass].fonts;
  const selectedFirst = ['japanese', 'korean', 'zhHans', 'zhHant'].includes(args.script)
    ? [...scriptFonts, args.family]
    : [args.family, ...scriptFonts];
  const tail = familyClass === 'serif' ? ['serif'] : ['Inter', 'sans-serif'];
  return Array.from(new Set([...selectedFirst, ...tail]))
    .map(fontToken)
    .join(', ');
}

function pxLength(value: unknown): number | null {
  const match = String(value).match(/^(-?\d+(?:\.\d+)?)px$/);
  return match ? Number(match[1]) : null;
}

function fluidSize(roleKey: string, value: string, scale: ValueRecord): string {
  const max = pxLength(value);
  const min = pxLength(scale.xs);
  if (max === null || min === null || max <= 0 || min <= 0 || min >= max) return value;
  if (['title', 'bigBang', 'timer', 'cardTitle'].includes(roleKey)) {
    const growth = Math.round((((max - min) * 100) / 960) * 10000) / 10000;
    return `clamp(${min}px, calc(${min}px + ${growth}cqi), ${max}px)`;
  }
  const preferred = Math.round(((max * 100) / 960) * 10000) / 10000;
  return `clamp(${min}px, ${preferred}cqi, ${max}px)`;
}

function typographyRoleCss(args: {
  state: ValueRecord;
  source: string;
  locale: string;
  typographyData: RuntimeTypographyData;
}): string {
  const [roleKey, variableKey = roleKey] = args.source.split(/\s+/);
  const typography = args.state.typography;
  const role = typography.roles[roleKey];
  const scale = typography.roleScales[roleKey];
  const rawSize = role.sizePreset === 'custom' ? role.sizeCustom : scale[role.sizePreset];
  const size =
    typeof rawSize === 'number' || /^-?\d+(?:\.\d+)?$/.test(String(rawSize))
      ? `${rawSize}px`
      : String(rawSize);
  const tracking =
    role.trackingPreset === 'custom'
      ? `${role.trackingCustom}${typeof role.trackingCustom === 'number' || /^-?\d+(?:\.\d+)?$/.test(String(role.trackingCustom)) ? 'em' : ''}`
      : TRACKING_PRESETS[role.trackingPreset];
  const script = scriptForLocale(args.locale);
  const lineHeight =
    role.lineHeightPreset === 'custom'
      ? String(role.lineHeightCustom)
      : role.lineHeightPreset === 'normal'
        ? (SCRIPT_NORMAL_LINE_HEIGHT[script]?.[roleKey] ??
          DEFAULT_ROLE_LINE_HEIGHT[roleKey] ??
          'normal')
        : LINE_HEIGHT_PRESETS[role.lineHeightPreset];
  return [
    `--typo-${variableKey}-family: ${familyCss({ family: role.family, script, typographyData: args.typographyData })};`,
    `--typo-${variableKey}-size: ${fluidSize(roleKey, size, scale)};`,
    `--typo-${variableKey}-weight: ${role.weight};`,
    `--typo-${variableKey}-style: ${role.fontStyle};`,
    `--typo-${variableKey}-color: ${fillColor(role.color)};`,
    `--typo-${variableKey}-tracking: ${tracking};`,
    `--typo-${variableKey}-line-height: ${lineHeight};`,
  ].join('\n  ');
}

function fontSources(args: {
  state: ValueRecord;
  locale: string;
  typographyData: RuntimeTypographyData;
}): string {
  const typography = args.state.typography;
  const families = new Set<string>([
    typography.globalFamily,
    ...Object.values(typography.roles).map((role: any) => role.family),
  ]);
  const faces: string[] = [];
  for (const family of families) {
    const font = args.typographyData.curatedFonts[family];
    if (font.source === 'google') {
      continue;
    }
    const formatByType: Record<string, string> = {
      'font/woff2': 'woff2',
      'font/woff': 'woff',
      'application/font-woff': 'woff',
      'application/x-font-woff': 'woff',
      'font/ttf': 'truetype',
      'application/x-font-ttf': 'truetype',
      'font/otf': 'opentype',
      'application/x-font-otf': 'opentype',
    };
    const extension = font.url.split(/[?#]/)[0].split('.').pop();
    const format =
      font.source === 'account-asset'
        ? formatByType[font.contentType]
        : (
            { woff2: 'woff2', woff: 'woff', ttf: 'truetype', otf: 'opentype' } as Record<
              string,
              string
            >
          )[extension!];
    for (const style of font.styles) {
      for (const weight of font.weights) {
        faces.push(
          `@font-face { font-family: ${fontToken(family)}; src: url(${JSON.stringify(font.url)})${format ? ` format("${format}")` : ''}; font-style: ${style}; font-weight: ${weight}; font-display: swap; }`,
        );
      }
    }
  }
  return faces.join('\n');
}

export function listWidgetFontStylesheets(args: {
  state: Record<string, unknown>;
  context: WidgetStyleRenderContext;
}): string[] {
  const state = args.state as ValueRecord;
  const typography = state.typography;
  const families = new Set<string>([
    typography.globalFamily,
    ...Object.values(typography.roles).map((role: any) => role.family),
  ]);
  const specs = new Set<string>();
  for (const family of families) {
    const font = args.context.typographyData.curatedFonts[family];
    if (font.source === 'google') specs.add(font.spec);
  }
  for (const scriptProfiles of Object.values(SCRIPT_FONTS)) {
    for (const profile of Object.values(scriptProfiles)) {
      Object.values(profile.specs).forEach((spec) => specs.add(spec));
    }
  }
  return specs.size
    ? [
        `https://fonts.googleapis.com/css2?${[...specs]
          .map((spec) => `family=${spec}`)
          .join('&')}&display=swap`,
      ]
    : [];
}

function typographyVariableKey(roleKey: string): string {
  return roleKey.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function responsiveTypographyCss(args: {
  state: ValueRecord;
  typographyData: RuntimeTypographyData;
}): string {
  const roles = args.state.typography.roles as Record<string, ValueRecord>;
  return RESPONSIVE_SCRIPT_SELECTORS.map(({ script, selectors }) => {
    const declarations = Object.entries(roles).flatMap(([roleKey, role]) => {
      const variableKey = typographyVariableKey(roleKey);
      const values = [
        `--typo-${variableKey}-family: ${familyCss({
          family: role.family,
          script,
          typographyData: args.typographyData,
        })};`,
      ];
      if (role.lineHeightPreset === 'normal') {
        values.push(
          `--typo-${variableKey}-line-height: ${
            SCRIPT_NORMAL_LINE_HEIGHT[script]?.[roleKey] ??
            DEFAULT_ROLE_LINE_HEIGHT[roleKey] ??
            'normal'
          };`,
        );
      }
      return values;
    });
    return `${selectors.map((selector) => `${selector} .ck-headerLayout`).join(',\n')} {\n  ${declarations.join('\n  ')}\n}`;
  }).join('\n\n');
}

function buildCssView(args: {
  state: ValueRecord;
  context: WidgetStyleRenderContext;
}): Record<string, CssSection> {
  const { state, context } = args;
  return {
    background: cssSection((path) => fillBackground(valueAt(state, path))),
    color: cssSection((path) => fillColor(valueAt(state, path))),
    radius: cssSection((path) => radiusToken(valueAt(state, path))),
    radii: cssSection((path) => radii(valueAt(state, path))),
    borderWidth: cssSection((path) => borderWidth(valueAt(state, path))),
    borderColor: cssSection((path) => borderColor(valueAt(state, path))),
    shadow: cssSection((path) => shadowCss(valueAt(state, path), false)),
    insideShadow: cssSection((path) => insideShadowCss(valueAt(state, path))),
    shadowGutter: cssSection((source) => {
      const [path, side] = source.split(/\s+/);
      return String(shadowGutters(valueAt(state, path))[side]);
    }),
    padding: cssSection((source) => {
      const [path, side] = source.split(/\s+/);
      return String(paddingSide(valueAt(state, path), side));
    }),
    positivePx: cssSection((path) => {
      const value = valueAt(state, path);
      return value > 0 ? `${value}px` : 'auto';
    }),
    typographyRole: cssSection((source) =>
      typographyRoleCss({
        state,
        source,
        locale: context.locale,
        typographyData: context.typographyData,
      }),
    ),
  };
}

/**
 * Express exact instance presentation through the authored Widget CSS sources.
 * Bob preview and Roma Publish both call this renderer with the same logical
 * state; public JavaScript never receives that state to recreate presentation.
 */
export function renderWidgetStyles(args: {
  software: WidgetSoftware;
  state: Record<string, unknown>;
  context: WidgetStyleRenderContext;
}): string {
  const state = structuredClone(args.state) as ValueRecord;
  annotateWidgetRenderCoordinates(state);
  const view = {
    ...state,
    ck: {
      css: buildCssView({ state, context: args.context }),
    },
  };
  const renderedSources = args.software.styles.map((asset) => Mustache.render(asset.source, view));
  return `${fontSources({ state: args.state, locale: args.context.locale, typographyData: args.context.typographyData })}\n\n${renderedSources.join('\n\n')}\n\n${responsiveTypographyCss({ state: args.state, typographyData: args.context.typographyData })}\n`;
}
