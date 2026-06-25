import type { RuntimeMaterializerFileSet } from './types';

function hexFromBytes(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function buildRuntimePackageFingerprint(files: RuntimeMaterializerFileSet): Promise<string> {
  const encoder = new TextEncoder();
  const payload = [
    `index.html:${files.indexHtml.length}`,
    files.indexHtml,
    `styles.css:${files.stylesCss.length}`,
    files.stylesCss,
    `runtime.js:${files.runtimeJs.length}`,
    files.runtimeJs,
  ].join('\n');
  return `sha256:${hexFromBytes(await crypto.subtle.digest('SHA-256', encoder.encode(payload)))}`;
}
