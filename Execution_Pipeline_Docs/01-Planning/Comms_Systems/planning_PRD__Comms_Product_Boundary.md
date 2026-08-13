# Planning PRD — Comms Product Boundary

Status: **DRAFT — REQUIRES HUMAN ACCEPTANCE**

## What this is

Defines what messages Clickeen sends, who triggers them, and the rules that
govern each message class. This is the product boundary — WHAT and WHO.
Provider selection (WHICH provider, WHICH subdomain) is in the Provider &
Domain Policy PRD. Runtime tracking (send record, suppression, preferences) is
in the Runtime & Observability PRD.

## The comms authority

There is one comms authority — the equivalent of San Francisco for messaging.
Agents call it to send messages. It executes the send through the configured
provider, logs the outcome, and enforces policy (rate limits, suppression,
routing).

No code path directly calls an email or SMS API. The agent decides when to
send, what to send, through which channel. The comms authority handles
delivery.

Messages are structured artifacts: a message class, a template, typed
variables, a recipient, and a channel. The agent populates the variables;
the comms authority renders and sends.

## Language rule

Every message is sent in a language determined by one rule:

- **Users**: email/SMS language = UI language. The comms authority reads the
  user's UI language from their profile (Berlin already stores this). No
  separate email language preference.
- **Prospects**: email language = Prague locale at capture time. SDR Copilot
  captures `{email, locale}` — the locale is a snapshot from Prague at the
  moment of capture.
- **Transition**: when a prospect becomes a user, their chosen UI language at
  signup takes over. The captured Prague locale is no longer used.

This applies to all four email classes and SMS. Template rendering uses the
determined locale.

## Email — four classes

### Class 1: Universal product (transactional)

**What:** Operational emails triggered by user actions or system events.

- Email verification (registration)
- Password reset
- Phone OTP delivery (via SMS, not email — but same authority)
- Email change verification (new address)
- Email change notification (old address)
- Security alerts (optional — post-GA)

**Audience:** All users regardless of tier.

**Trigger:** A specific user action or system event. The agent or product
surface observes the event and requests the send.

**Timing:** Immediate. These are time-sensitive — a verification email in spam
blocks registration. A reset email in spam blocks account recovery.

**Unsubscribe:** No. These are operational — a user cannot unsubscribe from
their own password reset.

**Deliverability bar:** Highest. Must reach the inbox. Justifies a specialist
transactional provider (Postmark) over a beta service.

**Consent:** Implicit — the user triggered the action that causes the email
(they registered, they requested a reset).

### Class 2: Tier-specific product (product state + commercial intent)

**What:** Emails triggered by the user's actual product state, tier, and usage.
The PLG monetization engine.

- Limit reached: "You've hit the widget limit for your free plan"
- Usage warnings: "You've used 80% of your monthly views"
- Tier change notices: "Your subscription expires in 7 days"
- Tier-specific features: "Your Pro plan now includes X"
- Tier-specific tips: "As a Pro user, here are 3 widgets you haven't tried"

**Audience:** Users on specific tiers only. Must reflect the user's actual tier
state at send time.

**Trigger:** A real product event (limit hit, usage threshold, tier change).
Not a campaign schedule — these fire when the event happens.

**Timing:** Near-immediate (tied to the event). Not batched.

**Unsubscribe:** Preference-managed. The user cannot opt out of "your
subscription is expiring" (that's operational) but may be able to mute
"upgrade prompts" or "tips." Preference design TBD.

**Commercial intent:** The CTA is typically "upgrade" or "explore this
feature." This makes the email borderline marketing for spam filters and
CAN-SPAM purposes.

**Consent:** Account terms — the user accepted terms on signup.

**Gray zone:** This class is product-triggered but has commercial intent. It
may need to route through a marketing subdomain/provider for deliverability
isolation, even though it's event-triggered. See Provider & Domain Policy PRD.

### Class 3: Marketing both-audience (campaign)

**What:** Broad marketing content relevant to anyone interested in
widgets/websites.

- Product announcements ("new widget type available")
- Tips and best practices
- Industry insights, design trends
- Webinar/event invitations

**Audience:** Prospects AND users. Same content goes to both.

**Trigger:** Campaign schedule. Not event-driven.

**Timing:** Scheduled or batched. Not urgent.

**Unsubscribe:** Legally required (CAN-SPAM, GDPR). Must be automatic and
honored immediately.

