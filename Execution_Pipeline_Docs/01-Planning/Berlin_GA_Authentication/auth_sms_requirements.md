# GA Auth — SMS Requirements

Status: **DRAFT — REQUIRES HUMAN ACCEPTANCE**

Parent: `planning_PRD__Berlin_GA_Authentication.md`

## What this is

What the GA authentication system requires from SMS infrastructure. This is a
requirements contract — it defines what messages auth needs sent, when, and with
what guarantees. It does **not** decide the SMS provider, number provisioning,
or send routes. Those are owned by `Comms_Systems/`.

## Why auth needs SMS

Phone verification is the **step-up security factor** that makes sensitive
account operations safe. The phone is independent of every digital-identity
provider — Google can suspend email, Apple can lock Apple ID, but the phone
number is on the user's SIM, controlled by their telecom provider. It is the one
verification channel that survives any provider suspension.

Without SMS step-up verification, email change is an unsecured takeover path.
With it, email change requires both knowledge (password) and physical device
(phone) — two independent factors.

## What SMS is NOT

SMS is **not a login method**. The user does not "sign in with phone." SMS is a
verification channel for sensitive operations only. Everyday login (Google,
Apple, Microsoft, email/password) never sends an SMS.

## Required SMS flows

### 1. Phone setup verification

**Trigger:** User adds a phone number in account settings.

| Attribute | Requirement |
| --- | --- |
| When | On user request (progressive opt-in, not required at signup) |
| Recipient | The phone number the user entered (E.164) |
| Content | 6-digit numeric OTP |
| TTL | 5-10 minutes |
| Rate limit | Max N OTP sends per phone per hour, exponential backoff |
| Max attempts | Max M incorrect attempts per OTP before invalidation |

**Non-delivery result:** Phone remains unverified. User falls back to base
security model (re-authentication + old email notification + reversal window for
email change). Must be visible — Berlin reports the send outcome.

### 2. Step-up verification — email change

**Trigger:** User initiates email change and has a verified phone.

| Attribute | Requirement |
| --- | --- |
| When | After re-authentication, before committing the email change |
| Recipient | The account's verified phone number |
| Content | 6-digit numeric OTP |
| TTL | 5-10 minutes |
| Rate limit | Max N OTP sends per phone per hour |
| Blocking? | **Yes** — email change cannot proceed without correct OTP |

**Non-delivery result:** Email change is blocked. User must either retry SMS or
fall back to the no-phone base security model (if applicable).

### 3. Step-up verification — login identity removal

**Trigger:** User removes a login identity (social or password) from account
settings.

| Attribute | Requirement |
| --- | --- |
| When | Before committing the removal |
| Recipient | The account's verified phone number |
| Content | 6-digit numeric OTP |
| TTL | 5-10 minutes |
| Blocking? | **Yes** — removal cannot proceed without correct OTP |

### 4. Step-up verification — social provider switch

**Trigger:** User removes their current social provider and adds a new one.

| Attribute | Requirement |
| --- | --- |
| When | Before committing the switch |
| Recipient | The account's verified phone number |
| Content | 6-digit numeric OTP |
| TTL | 5-10 minutes |
| Blocking? | **Yes** |

## OTP lifecycle

All SMS OTPs follow the same lifecycle regardless of the triggering operation:

1. Berlin generates a 6-digit numeric code using `crypto.getRandomValues` with
   rejection sampling for uniform distribution
2. Berlin stores the OTP with its purpose (phone-setup, email-change,
   identity-removal, provider-switch), the target phone number, and a TTL
   (5-10 min) in Durable Objects — same ticket pattern as OAuth state tickets
3. Berlin sends the OTP via SMS through the SMS provider
4. User enters the code
5. Berlin verifies: correct code, correct purpose, not expired, not already
   consumed
6. Berlin marks the OTP as consumed (single-use)

### Security constraints

- **Single-use**: each OTP is consumed on first successful verification
- **Purpose-bound**: an OTP for email change cannot be used for identity removal
- **Attempt-limited**: max M incorrect attempts per OTP before it is invalidated
- **Rate-limited**: max N OTP sends per phone per hour to prevent abuse
- **No leakage**: Berlin does not reveal whether a phone number is registered

## Language

SMS OTP messages follow the user's **UI language** — same rule as email. The
6-digit code is locale-agnostic (numbers are universal), but the wrapper text
("Your Clickeen verification code is: 123456") is rendered in the user's UI
language.

Note: non-Latin scripts (Arabic, Chinese, Japanese, etc.) use UCS-2 SMS
encoding, which has a 70-character limit per message (vs 160 for GSM 7-bit
Latin). OTP wrapper text must stay short to avoid multi-part messages in
UCS-2 locales.

## Non-required SMS flows (post-GA)

- SMS-based login (sign in with phone + OTP, no password) — NOT planned for GA
- 2FA/MFA on every login — NOT planned for GA (hurts conversion)
- Marketing/product SMS — NOT planned

## What this doc does NOT own

| Concern | Owner |
| --- | --- |
| SMS provider selection | `Comms_Systems/planning_PRD__Comms_Provider_And_Domain_Policy.md` |
| Sender number provisioning | `Comms_Systems/` |
| Send routes, queues, retry policy | `Comms_Systems/planning_PRD__Comms_Runtime_And_Observability.md` |
| Deliverability / carrier management | `Comms_Systems/` |
| WhatsApp as alternative delivery channel | Future — `whatsapp` column exists in schema |

## Delivery guarantee expectations

Auth-critical SMS (phone setup, step-up OTP) requires:

- **High deliverability** — OTPs must reach the device. A delayed or missing OTP
  blocks the operation the user is trying to complete.
- **Low latency** — the user is waiting. Delivery within seconds, not minutes.
- **Observable** — Berlin must be able to determine whether a specific SMS was
  sent, delivered, or failed. "Did the OTP go out?" must be answerable.
- **No silent failure** — if the SMS provider rejects or fails, Berlin reports
  the failure visibly. The user is told to retry.
- **Global reach** — Clickeen users are global. The SMS provider must reach
  carriers in all target markets.

These expectations feed into the Comms Systems provider selection. SMS
deliverability varies significantly by carrier and region — the provider must
have proven global reach, not just US/EU.

## Coupled dependency note

SMS and email are coupled dependencies of the auth system. The vendor selection
should consider whether to use a single dual-channel vendor (Twilio SendGrid +
Twilio SMS, or AWS SES + Amazon SNS) or separate vendors per channel. This
decision is owned by `Comms_Systems/`, but both auth requirements docs
(this and `auth_email_requirements.md`) should be referenced during vendor
evaluation.
