import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
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

function staticObjectKeys(widgetType: string, object: ts.ObjectLiteralExpression): Set<string> {
  const keys = new Set<string>();
  for (const property of object.properties) {
    if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) {
      throw new Error(
        `[generate-widget-artifacts] ${widgetType} typography role map must use static properties`,
      );
    }
    const name = property.name;
    if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
      keys.add(name.text);
      continue;
    }
    throw new Error(
      `[generate-widget-artifacts] ${widgetType} typography role map contains a dynamic key`,
    );
  }
  return keys;
}

function assignedPropertyName(
  widgetType: string,
  left: ts.Expression,
  identifier: string,
): string | null {
  if (ts.isPropertyAccessExpression(left) && ts.isIdentifier(left.expression) && left.expression.text === identifier) {
    return left.name.text;
  }
  if (ts.isElementAccessExpression(left) && ts.isIdentifier(left.expression) && left.expression.text === identifier) {
    if (left.argumentExpression && ts.isStringLiteral(left.argumentExpression)) {
      return left.argumentExpression.text;
    }
    throw new Error(
      `[generate-widget-artifacts] ${widgetType} typography role map contains a dynamic assignment`,
    );
  }
  return null;
}

function containingFunction(node: ts.Node): ts.Node {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (
      ts.isFunctionDeclaration(current) ||
      ts.isFunctionExpression(current) ||
      ts.isArrowFunction(current) ||
      ts.isMethodDeclaration(current)
    ) {
      return current;
    }
    current = current.parent;
  }
  return node.getSourceFile();
}

function isRuntimeTypographyCall(node: ts.CallExpression): boolean {
  if (
    !ts.isPropertyAccessExpression(node.expression) ||
    node.expression.name.text !== 'applyTypography'
  ) {
    return false;
  }
  const owner = node.expression.expression;
  return (
    ts.isPropertyAccessExpression(owner) &&
    owner.name.text === 'CKTypography' &&
    ts.isIdentifier(owner.expression) &&
    owner.expression.text === 'window'
  );
}

function readRuntimeTypographyRoleKeys(widgetType: string, source: string): Set<string> {
  const sourceFile = ts.createSourceFile(
    `${widgetType}.widget.client.js`,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const runtimeCalls: ts.CallExpression[] = [];
  const visitCalls = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && isRuntimeTypographyCall(node)) {
      const roleArgument = node.arguments[2];
      if (!roleArgument) {
        throw new Error(
          `[generate-widget-artifacts] ${widgetType} applyTypography is missing its role map`,
        );
      }
      runtimeCalls.push(node);
    }
    ts.forEachChild(node, visitCalls);
  };
  visitCalls(sourceFile);
  if (runtimeCalls.length !== 1) {
    throw new Error(
      `[generate-widget-artifacts] ${widgetType} must call applyTypography exactly once`,
    );
  }

  const runtimeCall = runtimeCalls[0]!;
  const roleArgument = runtimeCall.arguments[2]!;
  if (ts.isObjectLiteralExpression(roleArgument)) {
    return staticObjectKeys(widgetType, roleArgument);
  }
  if (!ts.isIdentifier(roleArgument)) {
    throw new Error(
      `[generate-widget-artifacts] ${widgetType} applyTypography role map must be a static object`,
    );
  }

  const identifier = roleArgument.text;
  const runtimeScope = containingFunction(runtimeCall);
  const declarations: ts.ObjectLiteralExpression[] = [];
  const visitDeclarations = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === identifier &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer) &&
      containingFunction(node) === runtimeScope &&
      node.getStart(sourceFile) < runtimeCall.getStart(sourceFile)
    ) {
      declarations.push(node.initializer);
    }
    ts.forEachChild(node, visitDeclarations);
  };
  visitDeclarations(sourceFile);
  if (declarations.length !== 1) {
    throw new Error(
      `[generate-widget-artifacts] ${widgetType} typography role map "${identifier}" must have one static declaration`,
    );
  }

  const keys = staticObjectKeys(widgetType, declarations[0]!);
  const visitAssignments = (node: ts.Node): void => {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken
    ) {
      const key = assignedPropertyName(widgetType, node.left, identifier);
      if (
        key &&
        containingFunction(node) === runtimeScope &&
        node.getStart(sourceFile) < runtimeCall.getStart(sourceFile)
      ) {
        keys.add(key);
      }
    }
    ts.forEachChild(node, visitAssignments);
  };
  visitAssignments(sourceFile);
  return keys;
}

function assertRuntimeTypographyRoles(
  widgetType: string,
  compiled: CompiledWidget,
  widgetClientSource: string,
): void {
  const typography = compiled.defaults.typography;
  if (!typography || typeof typography !== 'object' || Array.isArray(typography)) {
    throw new Error(`[generate-widget-artifacts] ${widgetType} is missing composed typography`);
  }
  const roles = (typography as Record<string, unknown>).roles;
  if (!roles || typeof roles !== 'object' || Array.isArray(roles)) {
    throw new Error(`[generate-widget-artifacts] ${widgetType} is missing composed typography roles`);
  }
  const compiledKeys = Object.keys(roles).sort();
  const runtimeKeys = Array.from(
    readRuntimeTypographyRoleKeys(widgetType, widgetClientSource),
  ).sort();
  if (
    compiledKeys.length !== runtimeKeys.length ||
    compiledKeys.some((key, index) => key !== runtimeKeys[index])
  ) {
    throw new Error(
      `[generate-widget-artifacts] ${widgetType} typography role mismatch: compiled=${compiledKeys.join(',')} runtime=${runtimeKeys.join(',')}`,
    );
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
  const compiled = await compileWidgetServer(spec, {
    loadComponentStencil: loadLocalStencil,
    tokyoBaseUrl: '',
  });
  assertProductReadableControls(widgetType, compiled.controls);
  assertRuntimeTypographyRoles(
    widgetType,
    compiled,
    readText(`${widgetRoot}/widget.client.js`),
  );
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
