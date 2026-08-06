import { json } from './http.js';

const COMPACT_ID_RE = /^[0-9A-Z]{10}$/;

export function isCompactCatalogId(value) {
  return typeof value === 'string' && COMPACT_ID_RE.test(value);
}

export function readCatalogPresentation(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (
    Object.keys(raw).length !== 4 ||
    typeof raw.thumbnailAssetRef !== 'string' ||
    !raw.thumbnailAssetRef.startsWith('/assets/account/CLICKEEN/') ||
    typeof raw.description !== 'string' ||
    !raw.description.trim() ||
    typeof raw.category !== 'string' ||
    !raw.category.trim() ||
    !Number.isInteger(raw.displayOrder) ||
    raw.displayOrder < 0
  ) return null;
  return {
    thumbnailAssetRef: raw.thumbnailAssetRef,
    description: raw.description,
    category: raw.category,
    displayOrder: raw.displayOrder,
  };
}

export async function readExactJson(request, keys) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return null;
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const actual = Object.keys(payload).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
    ? payload
    : null;
}

export function invalidPayload() {
  return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' } }, 422);
}

export function invalidUpstream(detail) {
  return json({
    error: {
      kind: 'UPSTREAM_UNAVAILABLE',
      reasonKey: 'devstudio.errors.roma.invalid_payload',
      detail,
    },
  }, 502);
}

export async function readSuccessfulRomaJson(response) {
  if (!response.ok) return { ok: false, response };
  try {
    return { ok: true, payload: await response.json() };
  } catch {
    return { ok: false, response: invalidUpstream('Roma returned non-JSON success') };
  }
}

export function forwardRomaResponse(response) {
  return new Response(response.body, {
    status: response.status,
    headers: {
      'content-type': response.headers.get('content-type') || 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export function readTemplateCreatePayload(payload) {
  const presentation = readCatalogPresentation(payload?.catalogPresentation);
  const sourceId = typeof payload?.sourceId === 'string' ? payload.sourceId : '';
  const templateName = typeof payload?.templateName === 'string' ? payload.templateName.trim() : '';
  return isCompactCatalogId(sourceId) && templateName && templateName.length <= 120 && presentation
    ? { sourceId, templateName, catalogPresentation: presentation }
    : null;
}

export function readPresentationPatchPayload(payload) {
  const presentation = readCatalogPresentation(payload?.catalogPresentation);
  return presentation ? { catalogPresentation: presentation } : null;
}

export function readRenamePayload(payload) {
  const displayName = typeof payload?.displayName === 'string' ? payload.displayName.trim() : '';
  return displayName && displayName.length <= 120 ? { displayName } : null;
}
