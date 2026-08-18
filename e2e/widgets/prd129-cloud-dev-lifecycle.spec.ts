import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse,
  type Frame,
  type Page,
} from '@playwright/test';
import { hasAuthCookies } from '../helpers/auth-state';

const RUN_PRD129_LIFECYCLE_PROOF = process.env.E2E_PRD129_LIFECYCLE === '1';
const CLK_LIVE_ORIGIN = process.env.E2E_CLK_LIVE_URL || 'https://dev.clk.live';
const REQUESTED_PROOF_LOCALE = process.env.E2E_PRD129_LOCALE?.trim() || null;
const CACHE_WARM_ATTEMPTS = 8;
const CACHE_WARM_INTERVAL_MS = 750;

type RomaBootstrapPayload = {
  activeAccount?: {
    accountPublicId?: string;
    activeLocales?: string[];
    localePolicy?: { baseLocale?: string };
  };
};

type CreatedInstance = {
  accountId: string;
  instanceId: string;
  widgetType: string;
  displayName: string | null;
  status: 'published' | 'unpublished';
};

type TranslationGeneratePayload = {
  ok: boolean;
  translation: {
    ok: boolean;
    accepted: boolean;
    baseLocale: string;
    requestedLocales: string[];
    translatedLocales: string[];
    failedLocales: Array<{ locale: string; reasonKey: string; detail?: string }>;
  };
};

type TranslationValuesPayload = {
  locale: string;
  values: Record<string, string>;
};

type FaqItem = {
  id: string;
  question: string;
  answer: string;
  [key: string]: unknown;
};

type FaqSection = {
  id: string;
  title: string;
  faqs: FaqItem[];
  [key: string]: unknown;
};

type PublicRead = {
  status: number;
  body: string;
  cacheStatus: string | null;
};

function sorted(values: readonly string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

async function readJson<T>(response: APIResponse, label: string): Promise<T> {
  const body = await response.text();
  expect(response.ok(), `${label} returned ${response.status()}: ${body}`).toBe(true);
  return JSON.parse(body) as T;
}

async function publicRead(request: APIRequestContext, url: string): Promise<PublicRead> {
  const response = await request.get(url);
  return {
    status: response.status(),
    body: await response.text(),
    cacheStatus: response.headers()['cf-cache-status'] ?? null,
  };
}

async function warmPublicCoordinate(request: APIRequestContext, url: string): Promise<PublicRead> {
  let last: PublicRead | null = null;
  for (let attempt = 0; attempt < CACHE_WARM_ATTEMPTS; attempt += 1) {
    last = await publicRead(request, url);
    expect(last.status, `${url} must remain publicly available while warming`).toBe(200);
    if (last.cacheStatus === 'HIT') return last;
    await new Promise((resolve) => setTimeout(resolve, CACHE_WARM_INTERVAL_MS));
  }
  throw new Error(
    `${url} did not become a Cloudflare cache HIT after ${CACHE_WARM_ATTEMPTS} reads; last status was ${last?.cacheStatus ?? 'missing'}`,
  );
}

async function waitForBuilderOpenResponse(page: Page, instanceId: string) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.url().includes(`/api/builder/${instanceId}/open`),
    { timeout: 45_000 },
  );
}

async function openBuilder(page: Page, instanceId: string): Promise<Frame> {
  const openResponsePromise = waitForBuilderOpenResponse(page, instanceId);
  await page.goto(`/builder/${instanceId}`, { waitUntil: 'domcontentloaded' });
  const openResponse = await openResponsePromise;
  expect(
    openResponse.ok(),
    `Builder open returned ${openResponse.status()} for ${instanceId}`,
  ).toBe(true);

  const bobHandle = await page
    .locator('iframe[title="Bob Builder"]')
    .elementHandle({ timeout: 30_000 });
  const bobFrame = await bobHandle.contentFrame();
  expect(bobFrame, `Bob frame should exist for ${instanceId}`).not.toBeNull();
  await bobFrame!.getByRole('radio', { name: /Manual/i }).waitFor({ timeout: 60_000 });
  await expect(bobFrame!.locator('section.workspace[data-widget-ready="true"]')).toBeVisible({
    timeout: 45_000,
  });
  return bobFrame!;
}

