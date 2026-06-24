# Email Service Planning

Status: PLANNING - NOT BUILT

This folder holds future planning for Clickeen's email service plane.

It exists because email is not one feature. Email has separate product
authorities, risk levels, deliverability requirements, and future agent
interfaces. A raw vendor analysis does not belong in strategy and is not enough
to execute from.

## Current Folder Contents

- `research__Cloudflare_Email_Service_Deep_Technical_Analysis.md`
  - vendor research and supporting evidence;
  - not product truth;
  - not an execution PRD.

## Planning Work Needed

Future email-service planning should be split into a small set of PRDs:

1. `planning_PRD__Email_Service_Product_Boundary.md`
   - defines which Clickeen surfaces send email;
   - separates auth-critical email, product notification email, workspace email,
     support email, and future agent email;
   - names the owning product authority for each email type.

2. `planning_PRD__Email_Service_Provider_And_Domain_Policy.md`
   - decides provider by email class;
   - decides domain/subdomain segmentation;
   - records whether Cloudflare Email beta status is acceptable for each class;
   - defines no-silent-fallback behavior for provider failures.

3. `planning_PRD__Email_Service_Runtime_And_Observability.md`
   - defines send routes, logs, delivery evidence, retry policy, queue usage,
     and operator visibility;
   - defines what success and failure mean for each email class.

4. `planning_PRD__Email_Agent_Interface.md`
   - future scope for inbound email and email-operated agents;
   - defines when email can become an agent interface;
   - keeps support/email agents out of the current runtime until explicitly
     built.

## Product Law

- Auth-critical email is high risk. Login, password reset, magic links, and OTP
  cannot depend on an experimental path unless the product owner explicitly
  accepts that risk.
- Product notification email is lower risk but still must be observable.
- Email sending must not silently switch provider after the send contract is
  chosen. If a provider policy supports multiple providers, selection happens
  before send, not as hidden fallback after failure.
- Future inbound email agents must treat incoming email as untrusted external
  content. Email text may be data for an agent, but it is not authority to
  mutate Clickeen product truth.
- Planning docs here do not create implementation work until promoted into
  `02-Executing`.

## Research Summary

The moved Cloudflare research suggests:

- Cloudflare Email may fit Clickeen product notifications and future
  worker/agent-native email interfaces because it is Workers-native and supports
  inbound/outbound flows.
- Cloudflare Email is less proven for auth-critical delivery than specialized
  transactional providers such as Postmark.
- A likely future policy is provider segmentation by email class rather than one
  universal email provider.

The future PRDs must verify those assumptions against current Cloudflare,
provider, product, and deliverability reality before execution.
