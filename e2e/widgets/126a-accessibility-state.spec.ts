import { expect, test, type FrameLocator, type Page } from "@playwright/test";
import { hasAuthCookies } from "../helpers/auth-state";

const INSTANCE_ID = "VUWUJ7OQ0Y";
const BUILDER_PATH = `/builder/${INSTANCE_ID}`;
const LIST_TRANSLATIONS_PATH = new RegExp(
  `/api/account/instances/${INSTANCE_ID}/translations(?:\\?.*)?$`,
);
const READ_TRANSLATION_PATH = new RegExp(
  `/api/account/instances/${INSTANCE_ID}/translations/[^/?]+(?:\\?.*)?$`,
);
const COPILOT_PATH = new RegExp(
  `/api/account/instances/${INSTANCE_ID}/copilot(?:\\?.*)?$`,
);

async function guardInstanceMutations(
  page: Page,
  allowCopilot = false,
): Promise<string[]> {
  const forbiddenMutations: string[] = [];
  await page.route(
    `**/api/account/instances/${INSTANCE_ID}**`,
    async (route) => {
      const request = route.request();
      const method = request.method();
      const url = request.url();
      const isRead =
        method === "GET" || method === "HEAD" || method === "OPTIONS";
      const isAllowedCopilot =
        allowCopilot && method === "POST" && COPILOT_PATH.test(url);
      if (isRead || isAllowedCopilot) return route.fallback();
      forbiddenMutations.push(`${method} ${new URL(url).pathname}`);
      await route.abort("blockedbyclient");
    },
  );
  return forbiddenMutations;
}

