# Comms Systems Planning

Status: PLANNING — NOT BUILT

This folder holds all planning for Clickeen's communications infrastructure —
every channel Clickeen uses to send messages to users and prospects: email,
SMS, and future channels.

## Agent-Operated, Not Code-Operated

Emails and texts are sent by **agents**, not by code paths. The comms authority
is the equivalent of San Francisco for messaging — agents call it, it executes
the send through the provider. No code path directly calls an email or SMS API.

The agent decides **when** to send, **what** to send, through **which channel**.
The comms authority handles provider routing, templates, rate limiting, bounce
handling, and logging.

This is the AI-native pattern: the system's structure (comms authority +
message artifacts) is the interface. Agents operate it.

## Language Rule

Every message is sent in a language determined by one simple rule:

- **Users** (have a Clickeen account): email/SMS language = **UI language**. The
  language the user has their Clickeen interface set to. No separate email
  language preference — the UI language IS the email language. Change your UI
  language, your emails follow.
- **Prospects** (no account, captured by SDR Copilot): email language = **Prague
  locale at capture time**. When a visitor browsing Prague in German clicks and
  their email is captured, the prospect sequence sends in German. The locale is
  a snapshot at capture time.

When a prospect becomes a user (Berlin account creation), they choose their UI
language during signup. That takes over — it may differ from the captured Prague
locale, and that's fine.

## Message Classes

### Email — four classes

| Class | Type | Audience | Trigger | Unsubscribe |
| --- | --- | --- | --- | --- |
| **1. Universal product** | Transactional | All users | User action or system event | No (operational) |
| **2. Tier-specific product** | Product state + commercial | Users on specific tiers | Real product event (limit hit, usage, tier change) | Preference-managed |
| **3. Marketing both-audience** | Campaign | Prospects + users | Campaign schedule | Yes (legally required) |
| **4. Marketing prospect-only** | Conversion | Prospects only | Lifecycle (SDR Copilot capture) | Yes (legally required) |

Classes 1 and 2 are product emails (triggered by product state). Classes 3 and
4 are marketing emails (campaign/lifecycle-driven). Class 2 is the gray zone —
product-triggered but with commercial intent. See the Product Boundary PRD for
full detail.

### SMS — step-up security only

SMS is not a login method. It is a verification channel for sensitive
operations: phone setup, email change OTP, identity removal, social provider
switch. Single-use, TTL-bounded, rate-limited.

## Lifecycle Transitions

The comms system automatically adjusts email flows when recipient status
changes:

- **Prospect → User** (Berlin account creation): class 4 stops, class 3
  continues with user CTAs, class 2 activates for the user's tier
- **Free → Paid** (tier upgrade): class 2 adjusts to the new tier's limits and
  features
- **Hard bounce**: all classes stop for that address
- **Marketing unsubscribe**: classes 3 and 4 stop, classes 1 and 2 continue

## Connections to Other Systems

| System | Connection |
| --- | --- |
| Berlin GA Auth | Triggers class 1 emails (verification, reset) and SMS (OTP). Account creation triggers lifecycle transitions. |
| SDR Copilot | Captures prospect emails → feeds class 4 conversion sequence. |
| DevOps Agent | Scouts free-tier LLMs for SDR Copilot. Monitors comms cost and capacity. |
| Roma/Bob | Tier state drives class 2 emails. Product agents trigger sends through the comms authority. |

## Folder Contents

### Planning PRDs

- `planning_PRD__Comms_Product_Boundary.md` — what gets sent, who triggers it,
  the four email classes, SMS, lifecycle transitions, consent sources.
- `planning_PRD__Comms_Provider_And_Domain_Policy.md` — which providers, which
  subdomains, vendor decisions, class 2 routing ambiguity.
- `planning_PRD__Comms_Runtime_And_Observability.md` — send record, suppression
  logic, preference center, rate limiting, delivery tracking.

### Research

- `research__Cloudflare_Email_Service_Deep_Technical_Analysis.md` — email
  vendor research. Recommends Postmark for auth-critical, Cloudflare for
  notifications.
- `research__SMS_Providers.md` — SMS vendor research stub (Twilio, Amazon SNS,
  MessageBird).

### Auth requirements (in Berlin_GA_Authentication/)

- `Berlin_GA_Authentication/auth_email_requirements.md` — what auth needs from
  email.
- `Berlin_GA_Authentication/auth_sms_requirements.md` — what auth needs from
  SMS.

## Product Law

- Auth-critical messaging (class 1) cannot depend on an experimental path
  unless the product owner explicitly accepts that risk.
- Marketing messaging (classes 3, 4) must have working unsubscribe and
  compliance with CAN-SPAM and GDPR.
- No silent provider fallback. If the configured provider fails, the operation
  fails explicitly — it does not silently switch providers.
- Every send is logged by the comms authority. The send record is under
  Clickeen's control, not only in the provider's dashboard.
- Email and SMS are coupled dependencies for the auth system. The vendor
  selection considers both channels together.
- Planning docs here do not create implementation work until promoted into
  `02-Executing/`.
