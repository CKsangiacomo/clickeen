import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readWidgetEditableFieldsContract,
  type WidgetEditableFieldsContract,
} from '../../packages/ck-contracts/src/translated-value-primitives';
import { parseLimitsSpec, type LimitsSpec } from '../../packages/ck-policy/src';
import {
  WIDGET_SHELL_CSS_MODULE_KEYS,
  WIDGET_SHELL_RUNTIME_MODULE_KEYS,
} from '../../packages/widget-shell/src';
import { compileWidgetServer } from '../../bob/lib/compiler.server';
import { buildWidgetMediaFromManifest } from '../../bob/lib/compiler/media';
import type { RawWidget } from '../../bob/lib/compiler.shared';
import type {
  ComponentStencil,
  ComponentStencilLoader,
} from '../../bob/lib/compiler/stencils';
import type {
  CompiledWidget,
  WidgetPackageContext,
  WidgetPackageFileContext,
} from '../../bob/lib/types';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const widgetsRoot = path.join(repoRoot, 'tokyo/product/widgets');
const dieterRoot = path.join(repoRoot, 'dieter/components');
const editorOutputRoot = path.join(repoRoot, 'roma/public/widget-editors');
const materializerOutputRoot = path.join(repoRoot, 'roma/generated/widgets');
const checkOnly = process.argv.includes('--check');

type MaterializerArtifact = {
  widgetname: string;
  displayName: string;
  limits: LimitsSpec;
  editableFields: WidgetEditableFieldsContract;
  controls: Array<{ path?: string }>;
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

function mediaTypeForPath(filePath: string): WidgetPackageFileContext['mediaType'] {
  if (filePath.endsWith('.json')) return 'application/json';
  if (filePath.endsWith('.html')) return 'text/html';
  if (filePath.endsWith('.css')) return 'text/css';
  return 'text/javascript';
}

const loadLocalStencil: ComponentStencilLoader = async (type): Promise<ComponentStencil> => {
  const component = type.trim();
  const componentRoot = path.join(dieterRoot, component);
  const stencilPath = path.join(componentRoot, `${component}.html`);
  if (!component || !fs.existsSync(stencilPath)) {
    throw new Error(`[generate-widget-artifacts] missing Dieter stencil: ${component}`);
  }
  const specPath = path.join(componentRoot, `${component}.spec.json`);
  return {
    stencil: fs.readFileSync(stencilPath, 'utf8'),
    ...(fs.existsSync(specPath)
      ? { spec: JSON.parse(fs.readFileSync(specPath, 'utf8')) as ComponentStencil['spec'] }
      : {}),
  };
};

function buildWidgetPackage(args: {
  widgetType: string;
  specSource: string;
  editableFieldsSource: string;
}): WidgetPackageContext {
  const files: WidgetPackageContext['files'] = {};
  const widgetRoot = `tokyo/product/widgets/${args.widgetType}`;
  for (const filename of ['spec.json', 'widget.html', 'widget.css', 'widget.client.js'] as const) {
    files[filename] = {
      mediaType: mediaTypeForPath(filename),
      source: filename === 'spec.json' ? args.specSource : readText(`${widgetRoot}/${filename}`),
    };
  }
  files['editable-fields.json'] = {
    mediaType: 'application/json',
    source: args.editableFieldsSource,
  };

  const supportKeys = new Set<string>([
    ...WIDGET_SHELL_CSS_MODULE_KEYS,
    ...WIDGET_SHELL_RUNTIME_MODULE_KEYS,
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
      throw new Error(`[generate-widget-artifacts] ${path.relative(repoRoot, filePath)} is out of date`);
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
  const widgetRoot = `tokyo/product/widgets/${widgetType}`;
  const specSource = readText(`${widgetRoot}/spec.json`);
  const editableFieldsSource = readText(`${widgetRoot}/editable-fields.json`);
  const spec = JSON.parse(specSource) as RawWidget;
  const editableFields = readWidgetEditableFieldsContract(JSON.parse(editableFieldsSource));
  const limits = parseLimitsSpec(JSON.parse(readText(`${widgetRoot}/limits.json`)));
  const manifest = JSON.parse(readText('tokyo/product/dieter/manifest.json')) as Parameters<
    typeof buildWidgetMediaFromManifest
  >[0]['manifest'];
  const compiled = await compileWidgetServer(spec, {
    loadComponentStencil: loadLocalStencil,
    buildWidgetMedia: async (args) => buildWidgetMediaFromManifest({ ...args, manifest }),
    tokyoBaseUrl: '',
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
      widgetPackage: buildWidgetPackage({ widgetType, specSource, editableFieldsSource }),
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
