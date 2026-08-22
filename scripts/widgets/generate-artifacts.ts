import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readWidgetEditableFieldsContract,
  type WidgetEditableFieldsContract,
} from '../../packages/ck-contracts/src/translated-value-primitives';
import { parseLimitsSpec, type LimitsSpec } from '../../packages/ck-policy/src';
import {
  COMMON_WIDGET_TYPOGRAPHY_BEHAVIOR_ROLES,
  WIDGET_TYPOGRAPHY_SCRIPTS,
  compileWidgetSoftware,
  type WidgetSoftware,
  type WidgetTypographyBehavior,
  type WidgetTypographyRoleBehavior,
} from '../../packages/widget-foundation/src';
import {
  extractBody,
  extractStylesheetSources,
  stripScripts,
} from '../../packages/ck-runtime-materializer/src/html';
import { resolveProductPath } from '../../packages/ck-runtime-materializer/src/files';
import { compileWidgetServer } from '../../bob/lib/compiler.server';
import type { RawWidget } from '../../bob/lib/compiler.shared';
import type { ComponentStencil, ComponentStencilLoader } from '../../bob/lib/compiler/stencils';
import { resolveWidgetTooldrawerLabels } from '../../bob/lib/compiler/tooldrawer-labels';
import type {
  CompiledWidget,
  WidgetDiscoveryContract,
  WidgetUpsellCatalog,
} from '../../bob/lib/types';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const widgetsRoot = path.join(repoRoot, 'tokyo/product/widgets');
const dieterRoot = path.join(repoRoot, 'dieter');
const dieterComponentsRoot = path.join(dieterRoot, 'components');
const editorOutputRoot = path.join(repoRoot, 'roma/public/widget-editors');
const materializerOutputRoot = path.join(repoRoot, 'roma/public/widget-materializers');
const definitionOutputPath = path.join(
  repoRoot,
  'tokyo-worker/src/generated/widget-definition-sources.ts',
);
const checkOnly = process.argv.includes('--check');
const requestedWidgetType = (() => {
  const index = process.argv.indexOf('--widget');
  if (index < 0) return null;
  const value = String(process.argv[index + 1] || '').trim();
  if (!value) throw new Error('[generate-widget-artifacts] --widget requires a Widget type');
  return value;
})();

type MaterializerArtifact = {
  widgetname: string;
  displayName: string;
  discovery: WidgetDiscoveryContract;
  editableFields: WidgetEditableFieldsContract;
  coreDefaults: Record<string, unknown>;
  widgetSoftware: WidgetSoftware;
};

type CompactWidgetDefinition = {
  widgetType: string;
  displayName: string;
  description: string;
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

function readSourceRecord(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`[generate-widget-artifacts] ${context} must be an object`);
  }
  return value as Record<string, unknown>;
}

function readSourceString(value: unknown, context: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`[generate-widget-artifacts] ${context} must be a non-empty string`);
  }
  return value;
}

function readSourceStringArray(value: unknown, context: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`[generate-widget-artifacts] ${context} must be an array`);
  }
  return value.map((item, index) => readSourceString(item, `${context}[${index}]`));
}

