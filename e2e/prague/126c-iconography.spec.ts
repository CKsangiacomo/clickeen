import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const PRAGUE_ORIGIN =
  process.env.E2E_PRAGUE_URL ?? "https://prague.dev.clickeen.com";
const FAQ_PATH = "/us/en/widgets/faq/";
const EXPECTED_ICONS = ["square.on.square", "square.stack.3d.up", "gear"];

test.use({
  baseURL: PRAGUE_ORIGIN,
  storageState: { cookies: [], origins: [] },
});

async function listAstroFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listAstroFiles(path)));
    if (entry.isFile() && entry.name.endsWith(".astro")) files.push(path);
  }
  return files;
}

async function guardUnexpectedMutations(page: Page): Promise<string[]> {
  const unexpectedMutations: string[] = [];
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      await route.fallback();
      return;
    }
    unexpectedMutations.push(
      `${request.method()} ${new URL(request.url()).pathname}`,
    );
    await route.abort("blockedbyclient");
  });
  return unexpectedMutations;
}

test("Prague Dieter source keeps one decorative 40px Tokyo mask lane", async () => {
  const componentPath = resolve("prague/src/components/DieterIcon.astro");
  const componentSource = await readFile(componentPath, "utf8");
  const astroFiles = await listAstroFiles(resolve("prague/src"));
  const size44CallSites: string[] = [];

  for (const path of astroFiles) {
    const source = await readFile(path, "utf8");
    if (/size=\{44\}/u.test(source)) size44CallSites.push(path);
  }

  expect(componentSource).toContain("const { name, size = 40 } = Astro.props;");
  expect(componentSource).toContain("/dieter/icons/svg/${name}.svg");
  expect(componentSource).toContain("background-color: currentColor");
  expect(componentSource).toContain("-webkit-mask:");
  expect(componentSource).toContain("mask:");
  expect(componentSource).toContain("center / contain no-repeat");
  expect(componentSource).toContain('aria-hidden="true"');
  expect(componentSource).toContain('role="presentation"');
  expect(componentSource).not.toContain("<img");
  expect(componentSource).not.toContain("title?:");
  expect(size44CallSites).toEqual([]);
});

test("public FAQ cards inherit Dieter gray through decorative Tokyo masks", async ({
  page,
}) => {
  const unexpectedMutations = await guardUnexpectedMutations(page);
  await page.goto(FAQ_PATH, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.fonts.ready);

  const section = page.locator(".ck-subpageCards");
  await expect(section).toBeVisible();
  const glyphs = section.locator(".ck-subpageCards__icon > [data-dieter-icon]");
  await expect(glyphs).toHaveCount(EXPECTED_ICONS.length);
  await expect(section.locator(".ck-subpageCards__icon img")).toHaveCount(0);
  await expect(section.getByRole("img")).toHaveCount(0);

  for (const [index, iconName] of EXPECTED_ICONS.entries()) {
    const glyph = glyphs.nth(index);
    await expect(glyph).toHaveAttribute("data-dieter-icon", iconName);
    await expect(glyph).toHaveAttribute("aria-hidden", "true");
    await expect(glyph).toHaveAttribute("role", "presentation");
    const result = await glyph.evaluate((element) => {
      const style = getComputedStyle(element);
      const bounds = element.getBoundingClientRect();
      return {
        width: bounds.width,
        height: bounds.height,
        color: style.color,
        backgroundColor: style.backgroundColor,
        maskImage: style.maskImage,
        maskPosition: style.maskPosition,
        maskSize: style.maskSize,
        maskRepeat: style.maskRepeat,
        webkitMaskImage: style.webkitMaskImage,
        webkitMaskPosition: style.webkitMaskPosition,
        webkitMaskSize: style.webkitMaskSize,
        webkitMaskRepeat: style.webkitMaskRepeat,
      };
    });

    expect(result.width).toBe(40);
    expect(result.height).toBe(40);
    expect(result.color).toBe("rgb(112, 112, 117)");
    expect(result.backgroundColor).toBe("rgb(112, 112, 117)");
    expect(result.maskImage).toContain(
      `https://tokyo.dev.clickeen.com/dieter/icons/svg/${iconName}.svg`,
    );
    expect(result.webkitMaskImage).toBe(result.maskImage);
    expect(result.maskPosition).toBe("50% 50%");
    expect(result.webkitMaskPosition).toBe("50% 50%");
    expect(result.maskSize).toBe("contain");
    expect(result.webkitMaskSize).toBe("contain");
    expect(result.maskRepeat).toBe("no-repeat");
    expect(result.webkitMaskRepeat).toBe("no-repeat");
  }
  expect(unexpectedMutations).toEqual([]);
});
