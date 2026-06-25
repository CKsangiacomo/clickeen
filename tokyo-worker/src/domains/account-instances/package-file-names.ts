export const PUBLIC_INDEX_FILE = 'index.html';
export const PUBLIC_STYLES_FILE = 'styles.css';
export const PUBLIC_RUNTIME_FILE = 'runtime.js';

export const PUBLIC_PACKAGE_FILES = new Set([
  PUBLIC_INDEX_FILE,
  PUBLIC_STYLES_FILE,
  PUBLIC_RUNTIME_FILE,
]);

export type PublicPackageFile =
  | typeof PUBLIC_INDEX_FILE
  | typeof PUBLIC_STYLES_FILE
  | typeof PUBLIC_RUNTIME_FILE;

export function isPublicPackageFile(file: string): file is PublicPackageFile {
  if (!file || file.startsWith('.') || file.includes('/') || file.includes('\\')) return false;
  if (file.includes('%') || file.includes('..')) return false;
  return PUBLIC_PACKAGE_FILES.has(file);
}
