import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readWidgetEditableFieldsContract,
  type WidgetEditableFieldsContract,
} from '../../packages/ck-contracts/src/translated-value-primitives';
import { parseLimitsSpec, type LimitsSpec } from '../../packages/ck-policy/src';
import {
  WIDGET_SHARED_CSS_MODULE_KEYS,
  WIDGET_SHARED_RUNTIME_MODULE_KEYS,
} from '../../packages/widget-foundation/src';
import { extractStylesheetSources } from '../../packages/ck-runtime-materializer/src/html';
import { compileWidgetServer } from '../../bob/lib/compiler.server';
import type { RawWidget } from '../../bob/lib/compiler.shared';
import type { ComponentStencil, ComponentStencilLoader } from '../../bob/lib/compiler/stencils';
import { resolveWidgetTooldrawerLabels } from '../../bob/lib/compiler/tooldrawer-labels';
import type {
  CompiledWidget,
  WidgetPackageContext,
  WidgetPackageFileContext,
} from '../../bob/lib/types';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const widgetsRoot = path.join(repoRoot, 'tokyo/product/widgets');
const dieterRoot = path.join(repoRoot, 'dieter');
const dieterComponentsRoot = path.join(dieterRoot, 'components');
const editorOutputRoot = path.join(repoRoot, 'roma/public/widget-editors');
const materializerOutputRoot = path.join(repoRoot, 'roma/generated/widgets');
const checkOnly = process.argv.includes('--check');

type MaterializerArtifact = {
  widgetname: string;
  displayName: string;
  limits: LimitsSpec;
  editableFields: WidgetEditableFieldsContract;
  controls: Array<{ path?: string }>;
  coreDefaults: Record<string, unknown>;
  widgetPackage: WidgetPackageContext;
};

function discoverWidgetTypes(): string[] {
  return fs
    .readdirSync(widgetsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'shared')
    .map((entry) => entry.name)
    .filter((name) => fs.existsSync(path.join(widgetsRoot, name, 'spec.json')))
    .sort();
}