async function setBobField(bobFrame: Frame, path: string, value: string) {
  const field = bobFrame.locator(`[data-bob-path="${path}"]`).first();
  await field.waitFor({ state: 'attached', timeout: 20_000 });
  await field.evaluate((element, nextValue) => {
    const input = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    input.value = nextValue;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

async function saveThroughBob(page: Page, bobFrame: Frame, instanceId: string) {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      response.url().includes(`/api/account/instances/${instanceId}`),
    { timeout: 45_000 },
  );
  const saveButton = bobFrame.getByRole('button', { name: 'Save' }).first();
  await expect(saveButton).toBeEnabled({ timeout: 20_000 });
  await saveButton.click();
  const response = await responsePromise;
  expect(response.ok(), `Save returned ${response.status()} for ${instanceId}`).toBe(true);
  await expect(saveButton).toHaveCount(0, { timeout: 20_000 });
}

async function publishThroughBob(
  page: Page,
  bobFrame: Frame,
  instanceId: string,
  action: 'Publish' | 'Republish',
) {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().includes(`/api/account/instances/${instanceId}/publish`),
    { timeout: 120_000 },
  );
  const button = bobFrame.getByRole('button', { name: action }).first();
  await expect(button).toBeEnabled({ timeout: 20_000 });
  await button.click();
  const response = await responsePromise;
  const body = await response.text();
  expect(response.ok(), `${action} returned ${response.status()} for ${instanceId}: ${body}`).toBe(
    true,
  );
  await expect(bobFrame.getByRole('button', { name: 'Republish' }).first()).toBeVisible({
    timeout: 45_000,
  });
}

function translationCoordinate(args: {
  role: 'faq-question';
  sectionId: string;
  itemId: string;
}): string {
  return [
    'faq',
    args.role,
    'faq.sections[].faqs[].question',
    `faq.sections[].id=${args.sectionId}`,
    `faq.sections[].faqs[].id=${args.itemId}`,
  ].join('|');
}

async function cleanupQaInstance(args: {
  request: APIRequestContext;
  instanceId: string;
}): Promise<string[]> {
  const failures: string[] = [];
  const unpublish = await args.request.post(
    `/api/account/instances/${encodeURIComponent(args.instanceId)}/unpublish`,
  );
  if (!unpublish.ok()) {
    const body = await unpublish.text();
    let committedUnpublish = false;
    try {
      const payload = JSON.parse(body) as { committed?: { status?: unknown } };
      committedUnpublish = payload.committed?.status === 'unpublished';
    } catch {
      // The exact response body is reported below.
    }
    if (!committedUnpublish) failures.push(`cleanup unpublish ${unpublish.status()}: ${body}`);
  }

  const remove = await args.request.delete(
    `/api/account/instances/${encodeURIComponent(args.instanceId)}`,
  );
  if (!remove.ok()) failures.push(`cleanup delete ${remove.status()}: ${await remove.text()}`);

  const inventory = await args.request.get('/api/account/widgets');
  if (!inventory.ok()) {
    failures.push(`cleanup inventory read ${inventory.status()}: ${await inventory.text()}`);
  } else {
    const payload = (await inventory.json()) as { instances?: Array<{ instanceId?: unknown }> };
    if (payload.instances?.some((instance) => instance.instanceId === args.instanceId)) {
      failures.push(`cleanup inventory still contains ${args.instanceId}`);
    }
  }
  return failures;
}

test.describe('PRD 129 cloud-dev lifecycle and cache proof', () => {
  test.beforeEach(() => {
    test.skip(
      !RUN_PRD129_LIFECYCLE_PROOF,
      'Set E2E_PRD129_LIFECYCLE=1 to authorize the dedicated cloud-dev instance lifecycle proof.',
    );
    test.skip(
      !hasAuthCookies(),
      'No Roma cloud-dev auth state found. Run pnpm e2e:auth:roma-dev first.',
    );
  });

  test('Create -> Bob edit/Save -> Generate -> Publish -> cache purge -> Unpublish -> Delete', async ({
    page,
    request,
  }, testInfo) => {
    test.setTimeout(900_000);

    const stamp = `${Date.now()}-${testInfo.workerIndex}`;
    const initialTitle = `PRD129 initial ${stamp}`;
    const republishedTitle = `PRD129 republished ${stamp}`;
    const addedQuestion = `PRD129 untranslated added question ${stamp}`;
    const addedAnswer = `PRD129 untranslated added answer ${stamp}`;
    let created: CreatedInstance | null = null;
    let primaryFailure: unknown = null;
    let cleanupFailures: string[] = [];

    try {
      const bootstrap = await readJson<RomaBootstrapPayload>(
        await request.get('/api/bootstrap'),
        'Roma account context',
      );
      const account = bootstrap.activeAccount;
      expect(
        account?.accountPublicId,
        'Roma must expose the current account coordinate',
      ).toBeTruthy();
      expect(
        account?.localePolicy?.baseLocale,
        'Roma must expose the account base locale',
      ).toBeTruthy();
      expect(
        Array.isArray(account?.activeLocales) && account!.activeLocales!.length > 0,
        'PRD 129 localized serving proof requires at least one active non-base locale',
      ).toBe(true);

      const activeLocales = account!.activeLocales!;
      const proofLocale = REQUESTED_PROOF_LOCALE ?? activeLocales[0]!;
      expect(
        activeLocales,
        `E2E_PRD129_LOCALE=${proofLocale} must be an active locale for the current account`,
      ).toContain(proofLocale);

      created = await readJson<CreatedInstance>(
        await request.post('/api/account/instances', {
          data: { widgetType: 'faq', displayName: `PRD 129 lifecycle QA ${stamp}` },
        }),
        'Create dedicated FAQ instance',
      );
      expect(created.accountId).toBe(account!.accountPublicId);
      expect(created.status).toBe('unpublished');

      const publicBase = `${CLK_LIVE_ORIGIN}/${created.accountId}/${created.instanceId}`;
      const publicLocale = `${publicBase}?locale=${encodeURIComponent(proofLocale)}`;
      const publicTracking = `${publicBase}?utm_source=prd129-e2e`;
      const publicStyles = `${publicBase}/styles.css`;
      const publicRuntime = `${publicBase}/runtime.js`;
      const cacheCoordinates = [
        publicBase,
        publicLocale,
        publicTracking,
        publicStyles,
        publicRuntime,
      ];

      expect((await publicRead(request, publicBase)).status).toBe(404);
      expect((await publicRead(request, publicLocale)).status).toBe(404);

      const bobFrame = await openBuilder(page, created.instanceId);
      await bobFrame.getByRole('tab', { name: 'Content' }).click();
      await setBobField(bobFrame, 'header.title', initialTitle);
      await expect(
        bobFrame.frameLocator('iframe[title="Widget preview"]').locator('body'),
      ).toContainText(initialTitle, { timeout: 30_000 });
      await saveThroughBob(page, bobFrame, created.instanceId);

      expect((await publicRead(request, publicBase)).status).toBe(404);
      expect((await publicRead(request, publicLocale)).status).toBe(404);

      const generation = await readJson<TranslationGeneratePayload>(
        await request.post(
          `/api/account/instances/${encodeURIComponent(created.instanceId)}/translations/generate`,
          { timeout: 600_000 },
        ),
        'Generate translations',
      );
      expect(generation.translation.accepted).toBe(true);
      expect(generation.translation.baseLocale).toBe(account!.localePolicy!.baseLocale);
      expect(sorted(generation.translation.requestedLocales)).toEqual(sorted(activeLocales));
      const failedLocales = generation.translation.failedLocales.map((failure) => failure.locale);
      expect(new Set(generation.translation.translatedLocales).size).toBe(
        generation.translation.translatedLocales.length,
      );
      expect(new Set(failedLocales).size).toBe(failedLocales.length);
      expect(
        generation.translation.translatedLocales.filter((locale) => failedLocales.includes(locale)),
      ).toEqual([]);
      expect(sorted([...generation.translation.translatedLocales, ...failedLocales])).toEqual(
        sorted(generation.translation.requestedLocales),
      );
      expect(generation.translation.translatedLocales).toContain(proofLocale);
      expect(generation.translation.ok).toBe(failedLocales.length === 0);
      expect(generation.ok).toBe(generation.translation.ok);

      const overlay = await readJson<TranslationValuesPayload>(
        await request.get(
          `/api/account/instances/${encodeURIComponent(created.instanceId)}/translations/${encodeURIComponent(proofLocale)}`,
        ),
        `Read generated ${proofLocale} overlay`,
      );
      expect(overlay.locale).toBe(proofLocale);

      const sectionsField = bobFrame.locator('[data-bob-path="faq.sections"]').first();
      const originalSections = JSON.parse(await sectionsField.inputValue()) as FaqSection[];
      expect(originalSections.length).toBeGreaterThan(0);
      expect(originalSections[0]!.faqs.length).toBeGreaterThanOrEqual(2);
      const originalSection = originalSections[0]!;
      const followedItem = originalSection.faqs[0]!;
      const deletedItem = originalSection.faqs[1]!;
      const followedCoordinate = translationCoordinate({
        role: 'faq-question',
        sectionId: originalSection.id,
        itemId: followedItem.id,
      });
      const deletedCoordinate = translationCoordinate({
        role: 'faq-question',
        sectionId: originalSection.id,
        itemId: deletedItem.id,
      });
      expect(
        overlay.values[followedCoordinate],
        `${followedCoordinate} must be translated`,
      ).toBeTruthy();
      expect(
        overlay.values[deletedCoordinate],
        `${deletedCoordinate} must be translated`,
      ).toBeTruthy();

      await publishThroughBob(page, bobFrame, created.instanceId, 'Publish');

      const publishedBase = await publicRead(request, publicBase);
      expect(publishedBase.status).toBe(200);
      expect(publishedBase.body).toContain(initialTitle);
      expect(publishedBase.body).toContain('data-ck-content-path');
      expect(publishedBase.body).not.toContain('CK_LOCALE_CONTEXT');

      const publishedLocale = await publicRead(request, publicLocale);
      expect(publishedLocale.status).toBe(200);
      expect(publishedLocale.body).toContain(`<html lang="${proofLocale}"`);
      expect(publishedLocale.body).toContain(overlay.values[followedCoordinate]!);
      expect(publishedLocale.body).toContain(overlay.values[deletedCoordinate]!);

      for (const coordinate of cacheCoordinates) {
        await warmPublicCoordinate(request, coordinate);
      }

      const nextSections = structuredClone(originalSections);
      nextSections[0] = {
        ...originalSection,
        faqs: [
          ...originalSection.faqs.slice(2),
          followedItem,
          {
            id: `prd129-${stamp}`,
            question: addedQuestion,
            answer: addedAnswer,
          },
        ],
      };
      await setBobField(bobFrame, 'header.title', republishedTitle);
      await setBobField(bobFrame, 'faq.sections', JSON.stringify(nextSections));
      await expect(
        bobFrame.frameLocator('iframe[title="Widget preview"]').locator('body'),
      ).toContainText(republishedTitle, { timeout: 30_000 });
      await expect(
        bobFrame.frameLocator('iframe[title="Widget preview"]').locator('body'),
      ).toContainText(addedQuestion, { timeout: 30_000 });
      await saveThroughBob(page, bobFrame, created.instanceId);

      const afterSaveBase = await publicRead(request, publicBase);
      expect(afterSaveBase.status).toBe(200);
      expect(afterSaveBase.body).toContain(initialTitle);
      expect(afterSaveBase.body).not.toContain(republishedTitle);
      expect(afterSaveBase.body).not.toContain(addedQuestion);

      const afterSaveLocale = await publicRead(request, publicLocale);
      expect(afterSaveLocale.status).toBe(200);
      expect(afterSaveLocale.body).toContain(overlay.values[followedCoordinate]!);
      expect(afterSaveLocale.body).toContain(overlay.values[deletedCoordinate]!);
      expect(afterSaveLocale.body).not.toContain(addedQuestion);

      await publishThroughBob(page, bobFrame, created.instanceId, 'Republish');

      const firstReadsAfterPurge = new Map<string, PublicRead>();
      for (const coordinate of cacheCoordinates) {
        const result = await publicRead(request, coordinate);
        firstReadsAfterPurge.set(coordinate, result);
        expect(result.status, `${coordinate} must remain available after Republish`).toBe(200);
        expect(
          result.cacheStatus,
          `${coordinate} must be evicted by the instance cache-tag purge`,
        ).not.toBe('HIT');
      }

      const republishedBase = firstReadsAfterPurge.get(publicBase)!;
      expect(republishedBase.body).toContain(republishedTitle);
      expect(republishedBase.body).toContain(addedQuestion);
      expect(republishedBase.body).not.toContain(initialTitle);
      expect(republishedBase.body).toContain(`data-ck-content-path="${followedCoordinate}"`);
      expect(republishedBase.body).not.toContain(`data-ck-content-path="${deletedCoordinate}"`);

      const republishedLocale = firstReadsAfterPurge.get(publicLocale)!;
      expect(republishedLocale.body).toContain(overlay.values[followedCoordinate]!);
      expect(republishedLocale.body).toContain(addedQuestion);
      expect(republishedLocale.body).toContain(`data-ck-content-path="${followedCoordinate}"`);
      expect(republishedLocale.body).not.toContain(`data-ck-content-path="${deletedCoordinate}"`);

      for (const coordinate of cacheCoordinates) {
        await warmPublicCoordinate(request, coordinate);
      }

      const unpublish = await readJson<{ ok: true; status: 'unpublished'; changed: boolean }>(
        await request.post(
          `/api/account/instances/${encodeURIComponent(created.instanceId)}/unpublish`,
        ),
        'Unpublish dedicated QA instance',
      );
      expect(unpublish.status).toBe('unpublished');

      for (const coordinate of cacheCoordinates) {
        const hidden = await publicRead(request, coordinate);
        expect(hidden.status, `${coordinate} must be unavailable after Unpublish`).toBe(404);
        expect(hidden.cacheStatus).not.toBe('HIT');
      }
    } catch (error) {
      primaryFailure = error;
    } finally {
      if (created) {
        cleanupFailures = await cleanupQaInstance({ request, instanceId: created.instanceId });
      }
      await testInfo.attach('prd129-cleanup.json', {
        body: JSON.stringify(
          {
            instanceId: created?.instanceId ?? null,
            cleanupFailures,
          },
          null,
          2,
        ),
        contentType: 'application/json',
      });
    }

    if (primaryFailure) throw primaryFailure;
    expect(cleanupFailures, 'Dedicated PRD 129 QA instance cleanup must complete').toEqual([]);
  });
});
