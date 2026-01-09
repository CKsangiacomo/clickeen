// DevStudio consumes the Prague-owned registry so dropdown options stay aligned
// with the website's canonical page/block structure as it grows.
//
// This is intentionally a thin re-export to keep "ownership" and updates in Prague.
export { CREATIVE_PAGES, CREATIVE_SLOTS_BY_PAGE, type CreativePage } from '../../../prague/src/lib/websiteCreativeRegistry';

export function composeWebsiteCreativeKey(opts: { widgetType: string; page: string; slot: string }): string {
  return `${opts.widgetType}.${opts.page}.${opts.slot}`;
}

export function composeWebsiteCreativePublicId(opts: { creativeKey: string }): string {
  return `wgt_web_${opts.creativeKey}`;
}