function readWidgetUpsellCatalog(
  raw: unknown,
  widgetType: string,
  limits: LimitsSpec,
): WidgetUpsellCatalog {
  const source = readSourceRecord(raw, `${widgetType} upsell/en.json`);
  if (source.widgetType !== widgetType || source.locale !== 'en') {
    throw new Error(
      `[generate-widget-artifacts] ${widgetType} upsell/en.json must declare widgetType ${widgetType} and locale en`,
    );
  }
  const rawMessages = readSourceRecord(source.messages, `${widgetType} upsell/en.json messages`);
  const messages = Object.fromEntries(
    Object.entries(rawMessages).map(([messageId, value]) => {
      const message = readSourceString(value, `${widgetType} upsell/en.json message ${messageId}`);
      const unsupportedPlaceholder = [...message.matchAll(/\{([^{}]+)\}/g)]
        .map((match) => String(match[1]))
        .find((placeholder) => placeholder !== 'currentPlan' && placeholder !== 'targetPlan');
      const remainder = message.replace(/\{(?:currentPlan|targetPlan)\}/g, '');
      if (unsupportedPlaceholder || /[{}]/.test(remainder)) {
        throw new Error(
          `[generate-widget-artifacts] ${widgetType} upsell message ${messageId} has an unsupported placeholder`,
        );
      }
      return [messageId, message];
    }),
  );
  const referencedMessageIds = new Set(limits.limits.map((limit) => limit.messageId));
  const authoredMessageIds = new Set(Object.keys(messages));
  const missingMessageIds = [...referencedMessageIds].filter(
    (messageId) => !authoredMessageIds.has(messageId),
  );
  const unusedMessageIds = [...authoredMessageIds].filter(
    (messageId) => !referencedMessageIds.has(messageId),
  );
  if (missingMessageIds.length || unusedMessageIds.length) {
    throw new Error(
      `[generate-widget-artifacts] ${widgetType} upsell message ids must exactly match limits.json`,
    );
  }
  return { widgetType, locale: 'en', messages };
}

function readWidgetDiscoveryContract(raw: unknown, widgetType: string): WidgetDiscoveryContract {
  const source = readSourceRecord(raw, `${widgetType} discovery.json`);
  if (source.widgetType !== widgetType) {
    throw new Error(
      `[generate-widget-artifacts] ${widgetType} discovery.json must declare widgetType ${widgetType}`,
    );
  }
  const baseline = readSourceRecord(source.baseline, `${widgetType} discovery.json baseline`);
  if (!Array.isArray(source.parts) || !Array.isArray(source.relationships)) {
    throw new Error(
      `[generate-widget-artifacts] ${widgetType} discovery.json must declare parts and relationships arrays`,
    );
  }
  return {
    widgetType,
    kind: readSourceString(source.kind, `${widgetType} discovery.json kind`),
    baseline: {
      title: readSourceString(baseline.title, `${widgetType} discovery.json baseline.title`),
      description: readSourceString(
        baseline.description,
        `${widgetType} discovery.json baseline.description`,
      ),
    },
    parts: source.parts.map((value, index) => {
      const part = readSourceRecord(value, `${widgetType} discovery.json parts[${index}]`);
      return {
        id: readSourceString(part.id, `${widgetType} discovery.json parts[${index}].id`),
        path: readSourceString(part.path, `${widgetType} discovery.json parts[${index}].path`),
        role: readSourceString(part.role, `${widgetType} discovery.json parts[${index}].role`),
        identityPaths: readSourceStringArray(
          part.identityPaths,
          `${widgetType} discovery.json parts[${index}].identityPaths`,
        ),
      };
    }),
    relationships: source.relationships.map((value, index) => {
      const relationship = readSourceRecord(
        value,
        `${widgetType} discovery.json relationships[${index}]`,
      );
      return {
        kind: readSourceString(
          relationship.kind,
          `${widgetType} discovery.json relationships[${index}].kind`,
        ),
        from: readSourceString(
          relationship.from,
          `${widgetType} discovery.json relationships[${index}].from`,
        ),
        to: readSourceString(
          relationship.to,
          `${widgetType} discovery.json relationships[${index}].to`,
        ),
        identityPaths: readSourceStringArray(
          relationship.identityPaths,
          `${widgetType} discovery.json relationships[${index}].identityPaths`,
        ),
      };
    }),
  };
}

