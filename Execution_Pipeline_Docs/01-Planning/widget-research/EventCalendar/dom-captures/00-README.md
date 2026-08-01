# Event Calendar — captured evidence

Primary-source captures taken 2026-07-31 while executing
`../../WidgetCompetitorResearchSteps.md` against a live authenticated Elfsight
free account.

## What is here

Numbered `.txt` files, one per procedure step, containing the exact page text or
accessibility tree as rendered. These are the evidence behind
`../EventCalendar_competitoranalysis.md`.

Text rather than images, deliberately and partly by necessity:

- **By necessity** — the browser surface used for this research returns
  screenshots into the agent context but does not write image files to a path
  the agent can reach. `save_to_disk: true` was tested and produced no reachable
  file.
- **By preference** — for a build specification, exact control labels, option
  values, and counts are more useful than a PNG. They are greppable, diffable,
  and survive a competitor redesign as a dated record of what was true.

## Screenshots

`../screenshots/` is created and empty. Images have to be added by a human
dragging them in, or by a capture surface that can write files.

Repo convention for these, from the two prior widgets that have them:

- `InstagramFeed/screenshots/` — numbered and named, e.g. `04-templates-page.png`
- `LogoShowcase/CompetitorAnalysis/` — raw macOS `Screenshot ….png` filenames

`InstagramFeed`'s convention is the better one. Match it.

### Screenshots worth having for Event Calendar

Ordered by value, and none of them exist yet:

| # | Shot | Why it matters |
| --- | --- | --- |
| 01 | Create → template picker, full screen | The step the procedure exists for; shows count, categories, live preview |
| 02 | Template picker category filter expanded | Category names and counts |
| 03 | Each distinct layout template (list, sidebar, month grid, hero) | Proves templates vary structurally for this widget |
| 04 | Editor, each rail section | The control inventory |
| 05 | Layout panel with all 8 layout options visible | The layout axis is this widget's defining feature |
| 06 | A month-grid rendering | The layout we have no equivalent for |
| 07 | Event item editor, expanded | Per-event field set |
| 08 | Filters/categories UI as a visitor sees it | Runtime interaction model |

## Prior-art gap

No equivalent captures exist for the Calculator, Countdown, FAQ, or Google
Reviews passes run on 2026-07-31. Roughly forty screenshots were taken across
those and none were saved. Their documents carry the findings in text; the
visual evidence is gone and would need re-capture.
