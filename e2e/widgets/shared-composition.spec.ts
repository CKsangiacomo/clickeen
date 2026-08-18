import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

function source(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test.describe('shared Builder and Widget composition', () => {
  test('ToolDrawer Assist mode fills its available header width', async ({ page }) => {
    const tokensCss = source('dieter/tokens/dieter-foundation-tokens.css');
    const bobCss = source('bob/app/bob_app.css');
    const segmentedCss = source('dieter/components/segmented/segmented.css');

    await page.setContent(`
      <style>${tokensCss}</style>
      <style>${bobCss}</style>
      <style>${segmentedCss}</style>
      <aside class="tooldrawer" style="inline-size: 340px; block-size: 400px">
        <div class="tdheader">
          <div class="diet-segmented diet-segmented-ictxt tdheader-mode-switch" data-size="lg">
            <label class="diet-segment"><span class="diet-segment__content">Manual</span></label>
            <label class="diet-segment"><span class="diet-segment__content">Copilot</span></label>
          </div>
          <button class="tooldrawer-close" style="inline-size: 40px; block-size: 40px">Close</button>
        </div>
      </aside>
    `);

    const measurements = await page.locator('.tdheader').evaluate((header) => {
      const rail = header.querySelector('.tdheader-mode-switch')!;
      const segments = Array.from(rail.querySelectorAll('.diet-segment'));
      return {
        headerWidth: header.getBoundingClientRect().width,
        railWidth: rail.getBoundingClientRect().width,
        segmentWidths: segments.map((segment) => segment.getBoundingClientRect().width),
      };
    });

    expect(measurements.railWidth).toBeCloseTo(measurements.headerWidth, 4);
    expect(measurements.segmentWidths).toHaveLength(2);
    expect(measurements.segmentWidths[0]).toBeCloseTo(measurements.segmentWidths[1]!, 4);

    await page.setViewportSize({ width: 500, height: 500 });
    const compactMeasurements = await page.locator('.tdheader').evaluate((header) => {
      const rail = header.querySelector('.tdheader-mode-switch')!;
      const close = header.querySelector('.tooldrawer-close')!;
      const style = getComputedStyle(header);
      const segments = Array.from(rail.querySelectorAll('.diet-segment'));
      return {
        headerWidth: header.getBoundingClientRect().width,
        railWidth: rail.getBoundingClientRect().width,
        closeWidth: close.getBoundingClientRect().width,
        gap: Number.parseFloat(style.columnGap),
        segmentWidths: segments.map((segment) => segment.getBoundingClientRect().width),
      };
    });

    expect(
      compactMeasurements.railWidth + compactMeasurements.closeWidth + compactMeasurements.gap,
    ).toBeCloseTo(compactMeasurements.headerWidth, 4);
    expect(compactMeasurements.segmentWidths[0]).toBeCloseTo(
      compactMeasurements.segmentWidths[1]!,
      4,
    );
  });

  test('shared Header hidden state and Pod branding placement survive composition', async ({
    page,
  }) => {
    const tokensCss = source('dieter/tokens/dieter-foundation-tokens.css');
    const headerCss = source('tokyo/product/widgets/shared/header.css');
    const stagePodCss = source('tokyo/product/widgets/shared/stagePod.css');
    const compositionCss = source('tokyo/product/widgets/shared/composition.css');
    const localeSwitcherCss = source('tokyo/product/widgets/shared/localeSwitcher.css');
    const socialShareCss = source('tokyo/product/widgets/shared/socialShare.css');

    await page.setContent(`
      <style>${tokensCss}</style>
      <style>${headerCss}</style>
      <style>${stagePodCss}</style>
      <style>${compositionCss}</style>
      <style>${localeSwitcherCss}</style>
      <style>${socialShareCss}</style>
      <div class="stage" data-inside-shadow-layer="above-content">
        <div class="pod" data-inside-shadow-layer="above-content" style="inline-size: 600px; block-size: 300px">
          <section class="ck-headerLayout" data-has-header="false">
            <header class="ck-header" hidden><h1>Hidden title</h1></header>
            <main class="ck-headerLayout__body">Core</main>
          </section>
          <div class="ck-branding"><a class="ck-branding__link">Made with Clickeen</a></div>
          <div class="ck-locale-switcher" data-host="pod" data-position="top-right"></div>
          <div class="ck-socialShare" data-host="pod" data-position="top-left"></div>
        </div>
      </div>
    `);

    const header = page.locator('.ck-header');
    await expect(header).toBeHidden();
    await expect(header).toHaveCSS('display', 'none');

    const composition = await page.locator('.pod').evaluate((pod) => {
      const shell = pod.querySelector('.ck-headerLayout')!;
      const branding = pod.querySelector('.ck-branding')!;
      const localeSwitcher = pod.querySelector('.ck-locale-switcher')!;
      const socialShare = pod.querySelector('.ck-socialShare')!;
      const brandingStyle = getComputedStyle(branding);
      return {
        podPosition: getComputedStyle(pod).position,
        shellPosition: getComputedStyle(shell).position,
        shellZIndex: getComputedStyle(shell).zIndex,
        brandingPosition: brandingStyle.position,
        brandingInlineEnd: brandingStyle.right,
        brandingBlockEnd: brandingStyle.bottom,
        brandingZIndex: brandingStyle.zIndex,
        localeSwitcherPosition: getComputedStyle(localeSwitcher).position,
        localeSwitcherZIndex: getComputedStyle(localeSwitcher).zIndex,
        socialSharePosition: getComputedStyle(socialShare).position,
        socialShareZIndex: getComputedStyle(socialShare).zIndex,
      };
    });

    expect(composition).toEqual({
      podPosition: 'relative',
      shellPosition: 'relative',
      shellZIndex: '10',
      brandingPosition: 'absolute',
      brandingInlineEnd: '24px',
      brandingBlockEnd: '0px',
      brandingZIndex: '50',
      localeSwitcherPosition: 'absolute',
      localeSwitcherZIndex: '80',
      socialSharePosition: 'absolute',
      socialShareZIndex: '80',
    });

    await page.locator('.ck-headerLayout').evaluate((shell) => {
      shell.setAttribute('data-has-header', 'true');
      (shell.querySelector('.ck-header') as HTMLElement).hidden = false;
    });
    await expect(header).toBeVisible();
    await expect(header).toHaveCSS('display', 'grid');
  });
});
