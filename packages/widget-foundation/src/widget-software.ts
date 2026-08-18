import {
  extractSavedTextFieldsForEditableFields,
  type WidgetEditableFieldsContract,
} from '@clickeen/ck-contracts/translated-value-primitives';
import Mustache from 'mustache';

export type WidgetSoftware = {
  widgetHtml: string;
  coreHtml: string;
  coreCss: string;
  coreJs: string;
  styles: WidgetSoftwareAsset[];
  scripts: WidgetSoftwareAsset[];
};

export type WidgetSoftwareAsset = {
  path: string;
  source: string;
};

export type WidgetDiscoveryContract = {
  widgetType: string;
  kind: string;
  baseline: {
    title: string;
    description: string;
  };
  parts: Array<{
    id: string;
    path: string;
    role: string;
    identityPaths: string[];
  }>;
  relationships: Array<{
    kind: string;
    from: string;
    to: string;
    identityPaths: string[];
  }>;
};

export type WidgetRenderContext = {
  instanceId: string;
  locale: string;
  discoveryEnabled: boolean;
  discovery?: WidgetDiscoveryContract;
  previewMode?: 'editing' | 'translations';
};

type WidgetRenderRecord = Record<string, unknown>;

export function annotateWidgetRenderCoordinates(
  value: unknown,
  concrete: string[] = [],
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const itemPath = [...concrete, String(index)];
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const record = item as WidgetRenderRecord;
        record.$ck = {
          ...(record.$ck as WidgetRenderRecord | undefined),
          index,
          path: itemPath.join('.'),
        };
      }
      annotateWidgetRenderCoordinates(item, itemPath);
    });
    return;
  }
  if (!value || typeof value !== 'object') return;
  Object.entries(value as WidgetRenderRecord).forEach(([key, child]) => {
    if (key !== '$ck') annotateWidgetRenderCoordinates(child, [...concrete, key]);
  });
}

function buildWidgetRenderState(args: {
  state: Record<string, unknown>;
  editableFields: WidgetEditableFieldsContract;
  discovery?: WidgetDiscoveryContract;
}): Record<string, unknown> {
  const renderState = structuredClone(args.state) as WidgetRenderRecord;
  annotateWidgetRenderCoordinates(renderState);
  const identityKeyByPath = new Map(
    extractSavedTextFieldsForEditableFields({
      contract: args.editableFields,
      config: args.state,
    }).map((field) => [field.path, field.identityKey]),
  );
  for (const field of args.editableFields.fields) {
    const segments = field.path.split('.');
    const annotate = (current: unknown, index: number, concrete: string[]): void => {
      const segment = segments[index]!;
      const repeat = segment.endsWith('[]');
      const key = repeat ? segment.slice(0, -2) : segment;
      const record = current as WidgetRenderRecord;
      if (repeat) {
        (record[key] as unknown[]).forEach((item, itemIndex) => {
          annotate(item, index + 1, [...concrete, key, String(itemIndex)]);
        });
        return;
      }
      if (index === segments.length - 1) {
        const path = [...concrete, key].join('.');
        const discoveryPart = args.discovery?.parts.find((part) => part.path === field.path);
        record.$ck = {
          ...(record.$ck as WidgetRenderRecord | undefined),
          [key]: {
            path: identityKeyByPath.get(path)!,
            mode: field.type === 'richtext' ? 'html' : 'text',
            ...(discoveryPart
              ? {
                  discovery: {
                    ...discoveryPart,
                    relationships: args.discovery!.relationships.filter(
                      (relationship) =>
                        relationship.from === discoveryPart.id ||
                        relationship.to === discoveryPart.id,
                    ),
                    relationship: args.discovery!.relationships.find(
                      (relationship) =>
                        relationship.from === discoveryPart.id ||
                        relationship.to === discoveryPart.id,
                    ),
                  },
                }
              : {}),
          },
        };
        return;
      }
      annotate(record[key], index + 1, [...concrete, key]);
    };
    annotate(renderState, 0, []);
  }
  return renderState;
}

/**
 * Build-time source compilation. The returned source is the exact authored
 * Widget software carried by the generated Bob and Roma artifacts.
 */
export function compileWidgetSoftware(software: WidgetSoftware): WidgetSoftware {
  const coreReferences = software.widgetHtml.match(/{{>\s*core\s*}}/g) ?? [];
  if (coreReferences.length !== 1) {
    throw new Error('Widget widget.html must contain exactly one {{> core}} reference');
  }
  if (/{{>/.test(software.coreHtml)) {
    throw new Error('Widget core/core.html must not contain partial references');
  }
  Mustache.parse(software.widgetHtml);
  Mustache.parse(software.coreHtml);
  software.styles.forEach((asset) => Mustache.parse(asset.source));
  return software;
}

/**
 * Express exact instance truth through the Widget-owned HTML source.
 * This is used by Bob preview and Roma Publish; it is not a public runtime
 * renderer.
 */
export function renderWidgetHtml(args: {
  software: WidgetSoftware;
  state: Record<string, unknown>;
  editableFields: WidgetEditableFieldsContract;
  context: WidgetRenderContext;
}): string {
  const state = args.state as any;
  const renderState = buildWidgetRenderState({
    state: args.state,
    editableFields: args.editableFields,
    discovery: args.context.discoveryEnabled ? args.context.discovery : undefined,
  });
  const bodyTemplate = args.software.widgetHtml
    .match(/<body[^>]*>([\s\S]*)<\/body>/i)![1]!
    .replace(/<script\b[^>]*\bsrc=["'][^"']+["'][^>]*>\s*<\/script>/gi, '');
  return Mustache.render(
    bodyTemplate,
    {
      ...renderState,
      ck: {
        instanceId: args.context.instanceId,
        locale: args.context.locale,
        discovery: args.context.discoveryEnabled ? args.context.discovery : false,
        previewMode: args.context.previewMode,
        shared: {
          headerCtaNewTab: state.headerCta.openMode === 'new-tab',
          headerCtaNewWindow: state.headerCta.openMode === 'new-window',
          localeSwitcherStage:
            state.localeSwitcher.enabled === true && state.localeSwitcher.attachTo === 'stage',
          localeSwitcherPod:
            state.localeSwitcher.enabled === true && state.localeSwitcher.attachTo === 'pod',
          socialShareStage:
            state.behavior.socialShare.enabled === true &&
            state.behavior.socialShare.attachTo === 'stage',
          socialSharePod:
            state.behavior.socialShare.enabled === true &&
            state.behavior.socialShare.attachTo === 'pod',
        },
      },
    },
    {
      core: args.software.coreHtml,
    },
  );
}
