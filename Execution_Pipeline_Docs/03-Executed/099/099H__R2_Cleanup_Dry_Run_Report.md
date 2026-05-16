# PRD 099H R2 Cleanup Dry Run Report

Generated: 2026-05-15T18:28:08.985Z

Bucket: `tokyo-assets-dev`

Status: **READY**

## Targeted Deletions

No R2 deletion was performed by this dry run.

| group | objects | bytes |
| --- | ---: | ---: |
| accounts/{uuid}/assets/ | 26 | 1527702 |
| accounts/{uuid}/instances/ | 219 | 108877 |
| accounts/{uuid}/widgets/ | 565 | 1097668 |
| l10n/ | 1041 | 3759315 |
| public/ | 18 | 15837 |
| published/ | 8 | 1617 |
| widgets/ | 2 | 676 |

Total targeted objects: 1879  
Total targeted bytes: 6511692

## Asset Copy Gate

Admin asset copies needed before deletion: 26

## New Model Verification

Widgets:

| widget | objects | catalog | spec | runtime |
| --- | ---: | --- | --- | --- |
| countdown | 9 | true | true | true |
| faq | 8 | true | true | true |
| logoshowcase | 23 | true | true | true |

Admin instances:

| instance | objects | instance.json | config.json | publish.json | published/config.json |
| --- | ---: | --- | --- | --- | --- |
| UZ3JEJSHII | 118 | true | true | true | true |
| H7IF9M2K9B | 60 | true | true | true | true |
| 8FMVZFFPJV | 4 | true | true | true | true |

Admin public asset objects: 26  
Old UUID asset objects: 26  
Prague objects: 434

Failures:

- none
