import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const sharedRuntimePath = resolve('tokyo/product/widgets/shared/runtime.js');
const countdownRuntimePath = resolve('tokyo/product/widgets/countdown/runtime.js');
const faqRuntimePath = resolve('tokyo/product/widgets/faq/runtime.js');

async function addRuntime(page: Page, runtimePath: string): Promise<void> {
  await page.addScriptTag({ content: await readFile(sharedRuntimePath, 'utf8') });
  await page.addScriptTag({ content: await readFile(runtimePath, 'utf8') });
}

function faqMarkup(pagePlacement: boolean): string {
  const widget = `
    <main data-ck-widget="faq" data-role="root">
      <section data-role="faq" data-layout="accordion" data-multi-open="false" data-expand-all="false" data-expand-first="false" data-deep-links="true">
        <ul data-role="faq-list">
          <li data-role="faq-item" id="faq-first" data-default-open="false">
            <button data-role="faq-question" type="button" aria-expanded="false">First</button>
            <div data-role="faq-answer">First answer</div>
          </li>
          <li data-role="faq-item" id="faq-second" data-default-open="false">
            <button data-role="faq-question" type="button" aria-expanded="false">Second</button>
            <div data-role="faq-answer">Second answer</div>
          </li>
        </ul>
      </section>
    </main>`;
  return pagePlacement
    ? `<section data-ck-placement-id="PLACEMENT"><template shadowrootmode="open">${widget}</template></section>`
    : widget;
}

test.describe('PRD 127B Widget runtime behavior', () => {
  test.use({ timezoneId: 'America/Los_Angeles' });

  test('Countdown interprets browser timezone as the visitor local timezone', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.setContent(`
      <main data-ck-widget="countdown" data-role="root">
        <section data-role="countdown" data-timer-mode="date" data-timer-repeat="never" data-timer-unit="days" data-timer-timezone="browser" data-timer-target-date="2099-01-01T00:00:00" data-timer-amount="1" data-timer-target-number="1" data-timer-duration="1" data-timer-starting-number="0" data-time-format="D:H:M:S" data-after-type="hide">
          <div data-role="countdown-core">
            <div data-role="units-display">
              <div data-role="timer">
                <span data-role="unit" data-unit="days"><span data-role="value"></span></span>
                <span data-role="separator"></span>
                <span data-role="unit" data-unit="hours"><span data-role="value"></span></span>
                <span data-role="separator"></span>
                <span data-role="unit" data-unit="minutes"><span data-role="value"></span></span>
                <span data-role="separator"></span>
                <span data-role="unit" data-unit="seconds"><span data-role="value"></span></span>
              </div>
            </div>
            <div data-role="number-display"><span data-role="number-value"></span></div>
            <a data-role="cta"></a>
            <div data-role="after-message"></div>
          </div>
        </section>
      </main>`);

    await addRuntime(page, countdownRuntimePath);

    const timing = await page.evaluate(() => {
      const read = (unit: string) =>
        Number(document.querySelector(`[data-unit="${unit}"] [data-role="value"]`)?.textContent);
      const renderedSeconds =
        read('days') * 86400 + read('hours') * 3600 + read('minutes') * 60 + read('seconds');
      const localTarget = new Date(2099, 0, 1, 0, 0, 0).getTime();
      return { renderedSeconds, expectedSeconds: Math.floor((localTarget - Date.now()) / 1000) };
    });
    expect(Math.abs(timing.renderedSeconds - timing.expectedSeconds)).toBeLessThanOrEqual(2);
    expect(pageErrors).toEqual([]);
  });

  for (const pagePlacement of [false, true]) {
    test(`FAQ deep links resolve and write hashes ${pagePlacement ? 'inside a Page shadow root' : 'standalone'}`, async ({
      page,
    }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await page.setContent(faqMarkup(pagePlacement));
      await page.evaluate(() => {
        window.location.hash = 'faq-first';
      });

      await addRuntime(page, faqRuntimePath);

      const first = page.locator('#faq-first');
      const second = page.locator('#faq-second');
      await expect(first.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
      await expect(first.locator('[data-role="faq-answer"]')).toBeVisible();

      await second.getByRole('button').click();
      await expect(second.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
      await expect(first.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
      expect(await page.evaluate(() => window.location.hash)).toBe('#faq-second');
      expect(pageErrors).toEqual([]);
    });
  }
});