**Dynamic CTA:** Same email body, different action button by audience:
- Prospect receives: "Create your free account"
- User receives: "Try this widget" or "Upgrade to Pro"

**Consent:** Prospect consent from SDR Copilot capture (entered website, saw
demo) or user consent from account signup. Consent source tracked per
recipient.

### Class 4: Marketing prospect-only (conversion sequence)

**What:** Conversion-focused emails designed to turn prospects into users.

- "You tried the widget demo — create an account to save it"
- "Your free account is waiting"
- "Don't lose your widget configuration — sign up"
- Offers and incentives ("first month free")

**Audience:** Prospects only — people who gave their email through SDR Copilot
or Prague signup but have NOT created an account.

**Trigger:** Lifecycle. SDR Copilot captures the email → prospect enters the
sequence.

**Unsubscribe:** Legally required.

**Stops on conversion:** The moment the prospect creates an account (Berlin
auth succeeds), class 4 emails stop immediately. Sending "create your free
account" to an existing user is broken.

**Consent:** SDR Copilot capture. The prospect entered their website URL and
saw a demo. What they consented to depends on jurisdiction (GDPR: potentially
"legitimate interest"; CAN-SPAM: doesn't require opt-in but requires
unsubscribe). Consent source tracked.

## SMS — step-up security only

SMS is not a login method and not a marketing channel. It is a verification
channel for sensitive operations:

- Phone setup verification
- Email change OTP
- Identity removal OTP
- Social provider switch OTP

**Audience:** Authenticated users who have verified a phone number.

**Trigger:** A sensitive account operation that requires step-up verification.

**Rules:** Single-use OTP, TTL-bounded (5-10 min), rate-limited (max N per
phone per hour), purpose-bound (an OTP for email change cannot be used for
identity removal).

See `Berlin_GA_Authentication/auth_sms_requirements.md` for the full SMS
requirements contract.

## Which agents trigger which sends

| Agent/surface | Triggers |
| --- | --- |
| Berlin auth flow | Class 1 (verification, reset, email change) + SMS (OTP) |
| Product Copilot / Roma | Class 2 (limit reached observed during editing, tier features) |
| SDR Copilot | Class 4 entry point (captures prospect email) |
| Comms authority (lifecycle engine) | Class 3 (campaign schedule), Class 4 (sequence), lifecycle transitions |
| DevOps Agent | Comms cost and capacity monitoring (not a sender) |

No agent or code path calls an email or SMS provider directly. All sends flow
through the comms authority.

## Lifecycle transitions

The comms authority must detect recipient status changes and adjust email
flows automatically:

### Prospect → User

Trigger: Berlin auth succeeds (account created).

- Class 4 (prospect-only): **STOP immediately**
- Class 3 (both-audience): **CONTINUE** — CTA switches from "sign up" to "try
  this" or "upgrade"
- Class 2 (tier-specific): **ACTIVATE** for the user's current tier (free)
- Class 1 (universal product): begins normally (verification email sent during
  signup)

### Free → Paid

Trigger: Berlin tier change.

- Class 2: **ADJUST** to the new tier's limits, features, and tips
- Class 3: CTA may change ("upgrade" → "explore Pro features")

### Tier downgrade / subscription expiry

Trigger: Berlin tier change or billing event.

- Class 2: **ADJUST** — limit warnings reflect the new (lower) tier
- Class 1: subscription expiry notice (operational)

## Consent tracking

The comms authority tracks consent source per recipient:

| Consent source | What it covers | When obtained |
| --- | --- | --- |
| SDR Copilot capture | Classes 3, 4 (marketing) | Visitor entered website URL, saw demo |
| Account signup | Classes 1, 2 (product) + classes 3, 4 (marketing) | User created account, accepted terms |
| Marketing opt-in (explicit) | Classes 3, 4 | User checked a box or clicked subscribe |
| Unsubscribe | Removes from classes 3, 4 | User clicked unsubscribe link |

Consent source determines which message classes a recipient is eligible for.
A prospect with only SDR Copilot consent does not receive class 2 emails
(those require an account).

## What this PRD does not own

| Concern | Owner |
| --- | --- |
| Which email/SMS provider | Provider & Domain Policy PRD |
| Which subdomain | Provider & Domain Policy PRD |
| Send record format and storage | Runtime & Observability PRD |
| Suppression list management | Runtime & Observability PRD |
| Preference center UX | Runtime & Observability PRD |
| Template design | Comms authority + Dieter |
| Email/SMS content | Product marketing + agents |
