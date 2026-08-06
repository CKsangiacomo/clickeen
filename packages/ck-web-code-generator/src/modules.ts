import {
  WIDGET_SHELL_RUNTIME_MODULE_END,
  WIDGET_SHELL_STYLE_CHUNK_END,
} from '@clickeen/widget-shell';
import type { WebCodeModuleSource } from './types';

function markerId(value: string): string {
  return value
    .replace(/^product\/widgets\//, '')
    .replace(/[^A-Za-z0-9_.:-]+/g, '-');
}

function requireModules(modules: WebCodeModuleSource[], kind: string): WebCodeModuleSource[] {
  if (!Array.isArray(modules)) throw new Error(`ck.web_code.${kind}_modules_invalid`);
  const seen = new Set<string>();
  return modules.map((module) => {
    if (!module || typeof module.id !== 'string' || !module.id.trim() || typeof module.source !== 'string' || !module.source.trim()) {
      throw new Error(`ck.web_code.${kind}_module_invalid`);
    }
    if (seen.has(module.id)) throw new Error(`ck.web_code.${kind}_module_duplicate:${module.id}`);
    seen.add(module.id);
    return module;
  });
}

export function assembleStyles(
  modules: WebCodeModuleSource[],
  authoredStyles: string,
  widgetType: string,
): string {
  const sources = [
    ...requireModules(modules, 'style'),
    { id: `product/widgets/${widgetType}/styles.css`, source: authoredStyles },
  ];
  return `${sources
    .map((module) => `/* ck-style-module:${markerId(module.id)} */\n${module.source}\n${WIDGET_SHELL_STYLE_CHUNK_END}`)
    .join('\n\n')}\n`;
}

export function assembleRuntime(
  modules: WebCodeModuleSource[],
  authoredRuntime: string,
  widgetType: string,
): string {
  const sources = requireModules(modules, 'runtime');
  sources.push({ id: `product/widgets/${widgetType}/runtime.js`, source: authoredRuntime });
  return `${sources
    .map((module) => `/* ck-runtime-module:${markerId(module.id)} */\n${module.source}\n${WIDGET_SHELL_RUNTIME_MODULE_END}`)
    .join('\n\n')}\n`;
}