async function openBuilder(page: Page): Promise<FrameLocator> {
  await page.goto(BUILDER_PATH, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(new RegExp(`${BUILDER_PATH}$`));
  await expect(page.getByRole("heading", { name: "Builder" })).toBeVisible();
  const bobFrame = page.frameLocator('iframe[title="Bob Builder"]');
  await expect(bobFrame.getByRole("button", { name: "Manual" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(bobFrame.getByRole("tab", { name: "Translations" })).toBeVisible(
    {
      timeout: 30_000,
    },
  );
  return bobFrame;
}

async function openTranslations(bobFrame: FrameLocator) {
  await bobFrame.getByRole("tab", { name: "Translations" }).click();
  await expect(bobFrame.locator(".tdmenucontent > .heading-3")).toHaveText(
    "Translations",
  );
}

test.describe("PRD 126A.2 Bob failure-state truth", () => {
  test.beforeEach(() => {
    test.skip(
      !hasAuthCookies(),
      "No e2e auth state found. Create the ignored Roma cloud-dev storage state first.",
    );
  });

  test("shows delayed and failed translation-list reads without inventing absence", async ({
    page,
  }) => {
    let releaseList!: () => void;
    const listGate = new Promise<void>((resolve) => {
      releaseList = resolve;
    });
    let listRequests = 0;

    await page.route(LIST_TRANSLATIONS_PATH, async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      listRequests += 1;
      await listGate;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            reasonKey: "coreui.errors.db.readFailed",
            detail: "RAW_TRANSLATION_LIST_SENTINEL",
          },
        }),
      });
    });
    const forbiddenMutations = await guardInstanceMutations(page);

    const bobFrame = await openBuilder(page);
    await openTranslations(bobFrame);
    await expect(
      bobFrame
        .getByRole("status")
        .filter({ hasText: "Loading saved translations..." }),
    ).toBeVisible();

    releaseList();

    await expect(
      bobFrame
        .getByRole("alert")
        .filter({ hasText: "Saved translations could not be read." }),
    ).toBeVisible();
    await expect(bobFrame.getByText("No saved translations yet.")).toHaveCount(
      0,
    );
    await expect(
      bobFrame.getByText("RAW_TRANSLATION_LIST_SENTINEL"),
    ).toHaveCount(0);
    expect(listRequests).toBe(1);
    expect(forbiddenMutations).toEqual([]);
  });

  test("blocks translated preview while a selected locale read is loading or failed", async ({
    page,
  }) => {
    await page.route(LIST_TRANSLATIONS_PATH, async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          baseLocale: "en",
          translations: [
            { locale: "fr" },
            { locale: "de" },
            { locale: "it" },
            { locale: "es" },
            { locale: "pt" },
          ],
        }),
      });
    });

    let releaseLocale!: () => void;
    const localeGate = new Promise<void>((resolve) => {
      releaseLocale = resolve;
    });
    let requestedLocale = "";
    let localeRequests = 0;
    await page.route(READ_TRANSLATION_PATH, async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      localeRequests += 1;
      requestedLocale = decodeURIComponent(
        new URL(route.request().url()).pathname.split("/").pop() || "",
      );
      await localeGate;
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            reasonKey: "coreui.errors.db.readFailed",
            detail: "RAW_TRANSLATION_LOCALE_SENTINEL",
          },
        }),
      });
    });
    const forbiddenMutations = await guardInstanceMutations(page);

    const bobFrame = await openBuilder(page);
    const previewFrame = bobFrame.frameLocator(
      'iframe[title="Widget preview"]',
    );
    await previewFrame
      .locator("body")
      .waitFor({ state: "attached", timeout: 30_000 });
    await previewFrame.locator("body").evaluate(() => {
      const runtimeWindow = window as typeof window & {
        __prd126aStateLocales?: string[];
      };
      runtimeWindow.__prd126aStateLocales = [];
      window.addEventListener("message", (event) => {
        const data = event.data as { type?: unknown; locale?: unknown } | null;
        if (data?.type !== "ck:state-update" || typeof data.locale !== "string")
          return;
        runtimeWindow.__prd126aStateLocales?.push(data.locale);
      });
    });

    await openTranslations(bobFrame);
    const localeSelect = bobFrame.getByLabel("Preview locale");
    await expect(localeSelect).toBeEnabled();
    const optionValues = await localeSelect
      .locator("option")
      .evaluateAll((options) =>
        options.map((option) => (option as HTMLOptionElement).value),
      );
    const targetLocale = optionValues.find(
      (locale) => locale && locale !== "en",
    );
    expect(
      targetLocale,
      "fixture should expose at least one translated locale",
    ).toBeTruthy();
    await localeSelect.selectOption(targetLocale!);

    await expect(
      bobFrame
        .getByRole("status")
        .filter({ hasText: "Loading saved translation..." }),
    ).toBeVisible();
    await expect(bobFrame.getByText("Loading preview...")).toHaveCount(0);
    await expect
      .poll(() => requestedLocale, { timeout: 10_000 })
      .toBe(targetLocale);
    expect(
      await previewFrame.locator("body").evaluate((locale) => {
        const runtimeWindow = window as typeof window & {
          __prd126aStateLocales?: string[];
        };
        return {
          installed: Array.isArray(runtimeWindow.__prd126aStateLocales),
          count:
            runtimeWindow.__prd126aStateLocales?.filter(
              (entry) => entry === locale,
            ).length ?? 0,
        };
      }, targetLocale!),
    ).toEqual({ installed: true, count: 0 });

    releaseLocale();

    await expect(
      bobFrame
        .getByRole("alert")
        .filter({ hasText: "Saved translations could not be read." })
        .first(),
    ).toBeVisible();
    await expect(
      bobFrame.getByText("RAW_TRANSLATION_LOCALE_SENTINEL"),
    ).toHaveCount(0);
    expect(
      await previewFrame.locator("body").evaluate((locale) => {
        const runtimeWindow = window as typeof window & {
          __prd126aStateLocales?: string[];
        };
        return {
          installed: Array.isArray(runtimeWindow.__prd126aStateLocales),
          count:
            runtimeWindow.__prd126aStateLocales?.filter(
              (entry) => entry === locale,
            ).length ?? 0,
        };
      }, targetLocale!),
    ).toEqual({ installed: true, count: 0 });
    expect(localeRequests).toBe(1);
    expect(forbiddenMutations).toEqual([]);
  });

  test("shows issue-only Copilot coordinates without leaking raw response detail", async ({
    page,
  }) => {
    let copilotPosts = 0;
    await page.route(COPILOT_PATH, async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      copilotPosts += 1;
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          error: "VALIDATION",
          detail: "RAW_COPILOT_RESPONSE_SENTINEL",
          issues: [{ path: "header.title", message: "Title is required" }],
        }),
      });
    });
    const forbiddenMutations = await guardInstanceMutations(page, true);

    const bobFrame = await openBuilder(page);
    await bobFrame.getByRole("button", { name: "Copilot" }).click();
    const prompt = bobFrame.getByRole("textbox", { name: "Copilot prompt" });
    await expect(prompt).toBeEnabled();
    await prompt.fill("Change the title");
    await bobFrame.getByRole("button", { name: "Send" }).click();

    await expect(
      bobFrame
        .getByLabel("Copilot conversation")
        .getByText(/header\.title: Title is required/),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      bobFrame.getByText("RAW_COPILOT_RESPONSE_SENTINEL"),
    ).toHaveCount(0);
    expect(copilotPosts).toBe(1);
    expect(forbiddenMutations).toEqual([]);
  });
});
