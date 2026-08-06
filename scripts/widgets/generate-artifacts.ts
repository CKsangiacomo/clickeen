import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readWidgetEditableFieldsContract,
  type WidgetEditableFieldsContract,
} from '../../packages/ck-contracts/src/translated-value-primitives';
import { parseLimitsSpec } from '../../packages/ck-policy/src';
import {
  SYSTEM_GOOGLE_FONT_RECORDS,
  WIDGET_SHELL_CSS_MODULE_KEYS,
  WIDGET_SHELL_RUNTIME_MODULE_KEYS,
} from '../../packages/widget-shell/src';
import type {
  WebCodeModuleSource,
  WidgetDefinition,
} from '../../packages/ck-web-code-generator/src/types';
import { generateInstance } from '../../packages/ck-web-code-generator/src';
import { compileWidgetServer } from '../../bob/lib/compiler.server';
import type { RawWidget } from '../../bob/lib/compiler.shared';
import type {
  ComponentStencil,
  ComponentStencilLoader,
} from '../../bob/lib/compiler/stencils';
import type {
  CompiledWidget,
  CompiledWidgetArtifact,
} from '../../bob/lib/types';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const widgetsRoot = path.join(repoRoot, 'tokyo/product/widgets');
const dieterRoot = path.join(repoRoot, 'dieter');
const dieterComponentsRoot = path.join(dieterRoot, 'components');
const editorOutputRoot = path.join(repoRoot, 'roma/public/widget-editors');
const checkOnly = process.argv.includes('--check');

type WidgetEditorArtifact = CompiledWidgetArtifact;

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

function readCssEntry(relativePath: string): string {
  const entryDir = path.posix.dirname(relativePath);
  return readText(relativePath).replace(
    /^@import url\(['"](.+?)['"]\);\s*$/gm,
    (_match, importPath: string) => readCssEntry(path.posix.join(entryDir, importPath)),
  );
}

function extractStylesheetSources(html: string): string[] {
  return [...html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => String(match[1] || '').trim())
    .filter(Boolean);
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

function stylesheetModule(args: {
  widgetType: string;
  href: string;
}): WebCodeModuleSource | null {
  const href = args.href.split(/[?#]/, 1)[0] || '';
  if (!href || href === './styles.css' || href === 'styles.css') return null;
  if (href.startsWith('/dieter/')) {
    return { id: href, source: readCssEntry(href.slice(1)) };
  }
  if (href.startsWith('/') || /^https?:\/\//i.test(href)) {
    throw new Error(`[generate-widget-artifacts] unsupported stylesheet source: ${args.href}`);
  }
  const productPath = path.posix.normalize(`product/widgets/${args.widgetType}/${href}`);
  if (!productPath.startsWith('product/widgets/') || !productPath.endsWith('.css')) {
    throw new Error(`[generate-widget-artifacts] invalid stylesheet source: ${args.href}`);
  }
  return { id: productPath, source: readText(`tokyo/${productPath}`) };
}

function buildDefinition(args: {
  widgetType: string;
  displayName: string;
  description: string;
  editableFields: WidgetEditableFieldsContract;
}): WidgetDefinition {
  const widgetRoot = `tokyo/product/widgets/${args.widgetType}`;
  const indexHtml = readText(`${widgetRoot}/index.html`);
  const styleModules = extractStylesheetSources(indexHtml)
    .map((href) => stylesheetModule({ widgetType: args.widgetType, href }))
    .filter((module): module is WebCodeModuleSource => Boolean(module));
  const linkedIds = new Set(styleModules.map((module) => module.id));
  for (const requiredKey of WIDGET_SHELL_CSS_MODULE_KEYS) {
    if (!linkedIds.has(requiredKey)) {
      throw new Error(
        `[generate-widget-artifacts] ${args.widgetType} index.html is missing shared stylesheet ${requiredKey}`,
      );
    }
  }
  return {
    widgetType: args.widgetType,
    displayName: args.displayName,
    description: args.description,
    editableFields: args.editableFields,
    files: {
      'index.html': indexHtml,
      'styles.css': readText(`${widgetRoot}/styles.css`),
      'runtime.js': readText(`${widgetRoot}/runtime.js`),
    },
    styleModules,
    runtimeModules: WIDGET_SHELL_RUNTIME_MODULE_KEYS.map((id) => ({
      id,
      source: readText(`tokyo/${id}`),
    })),
  };
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

async function buildArtifact(widgetType: string): Promise<WidgetEditorArtifact> {
  const widgetRoot = `tokyo/product/widgets/${widgetType}`;
  const specSource = readText(`${widgetRoot}/spec.json`);
  const editableFieldsSource = readText(`${widgetRoot}/editable-fields.json`);
  const specValue = JSON.parse(specSource) as RawWidget & { description?: unknown };
  const spec = specValue as RawWidget;
  const description = typeof specValue.description === 'string' ? specValue.description.trim() : '';
  if (!description) {
    throw new Error(`[generate-widget-artifacts] ${widgetType} spec.json description is required`);
  }
  const editableFields = readWidgetEditableFieldsContract(JSON.parse(editableFieldsSource));
  const limits = parseLimitsSpec(JSON.parse(readText(`${widgetRoot}/limits.json`)));
  const compiled = await compileWidgetServer(spec, {
    loadComponentStencil: loadLocalStencil,
    tokyoBaseUrl: '',
  });
  assertProductReadableControls(widgetType, compiled.controls);
  const artifact: WidgetEditorArtifact = {
    ...compiled,
    limits,
    editableFields,
    definition: buildDefinition({
      widgetType,
      displayName: compiled.displayName,
      description,
      editableFields,
    }),
  };
  generateInstance({
    definition: artifact.definition,
    source: artifact.defaults,
    baseLocale: 'en-US',
    overlays: null,
    settings: {
      seoGeoAeoEnabled: false,
      includeClickeenAttribution: true,
    },
    context: {
      assetsByRef: {},
      typography: {
        curatedFonts: {
          Inter: {
            source: 'google',
            spec: SYSTEM_GOOGLE_FONT_RECORDS.Inter.spec,
            familyClass: 'sans',
            weights: [...SYSTEM_GOOGLE_FONT_RECORDS.Inter.weights],
            styles: [...SYSTEM_GOOGLE_FONT_RECORDS.Inter.styles],
          },
        },
      },
    },
  });
  return artifact;
}

async function main(): Promise<void> {
  const widgetTypes = discoverWidgetTypes();
  if (!checkOnly) {
    fs.rmSync(editorOutputRoot, { recursive: true, force: true });
  }
  for (const widgetType of widgetTypes) {
    const artifact = await buildArtifact(widgetType);
    writeOrCheck(
      path.join(editorOutputRoot, `${widgetType}.json`),
      `${JSON.stringify(artifact)}\n`,
    );
  }
  console.log(
    `[generate-widget-artifacts] ${checkOnly ? 'verified' : 'wrote'} ${widgetTypes.length} browser editor artifacts`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
