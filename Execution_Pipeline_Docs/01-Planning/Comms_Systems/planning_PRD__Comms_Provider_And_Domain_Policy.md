# Planning PRD — Comms Provider and Domain Policy

Status: **DRAFT — REQUIRES HUMAN ACCEPTANCE**

## What this is

Defines which providers send which message classes, how domains are segmented
for reputation isolation, and the vendor selection criteria. This is the WHICH
— which provider, which subdomain. What gets sent and who triggers it is in the
Product Boundary PRD. How sends are tracked is in the Runtime & Observability
PRD.

## The three provider types

Clickeen needs three types of messaging provider. One comms authority manages
all three.

### 1. Transactional email provider

Handles **class 1** (universal product — verification, reset, email change).

Requirements:
- Highest deliverability bar — if verification email hits spam, registration
  is blocked
- Low latency — user is waiting
- Delivery receipts and bounce webhooks
- No marketing features needed (no campaigns, no unsubscribe automation)
- Open/click tracking not required (these are operational emails)

Candidates (from existing research):
- **Postmark** — 16-year deliverability track record, dedicated transactional
  IPs, 45-day full-content log. Best-in-class for transactional. Does not do
  SMS or marketing.
- **Cloudflare Email Service** — Workers-native, auto SPF/DKIM/DMARC, cheap.
  Public beta (April 2026), shared IPs, unproven deliverability at scale. Good
  for notifications, risky for auth-critical.

Recommended split (from existing research):
- `auth.clickeen.com` → Postmark (class 1 auth-critical: verification, reset)
- `notify.clickeen.com` → Cloudflare (class 1 notifications: security alerts,
  publication notices)

This split means a Cloudflare deliverability issue never poisons verification
email delivery.

### 2. Marketing email platform

Handles **classes 2, 3, 4** (tier-specific product, both-audience marketing,
prospect-only conversion).

Requirements:
- List management (segments by audience status, tier, engagement)
- Campaign builder (design, schedule, A/B test)
- Unsubscribe automation (legally required for classes 3, 4)
- Open/click/conversion tracking
- CAN-SPAM/GDPR compliance (automatic unsubscribe processing, sender
  identification)
- Preference center integration
- Dynamic content (different CTA by audience status in class 3)
- Lifecycle trigger integration (class 4 stops on account creation)

Candidates:
- Specialized marketing platforms (Customer.io, ConvertKit, Mailchimp,
  SendGrid Marketing, ActiveCampaign)
- This is a different category from transactional providers. Postmark and
  Cloudflare Email are NOT marketing platforms.

**This provider is not yet researched.** A vendor research doc needs to be
written for marketing email platforms, similar to the Cloudflare/Postmark
research.

### 3. SMS provider

Handles SMS OTP for step-up security.

Requirements:
- Global reach (Clickeen users are global)
- High deliverability (OTP must reach the device)
- Low latency (user is waiting)
- Delivery receipts
- Rate limiting controls

Candidates (from existing research stub):
- **Twilio** — market leader, also offers SendGrid (potential dual-channel)
- **Amazon SNS** — cheaper, pairs with AWS SES
- **MessageBird** — EU-strong, offers both email and SMS

See `research__SMS_Providers.md` for the comparison stub.

## Subdomain segmentation

Each subdomain builds its own deliverability reputation. A spam complaint on
one subdomain does not affect another.

| Subdomain | Provider | Classes | Purpose |
| --- | --- | --- | --- |
| `auth.clickeen.com` | Postmark | 1 (auth-critical) | Verification, password reset, email change verification |
| `notify.clickeen.com` | Cloudflare Email | 1 (notifications) | Security alerts, publication notices, operational notifications |
| Marketing subdomain | Marketing platform | 2, 3, 4 | Tier-specific emails, both-audience campaigns, prospect sequences |

### Why class 2 goes through the marketing subdomain

Class 2 (tier-specific product emails) is product-triggered but has commercial
intent. Spam filters may treat it as marketing. If it goes through
`auth.clickeen.com` (Postmark, transactional reputation) and gets flagged as
marketing, it could poison the deliverability of verification and reset emails.

Routing class 2 through the marketing subdomain:
- Isolates the commercial-intent emails from the auth-critical reputation
- Gives access to marketing platform features (tracking, preference management,
  unsubscribe automation) that class 2 needs
