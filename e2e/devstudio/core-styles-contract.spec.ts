import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Buffer } from "node:buffer";
import { expect, test } from "@playwright/test";
import {
  parseDieterTokenDeclarations,
  parseEditableDieterTokens,
  replaceDieterTokenValue,
  TOKEN_FILES,
} from "../../admin/functions/_shared/dieter-token-contracts.js";
import { onRequest as onFoundationRequest } from "../../admin/functions/api/dieter/tokens/foundation.js";
import { onRequest as onFoundationValueRequest } from "../../admin/functions/api/dieter/tokens/foundation/value.js";

const foundationPath = resolve(
  "dieter/tokens/dieter-foundation-tokens.css",
);
const colorPath = resolve("dieter/tokens/dieter-color-tokens.css");
const coreStylesPath = resolve(
  "admin/src/html/foundations/core-styles.html",
);

async function readSources() {
  const [foundation, colors, coreStyles] = await Promise.all([
    readFile(foundationPath, "utf8"),
    readFile(colorPath, "utf8"),
    readFile(coreStylesPath, "utf8"),
  ]);
  return { foundation, colors, coreStyles };
}

test("Core styles source, generated page, and write contract stay in exact parity", async () => {
  const { foundation, colors, coreStyles } = await readSources();
  const tokens = parseEditableDieterTokens(
    foundation,
    TOKEN_FILES.foundation,
    [colors],
  );

  expect(tokens).toHaveLength(57);
  expect(tokens.filter((token) => !token.token.startsWith("--layout-"))).toHaveLength(53);
  expect(tokens.every((token) => token.editable)).toBe(true);
  expect(coreStyles.includes('data-governance-count="53"')).toBe(true);

  for (const token of tokens.filter((entry) => !entry.token.startsWith("--layout-"))) {
    expect(
      coreStyles.includes(
        `data-token-edit="foundation" data-token="${token.token}"`,
      ),
      token.token,
    ).toBe(true);
    expect(
      coreStyles.includes(
        `data-token-value="${token.token}">${token.value}</code>`,
      ),
      token.token,
    ).toBe(true);
  }
});

test("foundation writes reject invalid geometry, references, easing, shadows, and injection", async () => {
  const { foundation, colors } = await readSources();
  const rejected = [
    ["--space-1", "var(--space-1)"],
    ["--space-1", "var(--space-9999)"],
    ["--space-2", "var(--control-padding-inline)"],
    ["--control-size-md", "-10px"],
    ["--control-radius-md", "-3rem"],
    ["--easing-standard", "cubic-bezier(9, 0, -8, 1)"],
    [
      "--shadow-elevated",
      "0 1px 2px var(--color-token-that-does-not-exist)",
    ],
    ["--space-1", "1rem; color: red"],
  ] as const;

  for (const [token, value] of rejected) {
    const result = replaceDieterTokenValue(
      foundation,
      TOKEN_FILES.foundation,
      token,
      value,
      [colors],
    );
    expect(result.ok, `${token}: ${value}`).toBe(false);
    expect("raw" in result).toBe(false);
  }

  for (const [token, value] of [
    ["--space-1", "0.5rem"],
    ["--easing-standard", "cubic-bezier(0, -2, 1, 3)"],
    [
      "--shadow-elevated",
      "0 18px 36px color-mix(in oklab, var(--color-system-black), transparent 86%)",
    ],
  ] as const) {
    const result = replaceDieterTokenValue(
      foundation,
      TOKEN_FILES.foundation,
      token,
      value,
      [colors],
    );
    expect(result.ok, `${token}: ${value}`).toBe(true);
  }
});

