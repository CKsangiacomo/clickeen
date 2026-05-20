# EXEC 103G - Save/Publish Generated Language Files

Status: Complete / Green after 103V reproof
Date: 2026-05-20
PRD: `103G__PRD__Save_Publish_Generated_Language_Files.md`

## Result

103G is green against the current source model. Publish materializes public base and translated FAQ artifacts from Tokyo-owned saved instance source plus current translated locale values, then `clk.live` serves those generated files statically.

The proof starts from a saved FAQ instance and Tokyo translated-locale values. It does not handcraft final public files, call Bob, call Roma editor state, or call San Francisco LLMs during public serving.

## Scope Executed

- Proved Tokyo materializes base and translated public artifacts from saved instance content/config and translated locale values.
- Proved publish writes public artifacts before marking the instance published.
- Proved `clk.live` serves the base entry and translated locale file statically only while the instance is published.
- Proved visitor files do not contain product widget source paths, account API paths, or internal Tokyo routes.

## Architecture Result

- Public files are generated artifacts, not source truth or publish state.
- Publish consumes current translated locale values; it does not inspect translation jobs, generation lanes, source versions, or overlay identities.
- This closes the 103G automated proof. Human Bob/Roma/public smoke remains a release/completion gate after remaining runtime slices.

## Verification

- `pnpm verify:prd103-publish-language-files` - green
- `pnpm --filter @clickeen/tokyo-worker test` - green
- `pnpm --filter @clickeen/roma test` - green

## Residual Scope

- This is not manual translation override reproof; that remains PRD 103F.
- This is not a human product smoke. Human smoke runs after runtime slices are complete enough to test end to end.
