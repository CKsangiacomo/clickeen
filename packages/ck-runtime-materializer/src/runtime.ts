import {
  renderWidgetStyles,
  WIDGET_PACKAGE_RUNTIME_MODULE_END,
  type RuntimeTypographyData,
  type WidgetSoftware,
} from '@clickeen/widget-foundation';

function moduleId(path: string): string {
  return path
    .split('?')[0]
    .replace(/^\.\.\/shared\//, 'shared/')
    .replace(/^\.\/core\//, 'core/')
    .replace(/[^A-Za-z0-9_.:/-]+/g, '-');
}

export function buildStyles(args: {
  software: WidgetSoftware;
  state: Record<string, unknown>;
  locale: string;
  typographyData: RuntimeTypographyData;
}): string {
  return renderWidgetStyles({
    software: args.software,
    state: args.state,
    context: {
      locale: args.locale,
      typographyData: args.typographyData,
    },
  });
}

export function buildRuntime(software: WidgetSoftware): string {
  return `${software.scripts
    .map(
      (asset) =>
        `/* ck-runtime-module:${moduleId(asset.path)} */\n${asset.source}\n${WIDGET_PACKAGE_RUNTIME_MODULE_END}`,
    )
    .join('\n\n')}\n`;
}