function readText(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function readHtmlAttribute(openingTag: string, attrName: string): string {
  const escapedAttr = attrName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = openingTag.match(
    new RegExp(`\\s${escapedAttr}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'),
  );
  return String(match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim();
}

function assertWidgetShellContract(
  widgetType: string,
  widgetHtml: string,
  widgetCss: string,
): void {
  const shellTags = [...widgetHtml.matchAll(/<[a-z][\w:-]*(?:\s[^<>]*)?>/gi)]
    .map((match) => match[0])
    .filter((tag) => readHtmlAttribute(tag, 'data-ck-widget') === widgetType)
    .filter((tag) => readHtmlAttribute(tag, 'class').split(/\s+/).includes('ck-headerLayout'));
  if (shellTags.length !== 1) {
    throw new Error(
      `[generate-widget-artifacts] ${widgetType} must have exactly one .ck-headerLayout[data-ck-widget="${widgetType}"] Shell`,
    );
  }
  if (/\bdata-role\s*=\s*(?:"root"|'root'|root(?:\s|>))/i.test(widgetHtml)) {
    throw new Error(`[generate-widget-artifacts] ${widgetType} must not declare a Root role`);
  }

  const directChildren: string[] = [];
  const voidTags = new Set([
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'source',
    'track',
    'wbr',
  ]);
  const tagPattern = /<\/?([a-z][\w:-]*)(?:\s[^<>]*)?>/gi;
  let shellDepth = 0;
  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = tagPattern.exec(widgetHtml))) {
    const tag = tagMatch[0];
    const tagName = String(tagMatch[1] || '').toLowerCase();
    const isClosing = tag.startsWith('</');
    if (shellDepth === 0) {
      if (
        !isClosing &&
        readHtmlAttribute(tag, 'data-ck-widget') === widgetType &&
        readHtmlAttribute(tag, 'class').split(/\s+/).includes('ck-headerLayout')
      ) {
        shellDepth = 1;
      }
      continue;
    }
    if (isClosing) {
      shellDepth -= 1;
      if (shellDepth === 0) break;
      continue;
    }
    if (shellDepth === 1) directChildren.push(tag);
    if (!tag.endsWith('/>') && !voidTags.has(tagName)) shellDepth += 1;
  }
  const childClasses = directChildren.map(
    (tag) => new Set(readHtmlAttribute(tag, 'class').split(/\s+/).filter(Boolean)),
  );
  if (
    childClasses.length !== 2 ||
    !childClasses.some((classes) => classes.has('ck-header')) ||
    !childClasses.some((classes) => classes.has('ck-headerLayout__body'))
  ) {
    throw new Error(
      `[generate-widget-artifacts] ${widgetType} Shell must contain exactly one Header and one Core`,
    );
  }

  const shellClasses = new Set(
    readHtmlAttribute(shellTags[0]!, 'class').split(/\s+/).filter(Boolean),
  );
  for (const rule of widgetCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declarations = String(rule[2] || '');
    if (!/(?:^|;)\s*display\s*:/i.test(declarations)) continue;
    for (const selector of String(rule[1] || '').split(',')) {
      const target =
        selector
          .trim()
          .split(/\s+|>|\+|~/)
          .filter(Boolean)
          .at(-1) || '';
      const targetClasses = new Set(
        [...target.matchAll(/\.([_a-zA-Z]+[\w-]*)/g)].map((match) => String(match[1])),
      );
      const targetsShell = [...shellClasses].some((className) => targetClasses.has(className));
      if (targetsShell) {
        throw new Error(
          `[generate-widget-artifacts] ${widgetType} widget.css must not set display on its Shell; shared/header.css owns .ck-headerLayout layout`,
        );
      }
    }
  }
}

function assertWidgetSharedRuntimeContract(widgetType: string, widgetClient: string): void {
  for (const sharedCall of ['CKBranding.applyBacklink', 'CKSocialShare.apply'] as const) {
    if (
      !widgetClient.includes(`Missing ${sharedCall}`) ||
      !widgetClient.includes(`window.${sharedCall}(`)
    ) {
      throw new Error(
        `[generate-widget-artifacts] ${widgetType} must fail closed and call ${sharedCall}`,
      );
    }
  }
}

function readCssEntry(relativePath: string): string {
  const entryDir = path.posix.dirname(relativePath);
  return readText(relativePath).replace(
    /^@import url\(['"](.+?)['"]\);\s*$/gm,
    (_match, importPath: string) => readCssEntry(path.posix.join(entryDir, importPath)),
  );
}

function mediaTypeForPath(filePath: string): WidgetPackageFileContext['mediaType'] {
  if (filePath.endsWith('.json')) return 'application/json';
  if (filePath.endsWith('.html')) return 'text/html';
  if (filePath.endsWith('.css')) return 'text/css';
  return 'text/javascript';
}

const loadLocalStencil: ComponentStencilLoader = async (type): Promise<ComponentStencil> => {
  const component = type.trim();
  const componentRoot = path.join(dieterComponentsRoot, component);
  const stencilPath = path.join(componentRoot, `${component}.html`);
  if (!component || !fs.existsSync(stencilPath)) {
    throw new Error(`[generate-widget-artifacts] missing Dieter stencil: ${component}`);
  }
  const specPath = path.join(componentRoot, `${component}.spec.json`);
  return {
    stencil: fs.readFileSync(stencilPath, 'utf8'),
    spec: JSON.parse(fs.readFileSync(specPath, 'utf8')) as ComponentStencil['spec'],
  };
};

function buildWidgetPackage(args: {
  widgetType: string;
  specSource: string;
  editableFieldsSource: string;
  tooldrawerLabelsSource: string;
}): WidgetPackageContext {
  const files: WidgetPackageContext['files'] = {};
  const widgetDirectory = `tokyo/product/widgets/${args.widgetType}`;
  const widgetHtml = readText(`${widgetDirectory}/widget.html`);
  const widgetCss = readText(`${widgetDirectory}/widget.css`);
  const widgetClient = readText(`${widgetDirectory}/widget.client.js`);
  assertWidgetShellContract(args.widgetType, widgetHtml, widgetCss);
  assertWidgetSharedRuntimeContract(args.widgetType, widgetClient);
  for (const filename of ['spec.json', 'widget.html', 'widget.css', 'widget.client.js'] as const) {
    files[filename] = {
      mediaType: mediaTypeForPath(filename),
      source:
        filename === 'spec.json'
          ? args.specSource
          : filename === 'widget.html'
            ? widgetHtml
            : filename === 'widget.css'
              ? widgetCss
              : filename === 'widget.client.js'
                ? widgetClient
                : readText(`${widgetDirectory}/${filename}`),
    };
  }
  files['editable-fields.json'] = {
    mediaType: 'application/json',
    source: args.editableFieldsSource,
  };
  files[`${args.widgetType}_tooldrawer_l10n_labels/en.json`] = {
    mediaType: 'application/json',
    source: args.tooldrawerLabelsSource,
  };
  for (const href of extractStylesheetSources(widgetHtml).filter((source) =>
    source.startsWith('/dieter/'),
  )) {
    files[href] = {
      mediaType: 'text/css',
      source: readCssEntry(href.slice(1)),
    };
  }

  const supportKeys = new Set<string>([
    ...WIDGET_SHARED_CSS_MODULE_KEYS,
    ...WIDGET_SHARED_RUNTIME_MODULE_KEYS,
    `product/widgets/${args.widgetType}/widget.css`,
    `product/widgets/${args.widgetType}/widget.client.js`,
  ]);
  for (const key of supportKeys) {
    files[key] = {
      mediaType: mediaTypeForPath(key),
      source: readText(`tokyo/${key}`),
    };
  }
  return { widgetType: args.widgetType, files };
}

function writeOrCheck(filePath: string, source: string): void {
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  if (checkOnly) {
    if (current !== source) {
      throw new Error(
        `[generate-widget-artifacts] ${path.relative(repoRoot, filePath)} is out of date`,
      );
    }
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, source);
}

function assertProductReadableControls(
  widgetType: string,
  controls: CompiledWidget['controls'],
): void {
  const technicalLabels = new Set([
    'contentfields',
    'layoutfields',
    'settingsbehavior',
    'stylefields',
    'typofields',
  ]);
  for (const control of controls) {
    if (!control.kind || control.kind === 'unknown') {
      throw new Error(
        `[generate-widget-artifacts] ${widgetType} control "${control.path}" is missing kind metadata`,
      );
    }
    const label = String(control.label || '').trim();
    const normalized = label.toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (label && (technicalLabels.has(normalized) || /[{}]|__/.test(label))) {
      throw new Error(
        `[generate-widget-artifacts] ${widgetType} control "${control.path}" has technical label "${label}"`,
      );
    }
  }
}

function generatedMaterializerIndex(widgetTypes: string[]): string {
  const imports = widgetTypes.map(
    (widgetType, index) => `import artifact${index} from './widgets/${widgetType}.json';`,
  );
  const entries = widgetTypes
    .map((widgetType, index) => `  '${widgetType}': artifact${index},`)
    .join('\n');
  return `// Generated by scripts/widgets/generate-artifacts.ts. Do not edit manually.
import type { CompiledWidget, WidgetPackageContext } from '../../bob/lib/types';

${imports.join('\n')}

export type WidgetMaterializerArtifact = {
  widgetname: string;
  displayName: string;
  limits: CompiledWidget['limits'];
  editableFields: NonNullable<CompiledWidget['editableFields']>;
  controls: Array<{ path?: string }>;
  coreDefaults: Record<string, unknown>;
  widgetPackage: WidgetPackageContext;
};

const WIDGET_MATERIALIZER_ARTIFACTS = {
${entries}
} as unknown as Record<string, WidgetMaterializerArtifact>;

export function readWidgetMaterializerArtifact(widgetType: string): WidgetMaterializerArtifact | null {
  return WIDGET_MATERIALIZER_ARTIFACTS[widgetType] ?? null;
}
`;
}

async function buildArtifacts(widgetType: string): Promise<{
  editor: CompiledWidget;
  materializer: MaterializerArtifact;
}> {
  const widgetDirectory = `tokyo/product/widgets/${widgetType}`;
  const specSource = readText(`${widgetDirectory}/spec.json`);
  const editableFieldsSource = readText(`${widgetDirectory}/editable-fields.json`);
  const tooldrawerLabelsRelativePath = `${widgetType}_tooldrawer_l10n_labels/en.json`;
  const tooldrawerLabelsSource = readText(`${widgetDirectory}/${tooldrawerLabelsRelativePath}`);
  const spec = JSON.parse(specSource) as RawWidget;
  const tooldrawerLabels = JSON.parse(tooldrawerLabelsSource) as unknown;
  const resolvedWidget = resolveWidgetTooldrawerLabels(spec, tooldrawerLabels).widget;
  if (!resolvedWidget.defaults) {
    throw new Error(`[generate-widget-artifacts] ${widgetType} resolved defaults are missing`);
  }
  const editableFields = readWidgetEditableFieldsContract(JSON.parse(editableFieldsSource));
  const limits = parseLimitsSpec(JSON.parse(readText(`${widgetDirectory}/limits.json`)));
  const compiled = await compileWidgetServer(spec, {
    loadComponentStencil: loadLocalStencil,
    tokyoBaseUrl: '',
    tooldrawerLabels,
  });
  assertProductReadableControls(widgetType, compiled.controls);
  return {
    editor: { ...compiled, limits, editableFields },
    materializer: {
      widgetname: compiled.widgetname,
      displayName: compiled.displayName,
      limits,
      editableFields,
      controls: compiled.controls.map(({ path }) => ({ path })),
      coreDefaults: resolvedWidget.defaults,
      widgetPackage: buildWidgetPackage({
        widgetType,
        specSource,
        editableFieldsSource,
        tooldrawerLabelsSource,
      }),
    },
  };
}

async function main(): Promise<void> {
  const widgetTypes = discoverWidgetTypes();
  if (!checkOnly) {
    fs.rmSync(editorOutputRoot, { recursive: true, force: true });
    fs.rmSync(materializerOutputRoot, { recursive: true, force: true });
  }
  for (const widgetType of widgetTypes) {
    const artifacts = await buildArtifacts(widgetType);
    writeOrCheck(
      path.join(editorOutputRoot, `${widgetType}.json`),
      `${JSON.stringify(artifacts.editor)}\n`,
    );
    writeOrCheck(
      path.join(materializerOutputRoot, `${widgetType}.json`),
      `${JSON.stringify(artifacts.materializer)}\n`,
    );
  }
  writeOrCheck(
    path.join(repoRoot, 'roma/generated/widget-materializer-artifacts.ts'),
    generatedMaterializerIndex(widgetTypes),
  );
  console.log(
    `[generate-widget-artifacts] ${checkOnly ? 'verified' : 'wrote'} ${widgetTypes.length} widget artifact pairs`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
