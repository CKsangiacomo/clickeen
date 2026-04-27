import {
  isCuratedOrMainWidgetPublicId,
  normalizeWidgetPublicId,
} from '@clickeen/ck-contracts';

export const prerender = false;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const PAGE_KEYS = new Set(['overview', 'examples', 'features', 'pricing']);
const WIDGET_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function isLocalDevRequest(request) {
  if (!import.meta.env.DEV) return false;
  const hostname = String(new URL(request.url).hostname || '').toLowerCase();
  return LOCAL_HOSTS.has(hostname);
}

function asSlug(value) {
  const slug = String(value || '').trim().toLowerCase();
  return WIDGET_SLUG_PATTERN.test(slug) ? slug : '';
}

function asPublicId(value) {
  const publicId = normalizeWidgetPublicId(value);
  return publicId && isCuratedOrMainWidgetPublicId(publicId) ? publicId : '';
}

function asBlockId(value) {
  return String(value || '').trim();
}

async function parseBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function readCuratedInstancesFromLocalTokyo(widget) {
  void widget;
  return [];
}

function ensureBlockArray(pageJson) {
  if (!pageJson || typeof pageJson !== 'object' || Array.isArray(pageJson)) {
    throw new Error('Invalid page JSON root.');
  }
  const blocks = pageJson.blocks;
  if (!Array.isArray(blocks)) {
    throw new Error('Missing blocks[] in page JSON.');
  }
  return blocks;
}

function applyCuratedAssignment(args) {
  const { blocks, blockId, target, itemIndex, publicId } = args;
  const block = blocks.find((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    return String(entry.id || '') === blockId;
  });

  if (!block) {
    throw new Error(`Block "${blockId}" was not found in page JSON.`);
  }

  if (target === 'block') {
    if (!block.curatedRef || typeof block.curatedRef !== 'object' || Array.isArray(block.curatedRef)) {
      block.curatedRef = {};
    }
    block.curatedRef.publicId = publicId;
    return;
  }

  if (target !== 'item' && target !== 'item-public-id') {
    throw new Error('Unsupported assignment target.');
  }

  if (!Number.isInteger(itemIndex) || itemIndex < 0) {
    throw new Error('Invalid item index for item-level assignment.');
  }

  if (!Array.isArray(block.items) || !block.items[itemIndex] || typeof block.items[itemIndex] !== 'object') {
    throw new Error(`Block "${blockId}" does not have item index ${itemIndex}.`);
  }

  const item = block.items[itemIndex];
  if (target === 'item-public-id') {
    item.publicId = publicId;
    return;
  }
  if (!item.curatedRef || typeof item.curatedRef !== 'object' || Array.isArray(item.curatedRef)) {
    item.curatedRef = {};
  }
  item.curatedRef.publicId = publicId;
}

export async function GET({ request }) {
  if (!isLocalDevRequest(request)) {
    return json({ error: 'NOT_FOUND', message: 'Local curated endpoint is disabled.' }, 404);
  }

  const url = new URL(request.url);
  const widget = asSlug(url.searchParams.get('widget'));
  const instances = await readCuratedInstancesFromLocalTokyo(widget);
  return json({
    instances,
    localCount: instances.length,
  });
}

export async function POST({ request }) {
  if (!isLocalDevRequest(request)) {
    return json({ error: 'NOT_FOUND', message: 'Local curated endpoint is disabled.' }, 404);
  }

  const body = await parseBody(request);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ error: 'INVALID_BODY', message: 'Expected JSON body.' }, 400);
  }

  const widget = asSlug(body.widget);
  const page = String(body.page || '').trim().toLowerCase();
  const blockId = asBlockId(body.blockId);
  const target =
    body.target === 'item' || body.target === 'item-public-id'
      ? body.target
      : body.target === 'block'
      ? 'block'
      : '';
  const publicId = asPublicId(body.publicId);
  const itemIndex = body.itemIndex == null ? null : Number.parseInt(String(body.itemIndex), 10);

  if (!widget) return json({ error: 'INVALID_WIDGET', message: 'Invalid widget slug.' }, 400);
  if (!PAGE_KEYS.has(page)) return json({ error: 'INVALID_PAGE', message: 'Invalid page key.' }, 400);
  if (!blockId) return json({ error: 'INVALID_BLOCK', message: 'blockId is required.' }, 400);
  if (!target) {
    return json({ error: 'INVALID_TARGET', message: 'target must be "block", "item", or "item-public-id".' }, 400);
  }
  if (!publicId) {
    return json({ error: 'INVALID_PUBLIC_ID', message: 'publicId must start with wgt_curated_ or wgt_main_.' }, 400);
  }

  try {
    const fs = await import('node:fs/promises');
    const pageFileUrl = new URL(`../../../../../tokyo/prague/pages/${widget}/${page}.json`, import.meta.url);
    const raw = await fs.readFile(pageFileUrl, 'utf8');
    const pageJson = JSON.parse(raw);
    const blocks = ensureBlockArray(pageJson);

    applyCuratedAssignment({
      blocks,
      blockId,
      target,
      itemIndex,
      publicId,
    });

    await fs.writeFile(pageFileUrl, `${JSON.stringify(pageJson, null, 2)}\n`, 'utf8');

    return json({
      ok: true,
      file: `tokyo/prague/pages/${widget}/${page}.json`,
      blockId,
      target,
      itemIndex,
      publicId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: 'WRITE_FAILED', message }, 500);
  }
}
