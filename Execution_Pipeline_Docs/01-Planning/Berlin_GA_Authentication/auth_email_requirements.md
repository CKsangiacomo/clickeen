# GA Auth — Email Requirements

Status: **DRAFT — REQUIRES HUMAN ACCEPTANCE**

Parent: `planning_PRD__Berlin_GA_Authentication.md`

## What this is

What the GA authentication system requires from email infrastructure. This is a
requirements contract — it defines what messages auth needs sent, when, and with
what guarantees. It does **not** decide the email provider, domain policy, or
send routes. Those are owned by `Comms_Systems/`.

## Dependency relationship

- OAuth providers (Google, Apple, Microsoft) are **self-contained for email**.
  They verify email ownership themselves. Berlin sends zero emails for OAuth
  flows.
- Email/password is the **only auth method that makes Berlin an email sender**.

This document defines the email needs created by email/password auth and
sensitive account operations.

## Required email flows

### 1. Registration verification

**Trigger:** User signs up with email/password.

| Attribute | Requirement |
| --- | --- |
| When | Immediately after account creation |
| Recipient | The email address the user registered with |
| Content | Single-use verification link or OTP |
| TTL | Short (1-24 hours) |
| Blocking? | Account exists but is unverified. Login may be permitted; sensitive operations blocked until verified. |
| Rate limit | Max N resend requests per email per hour |

**Non-delivery result:** Account remains unverified. User cannot reach verified
state. Must be visible — Berlin reports the send outcome, does not silently skip.

### 2. Password reset

**Trigger:** User requests password reset.

| Attribute | Requirement |
| --- | --- |
| When | On user request |
| Recipient | The account's current verified email |
| Content | Single-use reset link with short TTL |
| TTL | Short (15-60 minutes) |
| Blocking? | No — reset is user-initiated, not blocking any flow |
| Rate limit | Max N reset requests per email per hour |
| Security | Must not reveal whether the email exists in the system (same response for known and unknown emails) |

**Non-delivery result:** User cannot reset password. If they also don't know
their password and their OAuth provider is unavailable, they need manual support
or phone-based recovery.

### 3. Email change — new email verification

**Trigger:** User initiates email change in account settings.

| Attribute | Requirement |
| --- | --- |
| When | After phone OTP verification (if phone is verified) or after re-authentication + reversal window (if no phone) |
| Recipient | The NEW email address |
| Content | Single-use verification link |
| TTL | Short (1-2 hours) |
| Blocking? | Yes — email change does not commit until new email is verified |

### 4. Email change — old email notification

**Trigger:** Email change is initiated.

| Attribute | Requirement |
| --- | --- |
| When | Immediately when the change process starts |
| Recipient | The CURRENT (old) email address |
| Content | Security notification: "Your email is being changed. If this wasn't you, [revert link]." |
| TTL | Reversal window (24-72 hours) if user has no verified phone |
| Blocking? | No — notification only. With phone verification, the phone OTP is the gate, not the old email. Without phone, the old email reversal window is the gate. |
| Delivery | Best-effort. If the old email is unreachable (e.g., Google suspended), the notification bounces. This is logged but does not block the change when phone OTP has been satisfied. |

### 5. Email change — completion notification

**Trigger:** Email change commits (after verification + any waiting period).

| Attribute | Requirement |
| --- | --- |
| When | After the change is final |
| Recipient | Both old and new email addresses |
| Content | "Your Clickeen email has been changed to [new email]." |
| Blocking? | No — confirmation only |

## Non-required email flows (post-GA)

These are NOT required for GA auth but may be added later:

- Security alerts ("New device signed in")
- Password change confirmation
- Login from new geography
- Account lockout notification

These are product notification emails, not auth-critical. They belong to the
Comms Systems product notification class, not the auth-critical class.

## Language

All auth emails are sent in the user's **UI language** (the language their
Clickeen interface is set to). Berlin already stores this as the user's
`primaryLanguage` or UI language setting. The comms authority reads it and
renders the email template in that language.

No separate email language preference. UI language = email language.

## What this doc does NOT own

| Concern | Owner |
| --- | --- |
| Email provider selection | `Comms_Systems/planning_PRD__Comms_Provider_And_Domain_Policy.md` |
| Domain/subdomain segmentation | `Comms_Systems/` |
| Send routes, queues, retry policy | `Comms_Systems/planning_PRD__Comms_Runtime_And_Observability.md` |
| Email template design | Comms Systems + Dieter |
| Deliverability management | `Comms_Systems/` |

## Delivery guarantee expectations

Auth-critical email (registration verification, password reset, email change
verification) requires:

- **High deliverability** — these emails must reach the inbox, not spam. A
  verification email in spam blocks registration. A reset email in spam blocks
  account recovery.
- **Low latency** — the user is waiting for the email. Delivery within seconds
  to low minutes, not hours.
- **Observable** — Berlin must be able to determine whether a specific email was
  sent, delivered, bounced, or failed. "Did the verification email go out?" must
  be answerable.
- **No silent failure** — if the email provider rejects or fails, Berlin reports
  the failure visibly. The user is told to retry, not left waiting indefinitely.

These expectations feed into the Comms Systems provider selection: auth-critical
email justifies a specialist provider (Postmark) over a beta service (Cloudflare
Email) if the product owner accepts the cost.
