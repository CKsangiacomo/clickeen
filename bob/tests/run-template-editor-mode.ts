import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readBob(path: string): Promise<string> {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

async function main() {
const [types, boot, saving, app, drawer, topDrawer, workspace] = await Promise.all([
  readBob('lib/session/sessionTypes.ts'),
  readBob('lib/session/useSessionBoot.ts'),
  readBob('lib/session/useSessionSaving.ts'),
  readBob('components/BuilderApp.tsx'),
  readBob('components/ToolDrawer.tsx'),
  readBob('components/TopDrawer.tsx'),
  readBob('components/Workspace.tsx'),
]);

assert.match(types, /isTemplate: boolean/);
assert.match(types, /'copy-code' \| 'use-template' \| 'save-as-template'/);
assert.match(types, /canSaveAsTemplate\?: boolean/);
assert.match(boot, /if \(isTemplate && \(message\.publishStatus \|\| publicActions \|\| message\.translationSetup\)\)/);
assert.match(boot, /translationSetup: isTemplate \? null/);
assert.match(boot, /canSaveAsTemplate: message\.canSaveAsTemplate === true/);
assert.match(boot, /publicPackage: isTemplate \|\| isTemplateDraft \? publicPackage : null/);
assert.match(saving, /isTemplate: meta\?\.isTemplate === true/);
assert.match(saving, /err\?\.kind === 'UPGRADE_REQUIRED'/);
assert.match(saving, /coreui\.upsell\.reason\.limitReached/);
assert.match(saving, /\.\.\.\(meta\?\.isTemplate \? \{\} : \{ baseLocale:/);
assert.match(app, /baseLocale &&\s+!isTemplate/);
assert.match(drawer, /panel\.id === 'translations'\) return !isTemplate/);
assert.match(topDrawer, />Template<\/span>/);
assert.match(topDrawer, />Use template<\/span>/);
assert.match(topDrawer, /requestHostAction\('use-template'\)/);
assert.match(topDrawer, /meta\?\.canSaveAsTemplate === true/);
assert.match(topDrawer, />Save as template<\/span>/);
assert.match(topDrawer, /requestHostAction\('save-as-template', name\)/);
assert.match(topDrawer, /const publicActions = meta\?\.publicActions \?\? null/);
assert.match(workspace, /if \(session\.publicPackage\) return;\s+setGeneratedPublicPackage\(generatedBasePackage\)/);
assert.match(workspace, /previewMode === 'editing' && session\.publicPackage\) return session\.publicPackage/);

console.log('PASS Bob template mode keeps Save/Use template and removes locale/public actions');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
