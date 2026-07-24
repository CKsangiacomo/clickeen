import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const DEVSTUDIO_ORIGIN = "https://devstudio.clickeen.com";
const COLOR_TOKENS_PATH = "/api/dieter/tokens/colors";

type ColorToken = {
  token: string;
  value: string;
  editable: boolean;
};

type ColorTokenResponse = {
  ok?: boolean;
  tokens?: ColorToken[];
};

test.use({
  baseURL: DEVSTUDIO_ORIGIN,
  storageState: "e2e/.auth/devstudio.json",
});

function extractGeneratorColorPattern(source: string): string {
  const match = source.match(
    /function isWritableColorToken\(token\)\s*\{[^}]*token\.name\.startsWith\('--color-'\)\s*&&\s*\/(\^#[^/]+)\/\.test\(token\.value\)/su,
  );
  if (!match?.[1]) throw new Error("Generator color predicate not found.");
  return match[1];
}

function extractGeneratorColorPrefix(source: string): string {
  const match = source.match(
    /function isWritableColorToken\(token\)\s*\{[^}]*token\.name\.startsWith\('([^']+)'\)/su,
  );
  if (!match?.[1]) throw new Error("Generator color token prefix not found.");
  return match[1];
}

function extractBackendColorsBlock(source: string): string {
  const block = source.match(/colors:\s*\{(?<body>[\s\S]*?)\n\s*\},/u)?.groups
    ?.body;
  if (!block) throw new Error("Backend color contract not found.");
  return block;
}

function extractBackendColorPattern(source: string): string {
  const colorsBlock = extractBackendColorsBlock(source);
  const match = colorsBlock?.match(/valuePattern:\s*\/(\^#[^/]+)\//u);
  if (!match?.[1]) throw new Error("Backend color predicate not found.");
  return match[1];
}

function extractBackendColorTokenPattern(source: string): string {
  const colorsBlock = extractBackendColorsBlock(source);
  const match = colorsBlock.match(/tokenPattern:\s*\/([^/]+)\//u);
  if (!match?.[1]) throw new Error("Backend color token predicate not found.");
  return match[1];
}

async function guardUnexpectedApiMutations(page: Page): Promise<string[]> {
  const unexpectedMutations: string[] = [];
  await page.route("**/api/**", async (route) => {
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

test("generator reveal and backend write use the same 3/6-digit predicate", async () => {
  const [generatorSource, backendSource] = await Promise.all([
    readFile(resolve("admin/scripts/generate-foundation-pages.mjs"), "utf8"),
    readFile(resolve("admin/functions/_shared/dieter-tokens.js"), "utf8"),
  ]);
  const generatorPattern = extractGeneratorColorPattern(generatorSource);
  const backendPattern = extractBackendColorPattern(backendSource);
  const generatorPrefix = extractGeneratorColorPrefix(generatorSource);
  const backendTokenPredicate = new RegExp(
    extractBackendColorTokenPattern(backendSource),
    "u",
  );

  expect(generatorPattern).toBe(backendPattern);
  const predicate = new RegExp(generatorPattern, "u");
  for (const value of ["#abc", "#ABC", "#a1b2c3", "#A1B2C3"]) {
    expect(predicate.test(value), value).toBe(true);
  }
  for (const value of [
    "#ab",
    "#abcd",
    "#abcde",
    "#abcdef0",
    "#abcdef01",
    "#abcdef012",
    "red",
  ]) {
    expect(predicate.test(value), value).toBe(false);
  }
  for (const [token, expected] of [
    ["--color-example", true],
    ["--role-example", false],
    ["--focus-example", false],
    ["--state-example", false],
  ] as const) {
    expect(token.startsWith(generatorPrefix), token).toBe(expected);
    expect(backendTokenPredicate.test(token), token).toBe(expected);
  }
});

test("deployed editable color rows equal backend truth without writes", async ({
  page,
}) => {
  const unexpectedMutations = await guardUnexpectedApiMutations(page);
  await page.goto("/#/dieter/colors");
  await expect(
    page.getByRole("heading", { name: "Colors", exact: true }),
  ).toBeVisible();

  const apiResult = await page.evaluate(async (path) => {
    const response = await fetch(path, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    return {
      status: response.status,
      body: (await response.json()) as ColorTokenResponse,
    };
  }, COLOR_TOKENS_PATH);
  expect(apiResult.status).toBe(200);
  expect(apiResult.body.ok).toBe(true);
  expect(Array.isArray(apiResult.body.tokens)).toBe(true);

  const backendEditable = (apiResult.body.tokens ?? [])
    .filter((token) => token.editable)
    .map((token) => token.token)
    .sort();
  const revealedEditable = await page
    .locator('[data-token-edit="color"][data-token]')
    .evaluateAll((elements) =>
      elements
        .map((element) => element.getAttribute("data-token"))
        .filter((token): token is string => Boolean(token))
        .sort(),
    );

  expect(revealedEditable).toEqual(backendEditable);
  expect(revealedEditable.length).toBeGreaterThan(0);
  for (const token of [
    "--role-focus",
    "--focus-ring-color",
    "--state-darken-target",
  ]) {
    await expect(page.locator(`[aria-label="Read-only ${token}"]`)).toHaveCount(
      1,
    );
    await expect(
      page.locator(`[data-token-edit="color"][data-token="${token}"]`),
    ).toHaveCount(0);
  }
  expect(unexpectedMutations).toEqual([]);
});
