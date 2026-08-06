# Strategy PRD - Launch Readiness Scope

Status: Draft
Owner: Product + Architecture
Date: 2026-06-24

## What This PRD Is About

This strategy PRD names the major capability areas Clickeen needs before launch.
It is not an execution PRD and does not define implementation steps. Its job is
to keep launch scope visible, coherent, and tied to the current Clickeen product
model.

Launch means Clickeen can:

- acquire a user;
- onboard the user into Roma;
- let the user create, edit, save, publish, and serve real widget instances;
- let the user create and serve pages made from widget instances;
- translate and expose content globally;
- communicate with users and internal agents;
- bill the account;
- operate the company through the same structured product system agents use.

## Launch Principle

Clickeen is a content-serving system operated by agents.

The launch work must preserve the current architecture:

- Roma is the account app and product authority surface.
- Bob is the editor for one widget instance in browser memory.
- Tokyo stores account runtime artifacts in R2.
- Pages are stacks of saved widget instances.
- Prague is the marketing site and dogfoods Clickeen output.
- San Francisco is governed model execution.
- Product Copilot and Translation Agent are real agent homes.
- Michael/Supabase stores relational operational truth, not public runtime
  widget/page packages.

Launch work must not introduce fake product nouns, duplicate content systems,
generic frameworks, or hidden fallback paths.

## Required Launch Capability Areas

### 1. Payments Service

Clickeen needs a real billing and payments service before launch.

This includes Stripe billing, checkout, plan changes, invoices, tax handling,
account billing state, and the connection between paid state and tier
capabilities.

Why it matters:

- launch without billing is not a commercial product;
- Roma must show honest billing state;
- tier enforcement must map to real paid state;
- account limits must be explainable to users and agents.

Strategy position:

- Stripe is the likely billing provider;
- billing state belongs to the account/product authority path;
- tier capability enforcement remains product policy, not scattered UI logic;
- no unpaid feature should masquerade as available if billing does not support
  it.

### 2. Roma UI Refactor

Roma is the account app. It must feel like the real product, not scaffolding.

The current executing Roma UI Refactor exists because Roma must converge onto
Dieter components, remove parallel UI primitives, clean weak states, and stop
showing prototype/stub copy.

Why it matters:

- Roma is where users operate their account;
- Roma is also where the AI-operated company exposes product authority;
- a weak Roma makes the product feel unfinished even if backend behavior works.

Strategy position:

- no new visual language;
- Roma should reuse Dieter and shared Roma primitives;
- product behavior must remain unchanged while the UI becomes launch-grade.

### 3. Email Service

Clickeen needs an email service plane.

Email is not one thing. Launch and early operations need multiple email classes:

- auth-critical email;
- billing and account email;
- product notifications;
- workspace/user emails;
- support emails;
- prospect and lifecycle emails;
- internal agent communication;
- future inbound email interfaces for agents.

Why it matters:

- users need account and billing communication;
- agents need a controlled way to communicate and receive communication;
- product notifications need delivery evidence;
- prospect and lifecycle email are part of GTM.

Strategy position:

- email must be planned by class, not as one generic provider integration;
- auth-critical email has a higher reliability bar than product notifications;
- provider choice must be explicit before send;
- no silent provider fallback after failure;
- inbound email to agents is untrusted external content, not authority to mutate
  product truth.

### 4. SEO/GEO/AEO for Widgets and Pages

Clickeen needs system SEO/GEO/AEO for the real served surfaces:

- widget instances;
- pages composed of widget instances.

There is no page-block SEO model.

Why it matters:

- Clickeen's largest distribution moat depends on crawlable, localized,
  structured content;
- widget-level SEO/GEO/AEO makes each widget a machine-readable content surface;
- page-level SEO/GEO/AEO makes stacks of widget instances rank as complete
  pages;
- answer engines increasingly decide what users see before they click.

Strategy position:

- widget outputs may emit widget-owned schema and answer-ready content;
- page outputs own page metadata, canonical/hreflang, combined schema, and
  page-level ranking intent;
- public serving uses generated artifacts only;
- visitor requests must not call agents or models;
- the future SEO/GEO/AEO Agent measures and proposes improvements asynchronously.

### 5. Prague Pages Built from Clickeen Widgets

Prague must present Clickeen by using Clickeen.

The launch marketing site should rely on real Clickeen widgets and real Clickeen
page composition wherever the product model says it should. The old Prague block
model is not the destination.

Why it matters:

- Prague is the top of funnel;
- Prague proves the product visually and structurally;
- dogfooding exposes product gaps earlier than isolated marketing code;
- users should see the same system they will use.

