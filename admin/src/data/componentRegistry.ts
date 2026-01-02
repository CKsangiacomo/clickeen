import type { ComponentSource } from './componentTypes';

const specModules = import.meta.glob('../../../dieter/components/*/*.spec.json', {
  eager: true,
}) as Record<string, any>;

const templateModules = import.meta.glob('../../../dieter/components/*/*.html', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const cssModules = import.meta.glob('../../../dieter/components/*/*.css', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const toTitle = (slug: string): string => slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

const BUTTON_IMPORT_REGEX = /@import\s+['"]\.\.\/button\/button\.css['"];\s*/g;
const MENUACTIONS_IMPORT_REGEX = /@import\s+['"]\.\.\/menuactions\/menuactions\.css['"];\s*/g;
const POPOVER_IMPORT_REGEX = /@import\s+['"]\.\.\/popover\/popover\.css['"];\s*/g;
const SLIDER_IMPORT_REGEX = /@import\s+['"]\.\.\/slider\/slider\.css['"];\s*/g;
const TEXTFIELD_IMPORT_REGEX = /@import\s+['"]\.\.\/textfield\/textfield\.css['"];\s*/g;
const TOGGLE_IMPORT_REGEX = /@import\s+['"]\.\.\/toggle\/toggle\.css['"];\s*/g;

const inlineCssImports = (css?: string): string | undefined => {
  if (!css) return css;

  let result = css;

  if (result.includes("@import '../button/button.css';") || result.includes('@import "../button/button.css";')) {
    const buttonCss = cssModules['../../../dieter/components/button/button.css'];
    result = result.replace(BUTTON_IMPORT_REGEX, buttonCss ? `${buttonCss}\n` : '');
  }

  if (
    result.includes("@import '../menuactions/menuactions.css';") ||
    result.includes('@import "../menuactions/menuactions.css";')
  ) {
    const menuactionsCss = cssModules['../../../dieter/components/menuactions/menuactions.css'];
    result = result.replace(MENUACTIONS_IMPORT_REGEX, menuactionsCss ? `${menuactionsCss}\n` : '');
  }

  if (result.includes("@import '../popover/popover.css';") || result.includes('@import "../popover/popover.css";')) {
    const popoverCss = cssModules['../../../dieter/components/popover/popover.css'];
    result = result.replace(POPOVER_IMPORT_REGEX, popoverCss ? `${popoverCss}\n` : '');
  }

  if (result.includes("@import '../slider/slider.css';") || result.includes('@import "../slider/slider.css";')) {
    const sliderCss = cssModules['../../../dieter/components/slider/slider.css'];
    result = result.replace(SLIDER_IMPORT_REGEX, sliderCss ? `${sliderCss}\n` : '');
  }

  if (result.includes("@import '../textfield/textfield.css';") || result.includes('@import "../textfield/textfield.css";')) {
    const textfieldCss = cssModules['../../../dieter/components/textfield/textfield.css'];
    result = result.replace(TEXTFIELD_IMPORT_REGEX, textfieldCss ? `${textfieldCss}\n` : '');
  }

  if (result.includes("@import '../toggle/toggle.css';") || result.includes('@import "../toggle/toggle.css";')) {
    const toggleCss = cssModules['../../../dieter/components/toggle/toggle.css'];
    result = result.replace(TOGGLE_IMPORT_REGEX, toggleCss ? `${toggleCss}\n` : '');
  }

  return result;
};

const buildSources = (): ComponentSource[] => {
  return Object.entries(specModules)
    .map(([specPath, spec]) => {
      const name = specPath.split('/').slice(-2, -1)[0];
      const templatePath = `../../../dieter/components/${name}/${name}.html`;
      const cssPath = `../../../dieter/components/${name}/${name}.css`;
      const rawCss = cssModules[cssPath];
      const inlinedCss = inlineCssImports(rawCss);
      return {
        name,
        title: toTitle(name),
        spec,
        template: templateModules[templatePath],
        css: inlinedCss,
        paths: {
          spec: specPath,
          template: templateModules[templatePath] ? templatePath : undefined,
          css: rawCss ? cssPath : undefined,
        },
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
};

export const componentSources: ComponentSource[] = buildSources();

export const componentCssByName = new Map<string, string>();
componentSources.forEach((source) => {
  if (source.css) {
    componentCssByName.set(source.name, source.css);
  }
});
