export const PUBLIC_INDEX_FILE = 'index.html';
export const PUBLIC_STYLES_FILE = 'styles.css';
export const PUBLIC_RUNTIME_FILE = 'runtime.js';

export const GENERATED_PUBLIC_ARTIFACT_FILES = new Set([
  PUBLIC_INDEX_FILE,
  PUBLIC_STYLES_FILE,
  PUBLIC_RUNTIME_FILE,
]);

const OBSOLETE_GENERATED_PUBLIC_ARTIFACT_PATTERNS: ReadonlyArray<RegExp> = [
  /^script\.js$/,
  /^script\.[a-z0-9][a-z0-9-]{0,19}\.js$/,
  /^script\.v[1-9][0-9]*(?:\.[a-z0-9][a-z0-9-]{0,19})?\.js$/,
  /^styles\.v[1-9][0-9]*\.css$/,
  /^[a-z0-9][a-z0-9-]{0,19}\.html$/,
];

export function isGeneratedPublicArtifactFile(file: string): boolean {
  if (!file || file.startsWith('.') || file.includes('/') || file.includes('\\')) return false;
  if (file.includes('%') || file.includes('..')) return false;
  return GENERATED_PUBLIC_ARTIFACT_FILES.has(file);
}

export function isGeneratedOrObsoletePublicArtifactFile(file: string): boolean {
  if (isGeneratedPublicArtifactFile(file)) return true;
  if (!file || file.startsWith('.') || file.includes('/') || file.includes('\\')) return false;
  if (file.includes('%') || file.includes('..')) return false;
  if (file === PUBLIC_INDEX_FILE) return false;
  return OBSOLETE_GENERATED_PUBLIC_ARTIFACT_PATTERNS.some((pattern) => pattern.test(file));
}