Strategy position:

- page-shaped marketing sections become widget instances where appropriate;
- Prague pages should be stacks of real widget instances when migrated;
- current Prague-specific structures are migration source, not future product
  truth;
- no generic composition engine should be invented for Prague.

### 6. Launch Widget Set for Prague and Product Proof

Clickeen needs enough finished widgets to make Prague credible and product
launch useful.

This means the launch widget set must be production-grade, visually strong,
documented, localizable, and capable of being used in Prague pages and customer
accounts.

Why it matters:

- widgets are the Trojan horse;
- Prague needs widget proof, not marketing claims;
- users need immediate value after signup;
- SEO/GEO/AEO depends on widget content quality.

Strategy position:

- each launch widget must have real software, defaults, editable fields,
  examples, serving artifacts, and documentation;
- Prague uses actual widget instances instead of fake previews where product
  proof matters;
- weak widgets should not be hidden behind broader launch copy.

### 7. Prague Shared Components

Prague shared components such as header, footer, nav, chrome, and repeated
marketing primitives must become launch-grade.

Why it matters:

- Prague is the first impression;
- shared chrome affects every funnel page;
- weak header/footer/navigation make the product look untrustworthy even when
  the widget surface is strong;
- Prague needs to work cleanly with account entry, widget pages, locale routes,
  and dogfooded product surfaces.

Strategy position:

- shared Prague components should be world-class and system-aligned;
- they should not become a new product framework;
- they should support Prague's role as marketing and funnel surface;
- they should point users into Roma and real product flows.

### 8. Confirmed Supabase vs Stored-File Logic for System Operations

Clickeen needs an explicit authority map for what lives in Michael/Supabase and
what lives as structured files/artifacts.

Why it matters:

- agents operate the system directly;
- they need to know whether an operation is a DB mutation, a file edit, or an R2
  artifact write;
- mixing DB truth and file truth creates hidden legacy SaaS complexity;
- system ops cannot be reliable if authority is guessed per task.

Strategy position:

- Michael/Supabase stores relational operational/account truth;
- Tokyo/R2 stores account runtime artifacts and public widget/page packages;
- product software and structured product specs live in git/product storage;
- agents operate the correct authority directly;
- the launch system needs a clear operator/spec doc that states this without
  ambiguity.

## Likely Missing Launch Areas

These are candidate launch requirements that should be confirmed, rejected, or
promoted into planning.

### Public Page and Locale Serving

SEO/GEO/AEO and Translation Agent value require crawlable locale URLs for
widgets and pages. If clk.live page/locale serving is not complete, launch scope
must name it explicitly.

### Translation Agent Launch Closure

Translation is part of the moat. Launch readiness should confirm the Translation
Agent, active locale settings, overlay writes, and Bob progress UX are real and
not partial.

### Auth, Account, Team, and Onboarding Readiness

Launch requires clean signup/login, account bootstrap, current-account routing,
team/member behavior, and first-widget onboarding.

### Publish, Embed, and Serve Reliability

The core product promise is that a user can create a widget, publish it, copy
the embed, and see it work on a real site.

### Analytics, Usage, and Reporting

Users and operators need basic usage evidence: published instances, page views,
submissions, collected data, billing usage, and agent activity where applicable.

### Support and Admin Operations

Clickeen admin should use Clickeen's own account and product routes. Launch
needs support/ticket/account-help behavior that does not require ad hoc manual
database work.

### DevOps, Monitoring, and Release Operations

Launch needs clear deploy paths, runtime checks, logs, alerting, rollback
policy, and an operator path for Cloudflare, Supabase, secrets, and R2.

### Legal, Privacy, Compliance, and Deliverability

Launch needs terms, privacy, billing/tax compliance, email unsubscribe rules,
data deletion/export posture, and provider compliance for integrations and
prospect email.

### Security and Data Protection

Launch needs confidence in account isolation, RLS/service-role boundaries,
secret storage, webhook verification, audit logs, and backup/restore paths.

### Product Documentation and Operator Docs

Documentation must be current operator/spec truth: services, AI agents, product
authorities, launch runbooks, and execution pipeline docs must not carry stale
strategy as current behavior.

## Current Planning Pointers

Known active or planned work already exists for:

- Roma UI Refactor;
- DevStudio/Dieter governance;
- Email Service planning;
- SEO/GEO/AEO widget and page surfaces;
- Prague migration from Astro blocks to Page Composer;
- planned internal agents;
- integrations.

This strategy PRD should be updated as those planning items move into execution
or are deliberately cut from launch.
