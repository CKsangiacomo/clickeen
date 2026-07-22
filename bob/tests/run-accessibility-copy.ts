import assert from "node:assert/strict";
import { createRequire } from "node:module";

const runtimeRequire = createRequire(import.meta.url);
runtimeRequire.extensions[".css"] = () => undefined;

async function run() {
  const {
    CopilotUserFacingError,
    normalizeErrorMessage,
    resolveCopilotCaughtError,
  } = await import("../components/CopilotPane");
  const { resolveSessionErrorLines } = await import("../components/ToolDrawer");
  const {
    resolveSavedTranslationLocaleReadResult,
    resolveSavedTranslationReadFailure,
    resolveSavedTranslationReadState,
  } = await import("../components/useTranslationPreviewState");
  const { shouldBlockSavedTranslationPreview } = await import(
    "../components/Workspace"
  );
  const { normalizeTranslatedLocales } = await import(
    "../lib/translations-preview"
  );

  const saveLines = resolveSessionErrorLines({
    source: "save",
    message: "coreui.errors.db.writeFailed",
    detail: "RAW_SAVE_DETAIL_SENTINEL",
    paths: ["header.title", "sections.0.title"],
  });
  assert.deepEqual(saveLines, [
    "Saving changes failed. Please try again.",
    "Paths: header.title, sections.0.title",
  ]);
  assert.doesNotMatch(saveLines.join(" "), /RAW_SAVE_DETAIL_SENTINEL/);

  const issueOnlyFailure = normalizeErrorMessage({
    parsed: {
      error: "VALIDATION",
      issues: [
        { path: "header.title", message: "Title is required" },
        { path: "sections.0.title", message: "Section title is required" },
      ],
    },
    fallback:
      "Copilot could not complete the request. Please try again with a smaller change.",
  });
  assert.match(issueOnlyFailure, /header\.title: Title is required/);
  assert.match(
    issueOnlyFailure,
    /sections\.0\.title: Section title is required/,
  );
  assert.equal(
    resolveCopilotCaughtError(new CopilotUserFacingError(issueOnlyFailure)),
    issueOnlyFailure,
  );
  assert.equal(
    resolveCopilotCaughtError(new Error("RAW_COPILOT_EXCEPTION_SENTINEL")),
    "Copilot failed unexpectedly. Please try again.",
  );
  assert.equal(
    resolveCopilotCaughtError("RAW_COPILOT_THROWN_VALUE_SENTINEL"),
    "Copilot failed unexpectedly. Please try again.",
  );

  for (const status of [400, 401, 403, 404, 409, 422, 500, 503]) {
    assert.equal(
      resolveSavedTranslationReadFailure({ ok: false, status }),
      "Saved translations could not be read.",
    );
  }
  assert.equal(
    resolveSavedTranslationReadFailure({ ok: true, status: 200 }),
    null,
  );
  assert.deepEqual(
    normalizeTranslatedLocales({ baseLocale: "en", translations: [] }),
    { baseLocale: "en", translations: [] },
  );

  assert.deepEqual(
    resolveSavedTranslationReadState({
      list: { loading: true, error: null },
      locale: { loading: false, error: null },
    }),
    { loading: true, error: null },
  );
  assert.deepEqual(
    resolveSavedTranslationReadState({
      list: { loading: false, error: "List read failed" },
      locale: { loading: false, error: null },
    }),
    { loading: false, error: "List read failed" },
  );
  assert.deepEqual(
    resolveSavedTranslationReadState({
      list: { loading: false, error: null },
      locale: { loading: false, error: "Locale read failed" },
    }),
    { loading: false, error: "Locale read failed" },
  );
  assert.deepEqual(
    resolveSavedTranslationReadState({
      list: { loading: false, error: "List read failed" },
      locale: { loading: false, error: "Locale read failed" },
    }),
    { loading: false, error: "List read failed" },
  );

  const currentLocaleRead = {
    locale: "de",
    loading: true,
    error: null,
  };
  assert.equal(
    resolveSavedTranslationLocaleReadResult({
      current: currentLocaleRead,
      requestedLocale: "fr",
      error: "Stale French failure",
    }),
    currentLocaleRead,
  );
  assert.deepEqual(
    resolveSavedTranslationLocaleReadResult({
      current: currentLocaleRead,
      requestedLocale: "de",
      error: "Current German failure",
    }),
    {
      locale: "de",
      loading: false,
      error: "Current German failure",
    },
  );

  assert.equal(
    shouldBlockSavedTranslationPreview({
      previewMode: "translations",
      requestedLocale: "fr",
      baseLocale: "en",
      loading: true,
      error: null,
    }),
    true,
  );
  assert.equal(
    shouldBlockSavedTranslationPreview({
      previewMode: "translations",
      requestedLocale: "fr",
      baseLocale: "en",
      loading: false,
      error: "Saved translations could not be read.",
    }),
    true,
  );
  assert.equal(
    shouldBlockSavedTranslationPreview({
      previewMode: "translations",
      requestedLocale: "en",
      baseLocale: "en",
      loading: true,
      error: null,
    }),
    false,
  );

  console.log("accessibility copy tests passed");
}

void run();
