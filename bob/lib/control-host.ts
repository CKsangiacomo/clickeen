/**
 * Control-host presentation seam shared with surfaces that render compiled
 * Builder controls WITHOUT Bob's live editor pipeline — currently Roma
 * `Settings > Widget Defaults` (PRD106A3: reuse Builder control presentation,
 * do not hand-code a Roma-only control model).
 *
 * This exports ONLY the presentation/hydration atoms:
 *   - runHydrators: activate Dieter controls inside a rendered container
 *   - DieterHydratorDeps / AccountAssetsClient types
 *
 * It deliberately does NOT export Bob's session, applyOps, preview, or upsell
 * machinery. Consumers bind values to their own document by `data-bob-path`.
 *
 * Source of the utilities: bob/components/td-menu-content/dom.ts, which is pure
 * DOM manipulation (no widget-session dependency).
 */
import type { AccountAssetsClient } from '../../dieter/components/shared/account-assets';

export {
  applyClusterGroupHeaders,
  applyGroupHeaders,
  controlHostClusterId,
  installClusterCollapseBehavior,
  namespaceControlHostClusterIds,
  runHydrators,
} from '../components/td-menu-content/dom';
export { BOB_WIDGET_PANEL_IDS } from './types';
export type { DieterHydratorDeps } from '../components/td-menu-content/dom';
export {
  applyShowIfVisibility,
  buildShowIfEntries,
} from '../components/td-menu-content/showIf';
export type { ShowIfEntry } from '../components/td-menu-content/showIf';
export {
  parseBobJsonValue,
  resolvePathFromTarget,
  serializeBobJsonFieldValue,
} from '../components/td-menu-content/fieldValue';
export { applyAccountFontLibraryToTypographyMenus } from '../components/td-menu-content/accountFonts';
export {
  expandTypographyFamilyOps,
} from './edit/typography-family-ops';
export type { AccountAssetsClient };
