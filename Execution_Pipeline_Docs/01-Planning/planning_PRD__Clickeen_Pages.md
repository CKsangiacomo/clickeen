# Planning PRD — Clickeen Pages

Status: **DEFERRED — NOT IN EXECUTION AND NOT CURRENT PRODUCT TRUTH**

Owner: Clickeen product owner/architect

Originally planned: 2026-08-05

De-numbered: 2026-08-09

## Why This Document Exists

This is the de-numbered planning memo for the former numbered Clickeen Pages
program.

The former program was executed and then explicitly removed when Clickeen
pivoted away from Account Pages. Its source code, routes, account storage,
navigation, Page Builder, Page catalogs, templates, public-serving paths, and
active execution documentation are not part of the current product.

This memo preserves the product idea without reserving an execution number and
without describing the removed implementation as current truth. It does not
authorize implementation, compatibility code, storage retention, migrations,
or future execution. If Clickeen Pages is reconsidered, the human product
owner/architect must approve a new execution plan against the system that
exists at that time.

## Product Idea

A Clickeen Page would be an ordered collection of saved Widget Instances. A
customer would arrange those Instances in a Page Builder and explicitly save a
complete Page package:

```text
structured Page source
+ index.html
+ styles.css
+ runtime.js
```

Tokyo would store and serve the saved files. Saving, updating, translating,
publishing, and unpublishing would remain explicit customer actions. Public
requests would serve saved truth and would not run models, regenerate the Page,
or repair source.

## Product Direction Preserved For Future Planning

If the idea is reconsidered, the prior direction was:

1. A Page contains ordered same-account Widget Instance references.
2. It does not copy Widget source or use public Widget URLs as authoring truth.
3. Page editing happens in browser memory until explicit Save.
4. Page output contains complete initial HTML; JavaScript adds behavior rather
   than creating the primary content.
5. Save writes exact Page source and exact generated files.
6. Publish exposes already-saved files and does not compile or translate.
7. Updating an included Widget does not autonomously rebuild a Page.
8. A customer explicitly updates a Page when included saved Widget truth has
   changed.
9. Page Builder should reuse established Bob and Dieter interactions rather
   than create another design system or Widget editor.
10. Page translation, if restored, should use the existing Translation Agent
    and exact locale overlays through the owning product routes.
11. Templates and catalogs, if restored, should remain explicit reusable
    source and not create parallel runtime authorities.
12. Public serving should continue to obey the saved-truth, named-authority,
    and no-fallback tenets.

## Former Proposed Product Surfaces

The removed program had proposed or implemented:

- Your pages;
- Page Builder;
- Page source and saved package files;
- Page publish and public serving;
- explicit Page update state;
- Page templates;
- Page catalog management;
- Page SEO/GEO/AEO fields;
- Page locale overlays;
- a browser Web Code Generator shared with Widget work.

None of these items is current product behavior merely because it is recorded
here.

## Re-entry Gate

Before any future Pages work begins, a new planning pass must establish:

- the current customer use case;
- the current Roma, Bob, Tokyo-worker, Translation Agent, Dieter, and Prague
  boundaries;
- whether Pages is still the smallest product answer;
- current source, storage, route, account, policy, and public-runtime
  coordinates;
- which prior ideas remain valid and which are obsolete;
- a new explicit execution number and staged verification plan.

The old execution evidence must not be restored as a current authority. Git
history remains the historical record of what was built and later removed.

## Explicit Non-Authority

This planning memo does not authorize:

- restoring Account Pages code or data;
- restoring former Page routes or navigation;
- restoring Page Builder or Bob return-to-Page behavior;
- restoring Page templates or catalogs;
- restoring `pages.max`, Page IDs, or Page-specific policy;
- retaining or recreating obsolete R2 Page objects;
- adding compatibility readers for the removed product;
- changing Prague;
- changing current Widget compilation, saving, translation, or public serving.