function readHtmlAttribute(openingTag: string, attrName: string): string {
  const escapedAttr = attrName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = openingTag.match(
    new RegExp(`\\s${escapedAttr}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'),
  );
  return String(match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim();
}

function assertWidgetShellContract(widgetType: string, widgetHtml: string, coreCss: string): void {
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
  for (const rule of coreCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
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
          `[generate-widget-artifacts] ${widgetType} core/core.css must not set display on its Shell; shared/header.css owns .ck-headerLayout layout`,
        );
      }
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

function requireExactSourceKeys(
  source: Record<string, unknown>,
  expected: readonly string[],
  context: string,
): void {
  const actual = Object.keys(source).sort();
  const exact = [...expected].sort();
  if (actual.length !== exact.length || actual.some((key, index) => key !== exact[index])) {
    throw new Error(
      `[generate-widget-artifacts] ${context} keys must be exactly ${exact.join(', ')}`,
    );
  }
}

function readWidgetTypographyBehavior(args: {
  widgetType: string;
  source: unknown;
  compiledDefaults: Record<string, unknown>;
}): WidgetTypographyBehavior {
  const sourceRoles = (() => {
    if (args.source === undefined) return {};
    const source = readSourceRecord(args.source, `${args.widgetType} typographyBehavior`);
    requireExactSourceKeys(source, ['roles'], `${args.widgetType} typographyBehavior`);
    return readSourceRecord(source.roles, `${args.widgetType} typographyBehavior.roles`);
  })();
  const commonRoleKeys = new Set(Object.keys(COMMON_WIDGET_TYPOGRAPHY_BEHAVIOR_ROLES));
  const typography = readSourceRecord(
    args.compiledDefaults.typography,
    `${args.widgetType} composed defaults.typography`,
  );
  const composedRoles = readSourceRecord(
    typography.roles,
    `${args.widgetType} composed defaults.typography.roles`,
  );
  const expectedUniqueRoleKeys = Object.keys(composedRoles)
    .filter((roleKey) => !commonRoleKeys.has(roleKey))
    .sort();
  requireExactSourceKeys(
    sourceRoles,
    expectedUniqueRoleKeys,
    `${args.widgetType} typographyBehavior.roles`,
  );

  const uniqueRoles = Object.fromEntries(
    Object.entries(sourceRoles).map(([roleKey, value]) => {
      const context = `${args.widgetType} typographyBehavior.roles.${roleKey}`;
      const role = readSourceRecord(value, context);
      requireExactSourceKeys(role, ['fluidSize', 'normalLineHeight'], context);
      const fluidSize = role.fluidSize;
      if (fluidSize !== 'min-plus-growth' && fluidSize !== 'proportional') {
        throw new Error(
          `[generate-widget-artifacts] ${context}.fluidSize must be min-plus-growth or proportional`,
        );
      }
      const normalLineHeight = readSourceRecord(
        role.normalLineHeight,
        `${context}.normalLineHeight`,
      );
      requireExactSourceKeys(
        normalLineHeight,
        WIDGET_TYPOGRAPHY_SCRIPTS,
        `${context}.normalLineHeight`,
      );
      const completeLineHeight = Object.fromEntries(
        WIDGET_TYPOGRAPHY_SCRIPTS.map((script) => [
          script,
          readSourceString(normalLineHeight[script], `${context}.normalLineHeight.${script}`),
        ]),
      ) as WidgetTypographyRoleBehavior['normalLineHeight'];
      return [roleKey, { fluidSize, normalLineHeight: completeLineHeight }];
    }),
  ) as WidgetTypographyBehavior['roles'];
  const roles: WidgetTypographyBehavior['roles'] = {
    ...COMMON_WIDGET_TYPOGRAPHY_BEHAVIOR_ROLES,
    ...uniqueRoles,
  };
  requireExactSourceKeys(
    roles,
    Object.keys(composedRoles),
    `${args.widgetType} emitted typographyBehavior.roles`,
  );
  return { roles };
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

function buildWidgetSoftware(
  widgetType: string,
  typographyBehavior: WidgetTypographyBehavior,
): WidgetSoftware {
  const widgetDirectory = `tokyo/product/widgets/${widgetType}`;
  const widgetHtml = readText(`${widgetDirectory}/widget.html`);
  const coreHtml = readText(`${widgetDirectory}/core/core.html`);
  const coreCss = readText(`${widgetDirectory}/core/core.css`);
  const coreJs = readText(`${widgetDirectory}/core/core.js`);
  const composedWidgetHtml = widgetHtml.replace(/{{>\s*core\s*}}/, coreHtml);
  assertWidgetShellContract(widgetType, composedWidgetHtml, coreCss);
  const styles: WidgetSoftware['styles'] = [];
  const scripts: WidgetSoftware['scripts'] = [];
  for (const href of extractStylesheetSources(widgetHtml)) {
    const key = href.startsWith('/') ? href : resolveProductPath(widgetType, href);
    if (!key) continue;
    const source = href.startsWith('/') ? readCssEntry(href.slice(1)) : readText(`tokyo/${key}`);
    styles.push({ path: href, source });
  }
  for (const src of stripScripts(extractBody(widgetHtml)).scriptSources) {
    const key = resolveProductPath(widgetType, src);
    if (!key) continue;
    const source = readText(`tokyo/${key}`);
    scripts.push({ path: src, source });
  }
  return compileWidgetSoftware({ widgetHtml, coreHtml, typographyBehavior, styles, scripts });
}

function writeGenerated(filePath: string, source: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, source);
}

function assertTrackedGeneratedSource(filePath: string, source: string): void {
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  if (current !== source) {
    throw new Error(
      `[generate-widget-artifacts] ${path.relative(repoRoot, filePath)} is out of date`,
    );
  }
}

function generatedMaterializerIndex(widgetTypes: string[]): string {
  const entries = widgetTypes
    .map((widgetType) => `  ['${widgetType}', '/widget-materializers/${widgetType}.json'],`)
    .join('\n');
  return `// Generated by scripts/widgets/generate-artifacts.ts. Do not edit manually.
import type { CompiledWidget, WidgetDiscoveryContract } from '../../bob/lib/types';
import { getCloudflareRequestContext } from '../lib/cloudflare-request-context';

export type WidgetMaterializerArtifact = {
  widgetname: string;
  displayName: string;
  discovery: WidgetDiscoveryContract;
  editableFields: NonNullable<CompiledWidget['editableFields']>;
  coreDefaults: Record<string, unknown>;
  widgetSoftware: CompiledWidget['widgetSoftware'];
};

type RomaStaticAssetsBinding = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

const WIDGET_MATERIALIZER_ARTIFACT_PATHS = new Map<string, string>([
${entries}
]);

export async function readWidgetMaterializerArtifact(widgetType: string): Promise<WidgetMaterializerArtifact | null> {
  const path = WIDGET_MATERIALIZER_ARTIFACT_PATHS.get(widgetType);
  if (!path) return null;
  const context = getCloudflareRequestContext<{ env: { ASSETS: RomaStaticAssetsBinding } }>();
  const response = await context.env.ASSETS.fetch(new URL(path, 'https://roma-static.internal'));
  if (!response.ok) {
    throw new Error(\`roma.widgetMaterializer.assetUnavailable:\${path}:\${response.status}\`);
  }
  return response.json() as Promise<WidgetMaterializerArtifact>;
}
`;
}

function generatedWidgetDefinitions(definitions: CompactWidgetDefinition[]): string {
  return `// Generated by scripts/widgets/generate-artifacts.ts. Do not edit manually.
// This compact source is build-packaged Tokyo Widget catalog truth; it is not product state.

export type WidgetDefinition = {
  widgetType: string;
  displayName: string;
  description: string;
};

export const WIDGET_DEFINITIONS = ${JSON.stringify(definitions, null, 2)} as const satisfies readonly WidgetDefinition[];
`;
}

function readCompactWidgetDefinition(widgetType: string, spec: RawWidget): CompactWidgetDefinition {
  if (
    typeof spec.displayName !== 'string' ||
    typeof (spec as { description?: unknown }).description !== 'string'
  ) {
    throw new Error(
      `[generate-widget-artifacts] ${widgetType} spec.json must declare string displayName and description`,
    );
  }
  return {
    widgetType,
    displayName: spec.displayName,
    description: (spec as { description: string }).description,
  };
}

async function buildArtifacts(
  widgetType: string,
  spec: RawWidget,
): Promise<{
  editor: CompiledWidget;
  materializer: MaterializerArtifact;
}> {
  const widgetDirectory = `tokyo/product/widgets/${widgetType}`;
  const discoverySource = readText(`${widgetDirectory}/discovery.json`);
  const editableFieldsSource = readText(`${widgetDirectory}/editable-fields.json`);
  const limitsSource = readText(`${widgetDirectory}/limits.json`);
  const upsellSource = readText(`${widgetDirectory}/upsell/en.json`);
  const tooldrawerLabelsRelativePath = 'labels/en.json';
  const tooldrawerLabelsSource = readText(`${widgetDirectory}/${tooldrawerLabelsRelativePath}`);
  const tooldrawerLabels = JSON.parse(tooldrawerLabelsSource) as unknown;
  const resolved = resolveWidgetTooldrawerLabels(spec, tooldrawerLabels);
  const resolvedWidget = resolved.widget;
  if (!resolvedWidget.defaults) {
    throw new Error(`[generate-widget-artifacts] ${widgetType} resolved defaults are missing`);
  }
  const editableFields = readWidgetEditableFieldsContract(JSON.parse(editableFieldsSource));
  const limits = parseLimitsSpec(JSON.parse(limitsSource));
  const upsell = readWidgetUpsellCatalog(JSON.parse(upsellSource), widgetType, limits);
  const discovery = readWidgetDiscoveryContract(JSON.parse(discoverySource), widgetType);
  const compiled = await compileWidgetServer(resolved, {
    loadComponentStencil: loadLocalStencil,
    tokyoBaseUrl: '',
  });
  const widgetSoftware = buildWidgetSoftware(
    widgetType,
    readWidgetTypographyBehavior({
      widgetType,
      source: spec.typographyBehavior,
      compiledDefaults: compiled.defaults,
    }),
  );
  return {
    editor: {
      ...compiled,
      coreDefaults: resolvedWidget.defaults,
      limits,
      editableFields,
      upsell,
      widgetSoftware,
    },
    materializer: {
      widgetname: compiled.widgetname,
      displayName: compiled.displayName,
      discovery,
      editableFields,
      coreDefaults: resolvedWidget.defaults,
      widgetSoftware,
    },
  };
}

async function main(): Promise<void> {
  const allWidgetTypes = discoverWidgetTypes();
  if (requestedWidgetType && !allWidgetTypes.includes(requestedWidgetType)) {
    throw new Error(`[generate-widget-artifacts] unknown Widget type ${requestedWidgetType}`);
  }
  const widgetTypes = requestedWidgetType ? [requestedWidgetType] : allWidgetTypes;
  const specs = new Map(
    allWidgetTypes.map((widgetType) => [
      widgetType,
      JSON.parse(readText(`tokyo/product/widgets/${widgetType}/spec.json`)) as RawWidget,
    ]),
  );
  const definitions = allWidgetTypes.map((widgetType) =>
    readCompactWidgetDefinition(widgetType, specs.get(widgetType)!),
  );
  if (!checkOnly && !requestedWidgetType) {
    fs.rmSync(editorOutputRoot, { recursive: true, force: true });
    fs.rmSync(materializerOutputRoot, { recursive: true, force: true });
  }
  for (const widgetType of widgetTypes) {
    const artifacts = await buildArtifacts(widgetType, specs.get(widgetType)!);
    const editorSource = `${JSON.stringify(artifacts.editor)}\n`;
    const materializerSource = `${JSON.stringify(artifacts.materializer)}\n`;
    if (!checkOnly) {
      writeGenerated(path.join(editorOutputRoot, `${widgetType}.json`), editorSource);
      writeGenerated(path.join(materializerOutputRoot, `${widgetType}.json`), materializerSource);
    }
  }
  const materializerIndexSource = generatedMaterializerIndex(allWidgetTypes);
  const definitionSource = generatedWidgetDefinitions(definitions);
  if (checkOnly) {
    assertTrackedGeneratedSource(definitionOutputPath, definitionSource);
  } else {
    writeGenerated(
      path.join(repoRoot, 'roma/generated/widget-materializer-artifacts.ts'),
      materializerIndexSource,
    );
    writeGenerated(definitionOutputPath, definitionSource);
  }
  console.log(
    `[generate-widget-artifacts] ${checkOnly ? 'verified' : 'wrote'} ${widgetTypes.length} widget artifact pairs`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
