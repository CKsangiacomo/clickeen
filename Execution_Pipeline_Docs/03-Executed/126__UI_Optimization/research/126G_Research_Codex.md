# 126G Ops - Codex Research

Status: CODEX ONLY - Phase 1 step 3. First-party sources only; not doctrine.

## Sources

- Material 3 design tokens: https://m3.material.io/foundations/design-tokens
- Material 3 Figma design kit: https://m3.material.io/blog/material-3-figma-design-kit
- Apple Human Interface Guidelines - Color: https://developer.apple.com/design/human-interface-guidelines/color
- Apple Human Interface Guidelines - Typography: https://developer.apple.com/design/human-interface-guidelines/typography
- Apple Design Resources: https://developer.apple.com/design/resources/
- Apple custom symbol images: https://developer.apple.com/documentation/uikit/creating-custom-symbol-images-for-your-app
- OpenAI Apps SDK - UI guidelines: https://developers.openai.com/apps-sdk/concepts/ui-guidelines
- OpenAI Apps SDK - Build a custom UX: https://developers.openai.com/apps-sdk/build/chatgpt-ui
- OpenAI Apps SDK - Reference: https://developers.openai.com/apps-sdk/reference
- OpenAI Apps SDK - State management: https://developers.openai.com/apps-sdk/build/state-management
- OpenAI Apps SDK - Define your tools: https://developers.openai.com/apps-sdk/plan/tools
- OpenAI Apps SDK - Optimize metadata: https://developers.openai.com/apps-sdk/guides/optimize-metadata
- OpenAI Apps SDK - Testing: https://developers.openai.com/apps-sdk/deploy/testing
- OpenAI Apps SDK - App submission guidelines: https://developers.openai.com/apps-sdk/app-submission-guidelines
- OpenAI Apps SDK - Submission and review: https://developers.openai.com/apps-sdk/deploy/submission

## Findings

- Material treats design tokens as named decisions shared between design and implementation, not as raw values. This supports a Clickeen ops audit distinction between named semantic tokens and one-off visual literals.
- Material's Figma kit carries system metadata such as token names, color values, accessibility information, and variants. This supports a Clickeen ops audit distinction between canonical source artifacts and generated/exported derivatives.
- Apple uses semantic system colors and platform typography primitives that adapt across modes, backgrounds, and accessibility settings. This supports a Clickeen ops audit focus on source meaning, not just captured pixel values.
- Apple provides official UI kits, templates, color resources, icon tools, SF Symbols, and Icon Composer resources. This supports a Clickeen ops audit requirement that UI artifacts remain traceable to official source systems or Clickeen-owned structured source.
- Apple icon tooling separates layered/editable source from flattened exports. This supports a Clickeen ops audit distinction between source SVG/icon truth and generated runtime artifacts.
- OpenAI Apps SDK hosted UI uses explicit component resources, iframes, CSP/resource domains, and UI templates. This supports a Clickeen ops audit that treats serving origin, resource URI, and CSP-like boundaries as operational facts.
- OpenAI tool results separate `structuredContent`, `content`, and `_meta`; `_meta` is delivered to the component and hidden from the model. This supports a Clickeen ops audit distinction between model-visible content, component hydration data, and private metadata.
- OpenAI state guidance separates authoritative business data, ephemeral widget UI state, and durable cross-session state. This supports a Clickeen ops audit distinction between product data truth and UI operational state.
- OpenAI tool metadata and annotations describe behavior, read/write state, and side effects. This supports a Clickeen ops audit focus on whether UI operations advertise their real mutation boundary.
- OpenAI evaluation guidance emphasizes recorded prompts, tool calls, arguments, renderings, revision logs, and release-over-release comparison. This supports a Clickeen ops audit distinction between manual visual inspection and replayable verification evidence.

## Non-Binding Recommendations

- UI ops should preserve clear authority between source artifacts, generated repo artifacts, deployed runtime artifacts, and product data.
- UI ops should keep design tokens as named semantic decisions instead of allowing raw visual values to become operational truth.
- UI ops should preserve traceability from canonical source artifacts to generated outputs.
- UI ops should treat hosted UI resource boundaries as part of the operational contract.
- UI ops should keep model-visible data, UI hydration data, and private metadata separated.
- UI ops should make mutation boundaries explicit: read-only, write, destructive, open-world, or runtime-serving behavior should not be ambiguous.
- UI ops should prefer replayable verification evidence over one-time visual inspection when generated artifacts and deployed assets are involved.
- These are non-binding Phase 1 recommendations only. They do not select fixes before human convergence.

## Source-Specific Implications For 126G

### Material

- Material token guidance maps directly to Clickeen's Dieter token lane. The important ops lesson is not "copy Material tokens"; it is that tokens are named decisions and should remain traceable through generation, preview, and runtime use.
- Material metadata/variant guidance maps to Clickeen component/source governance. Ops should be able to answer whether a preview or generated artifact came from a canonical component source and variant, not from a hand-edited generated file.

### Apple

- Apple platform color/type/icon guidance maps to Clickeen's need for platform-aware, system-compatible UI primitives. Ops should avoid treating a screenshot or visual copy as the source of truth when an official system primitive or Clickeen structured source exists.
- Apple export tooling reinforces a source-vs-export distinction. For Clickeen, that means `dieter/**` source, `tokyo/product/dieter/**` generated output, and R2 deployed objects should stay separate in docs and operations.

### OpenAI

- OpenAI hosted UI guidance maps strongly to Clickeen's agent-operated architecture. UI resources, metadata, runtime state, and tool contracts are operational boundaries, not presentation details.
- OpenAI `_meta` separation is relevant to the previous Clickeen meta issue because hidden component metadata and model-visible content must be intentionally separated. For 126G, the lesson is operational separation, not adding new metadata machinery.
- OpenAI state guidance supports Clickeen's product law: authoritative product data must stay with product routes/backends, while UI state can remain local/ephemeral/durable only according to its authority.

## Compliance Notes

- Research used first-party Google Material, Apple Developer, and OpenAI documentation only.
- No third-party blogs, Reddit, StackOverflow, or secondary explainers were used.
- Findings are directional and non-binding.
- No source research item authorizes a Step 4 fix during Phase 1.
