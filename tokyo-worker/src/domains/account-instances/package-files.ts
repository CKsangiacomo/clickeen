import {
  PUBLIC_INDEX_FILE,
  PUBLIC_STYLES_FILE,
  type PublicPackageFile,
} from './package-file-names';

export { isPublicPackageFile } from './package-file-names';

export type SubmittedInstancePublicPackage = {
  indexHtml: string;
  stylesCss: string;
  runtimeJs: string;
};

export function publicPackageFileBody(
  publicPackage: SubmittedInstancePublicPackage,
  file: PublicPackageFile,
): string {
  if (file === PUBLIC_INDEX_FILE) return publicPackage.indexHtml;
  if (file === PUBLIC_STYLES_FILE) return publicPackage.stylesCss;
  return publicPackage.runtimeJs;
}
