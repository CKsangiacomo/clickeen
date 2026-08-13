# Planning PRD — Comms Runtime and Observability

Status: **DRAFT — REQUIRES HUMAN ACCEPTANCE**

## What this is

Defines how sends are tracked, how suppression and preferences work, and what
observability the comms authority provides. This is the HOW — send record,
bounce handling, preference center, delivery tracking. What gets sent is in
the Product Boundary PRD. Which provider handles it is in the Provider & Domain
Policy PRD.

## The send record

Every send is logged by the comms authority. The record is under Clickeen's
control — not only in the provider's dashboard (providers get switched, their
logs don't carry over).

### What's logged per send

| Field | What | Why |
| --- | --- | --- |
| `messageClass` | 1, 2, 3, or 4 | Determines rules and routing |
| `triggeredBy` | Agent or product surface that requested the send | Accountability |
| `templateId` | Which template was used | Reproducibility |
| `variables` | Typed variables used to render the message | What was actually sent |
| `recipient` | Email address or phone number | Who received it |
| `channel` | Email or SMS | Routing |
| `locale` | Language/locale the message was rendered in (UI language for users, captured Prague locale for prospects) | Debugging, analytics, compliance |
| `provider` | Which provider handled the send | Provider tracing |
| `providerMessageId` | The provider's message ID | Cross-reference with provider logs |
| `sentAt` | Timestamp | When it was sent |
| `status` | queued, sent, delivered, bounced, failed, suppressed | Delivery outcome |
| `statusDetail` | Bounce reason, suppression reason, error message | Debugging |
| `statusUpdatedAt` | Timestamp of last status change | Delivery timeline |

### Storage

The send record is relational truth — stored in Supabase (Michael). Queryable
by recipient, message class, date range, status, and triggering agent.

Retention: at least 12 months for compliance (CAN-SPAM, GDPR). Longer if
storage cost permits. Provider-side logs (Postmark 45 days, Cloudflare 31
days) are supplementary, not primary.

### No silent failure

If a send fails (provider rejects, bounces, times out), the comms authority:
1. Logs the failure with status and detail
2. Reports the failure to the requesting agent
3. Reports to the user where appropriate ("we couldn't send your verification
   email, please retry")

A failed send is never silently skipped. Tenets 3 and 6: no silent omission,
no partial-success masquerade.

## Suppression logic

The comms authority maintains a suppression state per recipient address. The
suppression state determines which message classes can be sent.

### Suppression reasons

| Reason | Effect | Who can set it |
| --- | --- | --- |
| **Marketing unsubscribe** | Stop classes 3 and 4. Classes 1 and 2 continue. | Recipient (unsubscribe link) |
| **Hard bounce** | Stop ALL classes. Address is invalid. | System (bounce webhook) |
| **Spam complaint** | Stop marketing (3, 4). Review product (1, 2). Suppress pending review. | System (complaint webhook) |
| **Invalid phone** | Stop SMS. Phone number is invalid. | System (SMS bounce) |
| **Manual suppression** | Stop specified classes. | Operator (support, abuse response) |

### The key distinction

**Marketing unsubscribe ≠ stop all email.** A user who unsubscribes from the
newsletter still receives their password reset. The comms authority must
distinguish "this person doesn't want marketing" from "this address doesn't
work."

**Hard bounce = stop everything.** If an email hard-bounces, the address is
invalid. Don't send a password reset to a bouncing address — it won't arrive
and it hurts sender reputation.

### Suppression check before send

Before executing any send, the comms authority checks the suppression state
for the recipient + message class:
- If suppressed for this class: log as `status: suppressed`, do not send,
  report to requesting agent.
- If not suppressed: proceed with the send.

## Preference center

The recipient sees a unified preference view across all message classes.

### What the user controls

| Preference | User-controllable? |
| --- | --- |
| Class 1 (verification, reset, OTP) | No — operational, cannot opt out |
| Class 2 (tier-specific, limit warnings) | Partially — cannot opt out of "your subscription is expiring" but may mute "tips" or "upgrade prompts" |
| Class 3 (announcements, newsletter) | Yes — full opt-in/opt-out |
| Class 4 (prospect conversion) | Yes — full opt-in/opt-out (becomes moot when prospect becomes user) |

### Preference surface

A preference page (linked from every marketing email) where the recipient
sees:
- Product emails: "These are operational and cannot be turned off"
- Marketing emails: checkboxes for each marketing sub-class (announcements,
  tips, newsletter)
- A single "unsubscribe from all marketing" link

The preference state feeds the suppression logic. Unchecking "announcements"
sets a suppression for class 3 announcements specifically.

## Rate limiting

### Per-recipient rate limiting

Prevents flooding a single recipient:
- Class 1: max N per recipient per hour (verification resend, reset requests)
- SMS OTP: max N per phone per hour, exponential backoff
- Class 2: max N per recipient per day (don't spam limit warnings)
- Classes 3, 4: governed by campaign frequency caps

### Per-account rate limiting

Prevents abuse through a single account:
- SDR Copilot-prospect capture: max N prospect emails per visitor session
- Account-created sends: max N per account per day

### Provider rate limiting

Each provider has its own rate limits (especially free tiers). The comms
authority tracks provider quota consumption and reports when approaching
limits.

## Delivery tracking

### Status lifecycle

```
queued → sent → delivered
                 ↘ bounced (hard/soft)
                 ↘ failed (provider error)
         ↘ suppressed (suppression check blocked the send)
```

### Status updates

- **queued**: comms authority accepted the send request
- **sent**: provider accepted the message
- **delivered**: provider confirmed delivery to the receiving mail server
- **bounced**: receiving server rejected (hard = permanent, soft = temporary)
- **failed**: provider error, timeout, or configuration issue
- **suppressed**: suppression check prevented the send

Status updates come from provider webhooks (Postmark, Cloudflare, SMS
providers) and are written to the send record.

### Bounce handling

- **Hard bounce**: mark the address as invalid in suppression state. Stop all
  future sends to this address. Report to the requesting agent.
- **Soft bounce**: retry per provider retry policy. If persistent after N
  retries, escalate to hard bounce.
- **Complaint (spam report)**: suppress marketing for the address. Alert
  operator for review. Track complaint rate per subdomain — if above provider
  threshold (typically 0.1%), pause sends and investigate.

## Observability for the DevOps Agent

The DevOps Agent (job #1 — cost monitoring) consumes comms observability data:

- Daily send volume by class and provider
- Bounce rate and complaint rate per subdomain
- Cost per class (for paid providers)
- Free-tier capacity consumption (for SDR Copilot's LLM provider — not comms,
  but same monitoring pattern)
- Suppression list size and growth

The comms authority exposes this data through its send record. The DevOps
Agent aggregates and reports it in the daily cost report.

## What this PRD does not own

| Concern | Owner |
| --- | --- |
| What gets sent, who triggers it | Product Boundary PRD |
| Which provider, which subdomain | Provider & Domain Policy PRD |
| Template design | Comms authority + Dieter |
| Marketing campaign strategy | Product marketing |
| DevOps Agent job definitions | Agent Pipeline / DevOps Agent |