test("shared parser ignores comments and refuses duplicate live declarations", () => {
  const source = `:root {
  /* --space-1: 99rem; */
  --space-1: 0.25rem;
  --space-1: 0.5rem;
}
`;
  const declarations = parseDieterTokenDeclarations(source);
  expect(declarations.map((declaration) => declaration.value)).toEqual([
    "0.25rem",
    "0.5rem",
  ]);

  const tokens = parseEditableDieterTokens(source, TOKEN_FILES.foundation);
  expect(tokens).toHaveLength(2);
  expect(tokens.every((token) => !token.editable)).toBe(true);

  const result = replaceDieterTokenValue(
    source,
    TOKEN_FILES.foundation,
    "--space-1",
    "1rem",
  );
  expect(result.ok).toBe(false);
  expect("raw" in result).toBe(false);

  const unrelatedResult = replaceDieterTokenValue(
    `${source.slice(0, -2)}  --space-2: 0.5rem;\n}\n`,
    TOKEN_FILES.foundation,
    "--space-2",
    "1rem",
  );
  expect(unrelatedResult.ok).toBe(false);
  expect("raw" in unrelatedResult).toBe(false);
});

test("foundation routes preserve method and origin gates before mutation", async () => {
  const wrongReadMethod = await onFoundationRequest({
    request: new Request("https://devstudio.clickeen.com/api/dieter/tokens/foundation", {
      method: "POST",
    }),
    env: {},
  });
  expect(wrongReadMethod.status).toBe(405);

  const wrongWriteMethod = await onFoundationValueRequest({
    request: new Request(
      "https://devstudio.clickeen.com/api/dieter/tokens/foundation/value",
    ),
    env: {},
  });
  expect(wrongWriteMethod.status).toBe(405);

  const missingOrigin = await onFoundationValueRequest({
    request: new Request(
      "https://devstudio.clickeen.com/api/dieter/tokens/foundation/value",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: "--space-1", value: "0.5rem" }),
      },
    ),
    env: {},
  });
  expect(missingOrigin.status).toBe(403);
});

test("invalid authenticated foundation POST never reaches GitHub PUT", async () => {
  const { foundation, colors } = await readSources();
  const calls: Array<{ method: string; url: string }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    const method = String(init?.method ?? "GET").toUpperCase();
    calls.push({ method, url });

    if (url === "https://berlin.test/session/bootstrap") {
      return Response.json({
        activeAccount: { accountPublicId: "CLICKEEN", role: "owner" },
        authz: { accountCapsule: "test-capsule" },
      });
    }
    if (
      method === "GET" &&
      url.startsWith(
        "https://api.github.com/repos/CKsangiacomo/clickeen/contents/dieter/tokens/dieter-color-tokens.css",
      )
    ) {
      return Response.json({
        sha: "color-sha",
        content: Buffer.from(colors).toString("base64"),
      });
    }
    if (
      method === "GET" &&
      url.startsWith(
        "https://api.github.com/repos/CKsangiacomo/clickeen/contents/dieter/tokens/dieter-foundation-tokens.css",
      )
    ) {
      return Response.json({
        sha: "foundation-sha",
        content: Buffer.from(foundation).toString("base64"),
      });
    }
    throw new Error(`Unexpected fetch: ${method} ${url}`);
  }) as typeof fetch;

  try {
    const response = await onFoundationValueRequest({
      request: new Request(
        "https://devstudio.clickeen.com/api/dieter/tokens/foundation/value",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: "ck-access-token=test-access",
            origin: "https://devstudio.clickeen.com",
          },
          body: JSON.stringify({
            token: "--control-size-md",
            value: "-10px",
          }),
        },
      ),
      env: {
        BERLIN_BASE_URL: "https://berlin.test",
        DEVSTUDIO_CANONICAL_ORIGIN: "https://devstudio.clickeen.com",
        DEVSTUDIO_GITHUB_BRANCH: "main",
        DEVSTUDIO_GITHUB_REPOSITORY: "CKsangiacomo/clickeen",
        DEVSTUDIO_GITHUB_TOKEN: "test-token",
      },
    });

    expect(response.status).toBe(422);
    expect(calls.filter((call) => call.method === "PUT")).toHaveLength(0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