- Keeps the auth subdomain clean for pure transactional emails only

The trade-off: class 2 emails lose the Postmark deliverability advantage. But
class 2 is not as critical as class 1 — a delayed "you hit your limit" email is
inconvenient, not blocking. A delayed verification email blocks registration.

## The dual-channel vendor question

Email and SMS are coupled dependencies for the auth system. The vendor
selection should consider whether to use one vendor for both channels or
separate vendors.

### Option A: Separate best-in-class vendors

| Channel | Provider | Trade-off |
| --- | --- | --- |
| Transactional email | Postmark | Best deliverability |
| Marketing email | Marketing platform | Best campaign features |
| SMS | Twilio | Best global reach |

Three vendors, three integrations, three billing relationships. Best
capabilities per channel, most operational complexity.

### Option B: Dual-channel vendor

| Channel | Provider | Trade-off |
| --- | --- | --- |
| Transactional email | Twilio SendGrid | Good but below Postmark for transactional |
| Marketing email | Twilio SendGrid | Has marketing features |
| SMS | Twilio | Same vendor, same account |

One vendor, one integration, one billing relationship. Less operational
complexity, but SendGrid's transactional deliverability is below Postmark and
its marketing features are not best-in-class.

### Option C: Hybrid

| Channel | Provider | Trade-off |
| --- | --- | --- |
| Transactional email (auth-critical) | Postmark | Best deliverability for the emails that matter most |
| Marketing email | Marketing platform | Best campaign features |
| SMS | Twilio or SNS | Best global reach or cheapest |

Postmark for the emails that can't fail (verification, reset). Marketing
platform for campaigns. SMS vendor chosen independently. Postmark doesn't do
SMS, so SMS is separate regardless.

**This is a product-owner decision.** The research supports Option C (hybrid)
but the operational simplicity of Option B (dual-channel) has real value for a
one-human company.

## Provider selection status

| Provider type | Status | Research doc |
| --- | --- | --- |
| Transactional email | Researched (Postmark + Cloudflare) | `research__Cloudflare_Email_Service_Deep_Technical_Analysis.md` |
| Marketing email | **Not researched** | Needs a new research doc |
| SMS | Stub only | `research__SMS_Providers.md` (needs completion) |

## Multilingual template requirements

Every email template must have locale variants matching the UI languages
Clickeen supports. The comms authority renders the template in the recipient's
language (UI language for users, captured Prague locale for prospects).

Requirements:
- **UTF-8 / Unicode** — all providers must support full Unicode for non-Latin
  scripts (CJK, Cyrillic, Arabic, etc.)
- **RTL support** — Arabic, Hebrew, and other RTL languages need RTL email
  templates (CSS `direction: rtl`, text alignment). Not all email clients
  handle RTL well — templates must be tested in major clients.
- **SMS encoding** — non-Latin scripts use UCS-2 encoding (70 chars/message
  vs 160 for GSM). OTP wrapper text must stay short. Some SMS providers charge
  more for UCS-2 or require multi-part messages.

## International SMS costs

SMS costs vary enormously by destination country. The comms authority must
track per-country SMS spend (part of the DevOps Agent's cost monitoring).

Decisions still needed:
- Is phone verification available in all markets, or limited to cost-effective
  ones?
- What happens when SMS delivery is unreliable in a specific market?
- Some countries require sender ID pre-registration or don't support
  alphanumeric sender IDs.

These are product decisions that affect PLG economics in specific markets.

## No-silent-fallback rule

If the configured provider for a message class is unavailable, the operation
fails explicitly. The comms authority does not silently switch to a backup
provider.

This is Tenet 3 (no silent substitution). A failed email send is reported to
the requesting agent and to the user ("we couldn't send your verification
email, please retry"). It is not silently routed through a different provider
that might have different deliverability characteristics.

Provider failover (if implemented in the future) must be an explicit policy
decision made before the send, not a hidden fallback after a failure.

## What this PRD does not own

| Concern | Owner |
| --- | --- |
| What gets sent, who triggers it | Product Boundary PRD |
| Send record format and storage | Runtime & Observability PRD |
| Suppression and preference logic | Runtime & Observability PRD |
| Template design | Comms authority + Dieter |
| Marketing campaign content | Product marketing |
