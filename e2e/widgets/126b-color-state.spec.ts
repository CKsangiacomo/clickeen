import { expect, test, type FrameLocator, type Page } from "@playwright/test";
import { hasAuthCookies } from "../helpers/auth-state";

const INSTANCE_ID = "VUWUJ7OQ0Y";
const BUILDER_PATH = `/builder/${INSTANCE_ID}`;
const INSTANCE_PATH = new RegExp(
  `/api/account/instances/${INSTANCE_ID}(?:\\?.*)?$`,
);

type CapturedStateUpdate = {
  device: unknown;
  hasTheme: boolean;
};

async function openBuilder(page: Page): Promise<FrameLocator> {
  await page.goto(BUILDER_PATH, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(new RegExp(`${BUILDER_PATH}$`));
  await expect(page.getByRole("heading", { name: "Builder" })).toBeVisible();
  const bobFrame = page.frameLocator('iframe[title="Bob Builder"]');
  await expect(bobFrame.getByRole("button", { name: "Manual" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    bobFrame.locator('section.workspace[data-widget-ready="true"]'),
  ).toBeVisible({ timeout: 30_000 });
  return bobFrame;
}

async function readCapturedStateUpdates(
  bobFrame: FrameLocator,
): Promise<CapturedStateUpdate[]> {
  return bobFrame
    .frameLocator('iframe[title="Widget preview"]')
    .locator("body")
    .evaluate(() => {
      const runtimeWindow = window as typeof window & {
        __prd126bStateUpdates?: CapturedStateUpdate[];
      };
      return runtimeWindow.__prd126bStateUpdates ?? [];
    });
}

test.describe("PRD 126B.1 Bob color truth and theme deletion", () => {
  test.beforeEach(() => {
    test.skip(
      !hasAuthCookies(),
      "No e2e auth state found. Create the ignored Roma cloud-dev storage state first.",
    );
  });

  test("preserves device updates, removes theme fiction, and renders intercepted save failure", async ({
    page,
  }) => {
    let interceptedSavePuts = 0;
    const unexpectedInstanceMutations: string[] = [];

    await page.route(
      `**/api/account/instances/${INSTANCE_ID}**`,
      async (route) => {
        const request = route.request();
        const method = request.method();
        const url = request.url();
        if (method === "PUT" && INSTANCE_PATH.test(url)) {
          interceptedSavePuts += 1;
          await route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({
              error: {
                reasonKey: "coreui.errors.db.writeFailed",
                detail: "RAW_126B_SAVE_SENTINEL",
              },
            }),
          });
          return;
        }
        if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
          await route.fallback();
          return;
        }
        unexpectedInstanceMutations.push(`${method} ${new URL(url).pathname}`);
        await route.abort("blockedbyclient");
      },
    );

    const bobFrame = await openBuilder(page);
    const previewFrame = bobFrame.frameLocator(
      'iframe[title="Widget preview"]',
    );
    await previewFrame.locator("body").evaluate(() => {
      const runtimeWindow = window as typeof window & {
        __prd126bStateUpdates?: CapturedStateUpdate[];
      };
      runtimeWindow.__prd126bStateUpdates = [];
      window.addEventListener("message", (event) => {
        const data = event.data as Record<string, unknown> | null;
        if (data?.type !== "ck:state-update") return;
        runtimeWindow.__prd126bStateUpdates?.push({
          device: data.device,
          hasTheme: Object.prototype.hasOwnProperty.call(data, "theme"),
        });
      });
    });

    const desktop = bobFrame.getByRole("radio", { name: "Desktop" });
    const mobile = bobFrame.getByRole("radio", { name: "Mobile" });
    await expect(desktop).toBeChecked();
    await mobile.check();
    await expect(mobile).toBeChecked();
    await expect
      .poll(async () => readCapturedStateUpdates(bobFrame))
      .toContainEqual({ device: "mobile", hasTheme: false });

    await desktop.check();
    await expect(desktop).toBeChecked();
    await expect
      .poll(async () => readCapturedStateUpdates(bobFrame))
      .toContainEqual({ device: "desktop", hasTheme: false });

    const capturedUpdates = await readCapturedStateUpdates(bobFrame);
    expect(capturedUpdates.length).toBeGreaterThanOrEqual(2);
    expect(capturedUpdates.every((entry) => !entry.hasTheme)).toBe(true);

    const titleField = bobFrame
      .locator('[data-bob-path="header.title"]')
      .first();
    await titleField.waitFor({ state: "attached" });
    await titleField.evaluate((element) => {
      const input = element as HTMLInputElement;
      input.value = `${input.value} `;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const saveButton = bobFrame.getByRole("button", { name: "Save" }).first();
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    const saveAlert = bobFrame
      .getByRole("alert")
      .filter({ hasText: "Save failed" });
    await expect(saveAlert).toContainText(
      "Saving changes failed. Please try again.",
    );
    await expect(saveAlert).not.toContainText("RAW_126B_SAVE_SENTINEL");
    expect(interceptedSavePuts).toBe(1);
    expect(unexpectedInstanceMutations).toEqual([]);
  });
});
