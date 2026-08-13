# SMS Provider Research

Status: RESEARCH — NOT PRODUCT TRUTH — NOT AN EXECUTION PRD

## Purpose

Initial research into SMS providers for Clickeen's phone verification
requirements. The auth system needs SMS for step-up security OTPs (phone setup,
email change, identity removal, social provider switch).

See `Berlin_GA_Authentication/auth_sms_requirements.md` for what auth needs.

This research feeds into `planning_PRD__Comms_Provider_And_Domain_Policy.md`,
which has not been written yet.

## Candidate Providers

### Twilio

- **Status**: GA, market leader since 2008
- **SMS**: Programmable Messaging (global reach, 190+ countries)
- **Email**: Twilio SendGrid (acquired 2019) — potential dual-channel vendor
- **Pricing**: ~$0.0079/message (US), varies by country. Volume discounts.
- **Sender IDs**: Short codes, long codes, alphanumeric sender IDs, toll-free
- **OTP product**: Twilio Verify (managed OTP service with built-in rate
  limiting, fraud detection, template management)
- **Global reach**: Strong, with direct carrier relationships in most markets
- **Workers compatibility**: REST API, callable from any platform
- **Deliverability data**: Detailed delivery receipts, carrier-level visibility

### Amazon SNS

- **Status**: GA, part of AWS since 2012
- **SMS**: Amazon SNS SMS (global reach)
- **Email**: AWS SES — potential dual-channel vendor (same AWS account)
- **Pricing**: ~$0.00645/message (US), varies by country. Generally cheaper
  than Twilio.
- **Sender IDs**: Sender IDs, short codes (via AWS support request)
- **OTP product**: No managed OTP service — you build OTP logic yourself
- **Global reach**: Good, but some markets require origination number
  provisioning
- **Workers compatibility**: REST API, callable from any platform. SDK
  available but not needed for simple sends.
- **Deliverability data**: Delivery status in CloudWatch, less granular than
  Twilio

### MessageBird

- **Status**: GA, EU-based competitor to Twilio
- **SMS**: Global SMS API
- **Email**: Also offers email API — potential dual-channel vendor
- **Pricing**: Competitive with Twilio, varies by country
- **OTP product**: MessageBird Verify (managed OTP)
- **Global reach**: Strong in Europe and emerging markets
- **Workers compatibility**: REST API
- **Differentiator**: EU data residency, potential GDPR advantage

## Comparison Criteria (To Be Evaluated)

| Dimension | Twilio | Amazon SNS | MessageBird |
| --- | --- | --- | --- |
| Global deliverability | TBD | TBD | TBD |
| Price per message (US) | ~$0.0079 | ~$0.00645 | TBD |
| Price per message (EU) | TBD | TBD | TBD |
| Price per message (emerging markets) | TBD | TBD | TBD |
| Managed OTP service | Verify (yes) | No | Verify (yes) |
| Dual-channel (email + SMS) | SendGrid + Messaging | SES + SNS | Email + SMS |
| Delivery receipts granularity | TBD | TBD | TBD |
| Rate limiting controls | TBD | TBD | TBD |
| Fraud / spam detection | TBD | TBD | TBD |
| EU data residency | TBD | TBD | Yes |
| Short code provisioning time | TBD | TBD | TBD |
| Alphanumeric sender support | TBD | TBD | TBD |

## Key Decision: Dual-Channel vs. Separate Vendors

The email research recommended Postmark for auth-critical email. Postmark does
not offer SMS. If that recommendation holds, Clickeen needs a **separate SMS
vendor** — two integrations, two accounts, two billing relationships.

Alternatively, a dual-channel vendor provides both email and SMS:

| Dual-channel option | Email product | SMS product | Trade-off |
| --- | --- | --- | --- |
| Twilio | SendGrid | Programmable Messaging | SendGrid deliverability is good but below Postmark for transactional |
| Amazon | SES | SNS | Cheapest at scale, more operational burden |
| MessageBird | Email API | SMS API | Strong in EU, less proven globally than Twilio |

This is a **product-owner decision**: specialist providers (Postmark + Twilio)
offer best-in-class deliverability per channel but at the cost of two
integrations. A dual-channel vendor simplifies operations but may compromise on
one channel.

## Research Still Needed

- [ ] Twilio Verify OTP service: pricing, rate-limit defaults, fraud detection
      capabilities, template management
- [ ] Deliverability comparison across target markets (US, EU, LATAM, Asia)
- [ ] Pricing at Clickeen's expected volume (phone verification is low-volume —
      only triggered on phone setup and sensitive operations, not every login)
- [ ] Sender ID / alphanumeric sender availability by country (affects OTP
      deliverability and user trust)
- [ ] Cloudflare Workers integration specifics (API call patterns, timeout
      risk, retry behavior)
- [ ] Whether Twilio Verify's managed OTP removes enough Berlin-side logic to
      justify the cost premium over self-built OTP with raw SMS API

## References

(to be added during research)
