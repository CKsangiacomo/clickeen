# SDR Copilot Agent

**STATUS: PLANNING — REVIEW BEFORE EXECUTION**  
**Created:** 2024-12-27  
**Location:** Minibob ToolDrawer → "Copilot" tab  
**LLM:** DeepSeek (cost-optimized)

---

## Overview

The SDR Copilot is a **ToolDrawer mode** (not a chat widget) in Minibob that helps anonymous visitors:
1. Make light edits via natural language → AI generates ops
2. Understand widget features and capabilities
3. See the value of registering (free) or upgrading (paid)

**Goal:** Convert playground visitors → registered users → paid users

---

## How It Works: Manual vs Copilot Mode

```
┌─────────────────────────────────────────────────────────┐
│  faq                                                    │
│  ┌──────────────┬──────────────┐                       │
│  │ ✏️ Manual    │ ✨ Copilot   │  ← MODE TOGGLE        │
│  └──────────────┴──────────────┘                       │
│                                                         │
│  MANUAL MODE:              COPILOT MODE:               │
│  • Direct controls         • Text input                │
│  • User clicks/types       • AI interprets intent      │
│  • Immediate feedback      • AI generates ops          │
│  • Full control            • AI applies changes        │
│                            • Conversion messaging      │
└─────────────────────────────────────────────────────────┘
```

### Manual Mode (existing)
User interacts directly with ToolDrawer controls:
- Clicks dropdowns, toggles, sliders
- Types into text fields
- Manages items via object-manager
- Full control, no AI

### Copilot Mode (SDR)
User describes what they want in natural language:
- AI interprets the request
- AI generates `ops[]` to modify widget
- Changes apply to preview instantly
- AI response includes conversion nudges when appropriate

---

## Scope

### What It Does

| Capability | How It Works |
|------------|--------------|
| **Light edits via NL** | "Make the title bigger" → AI returns `{ op: "set", path: "typography.title.size", value: 24 }` |
| **Feature explanation** | "What's the accordion for?" → AI explains in response text |
| **Conversion nudge** | After successful edit: "Nice! Create a free account to save this to your site" |
| **Paid feature teaser** | "Remove branding" → "Branding removal is a Pro feature. Sign up free to try everything else!" |

### What It Does NOT Do

| Out of Scope | Why |
|--------------|-----|
| Complex multi-step edits | Keep it simple for conversion |
| Content generation | That's Editor Copilot (paid feature in full Bob) |
| Deep customization | User should upgrade to full Bob for that |

---

## User Experience

### Copilot Panel UI

```
┌─────────────────────────────────────────┐
│  ┌─────────────┬─────────────┐          │
│  │ ✏️ Manual   │ ✨ Copilot  │          │
│  └─────────────┴─────────────┘          │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │ What would you like to change?     │ │
│  │                                    │ │
│  │ __________________________________ │ │
│  │ │ Make the title blue            │ │ │
│  │ └────────────────────────[Send]──┘ │ │
│  └────────────────────────────────────┘ │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │ ✨ Done! I changed the title       │ │
│  │    color to blue.                  │ │
│  │                                    │ │
│  │    💡 Like what you see? Create a │ │
│  │    free account to save this.     │ │
│  │                     [Sign up free] │ │
│  └────────────────────────────────────┘ │
│                                          │
│  Quick actions:                          │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐  │
│  │ Add item │ │ Change   │ │ Style   │  │
│  │          │ │ colors   │ │ text    │  │
│  └──────────┘ └──────────┘ └─────────┘  │
└─────────────────────────────────────────┘
```

### Interaction Flow

```
1. User switches to "Copilot" tab
2. User types: "Add a new FAQ about pricing"
3. AI processes request
4. AI returns:
   - ops: [{ op: "insert", path: "items", value: { q: "Pricing?", a: "..." } }]
   - message: "Added a pricing FAQ! Want to customize the answer?"
   - cta: { text: "Save to your site", action: "signup" }
5. Minibob applies ops → preview updates
6. User sees change + conversion prompt
```

### Conversion Moments

| Trigger | AI Response |
|---------|-------------|
| After 3+ successful edits | "You're getting the hang of this! Save your work with a free account." |
| User asks to save/embed | "To embed this on your site, create a free account (10 seconds)." |
| User asks about Pro feature | "That's available on Pro. But you can try everything else free first!" |
| User tries advanced edit | "For that level of customization, sign up for the full editor — it's free to start." |

---

## Technical Spec

### API: San Francisco SDR Endpoint

```typescript
POST /api/ai/sdr-copilot

Request:
{
  "prompt": string,              // User's natural language request
  "widgetType": "faq" | "countdown" | "logo-showcase",
  "currentConfig": object,       // Current widget state
  "controls": ControlSpec[],     // Available controls from compiled widget
  "sessionId": string            // Anonymous session for conversion tracking
}

Response:
{
  "ops": WidgetOp[],             // Operations to apply (same as Editor Copilot)
  "message": string,             // Friendly response text
  "cta"?: {                      // Optional conversion prompt
    "text": string,
    "action": "signup" | "upgrade" | "learn-more",
    "url"?: string
  }
}
```

### Ops Protocol (same as full Bob)

SDR Copilot generates the same ops that Manual mode would:

```typescript
type WidgetOp = 
  | { op: "set"; path: string; value: unknown }
  | { op: "insert"; path: string; value: unknown; index?: number }
  | { op: "remove"; path: string; index: number }
  | { op: "move"; path: string; from: number; to: number }
```

**Key insight:** Copilot doesn't bypass the control system — it generates ops that are validated against the same `compiled.controls[]` as Manual mode.

### LLM Configuration

| Setting | Value | Rationale |
|---------|-------|-----------|
| Model | DeepSeek Chat | Cost: ~$0.001/interaction |
| Max tokens | 200 | Ops + short message |
| Temperature | 0.3 | Consistent ops generation |
| Context | Widget spec + current config | Enables accurate ops |

### System Prompt

```
You help users customize widgets in Clickeen's playground.

INPUT: User request + current widget config + available controls
OUTPUT: JSON with ops array + friendly message + optional conversion CTA

RULES:
1. Generate valid ops that match available controls
2. Keep changes minimal — one thing at a time
3. Message should confirm what changed (1-2 sentences)
4. Add conversion CTA naturally after successful edits
5. If request needs Pro/paid features, explain kindly and suggest signup

CONVERSION MOMENTS (weave in naturally):
- After successful edit → "Save your work with a free account"
- Multiple edits → "You're creating something great! Sign up to keep it"
- Advanced request → "Full editor has that — sign up free to access"
- Save/embed request → "Create account to get embed code"

OUTPUT FORMAT:
{
  "ops": [...],
  "message": "...",
  "cta": { "text": "...", "action": "signup" }  // optional
}
```

### Cost Estimate

| Metric | Value |
|--------|-------|
| Avg tokens per interaction | ~400 (input + output) |
| DeepSeek cost per 1M tokens | ~$0.14 |
| **Cost per interaction** | **~$0.00006** |
| 100k interactions/month | **~$6/month** |

---

## Conversion Metrics

### Track

| Metric | Target |
|--------|--------|
| Copilot tab usage | 30% of playground visitors try it |
| Successful edit rate | 80% of prompts result in valid ops |
| Signup after Copilot use | 20% of Copilot users |
| Copilot → Paid (30 day) | 5% of Copilot users |

### Attribution

Track: `sessionId` → `copilot_interactions` → `signup` → `conversion`

---

## Implementation

### Phase 1: MVP
- [ ] Add "Copilot" tab to Minibob ToolDrawer
- [ ] San Francisco `/api/ai/sdr-copilot` endpoint
- [ ] DeepSeek integration with ops generation
- [ ] Apply ops to widget state
- [ ] Basic conversion CTAs in responses
- [ ] Analytics: interactions, signups

### Phase 2: Polish
- [ ] Quick action buttons (common requests)
- [ ] Smarter conversion timing (not every response)
- [ ] Error handling for invalid ops
- [ ] Prompt refinement based on failure analysis

### Phase 3: Optimize
- [ ] A/B test conversion messaging
- [ ] Analyze common requests → improve system prompt
- [ ] Per-widget-type prompt tuning

---

## Difference: SDR Copilot vs Editor Copilot

| Aspect | SDR Copilot (Minibob) | Editor Copilot (Full Bob) |
|--------|----------------------|---------------------------|
| **Location** | Minibob playground | Full Bob editor |
| **Users** | Anonymous visitors | Registered users |
| **LLM** | DeepSeek (cheap) | Claude/GPT-4 (quality) |
| **Scope** | Light edits only | Full customization + content |
| **Goal** | Convert to signup | Help users succeed |
| **Content gen** | No | Yes (paid feature) |
| **Conversion CTAs** | Yes, frequent | No (already converted) |

---

## Dependencies

| Dependency | Status |
|------------|--------|
| Minibob built | Required |
| ToolDrawer with tab system | Required (exists in Bob) |
| San Francisco API | Required |
| DeepSeek API key | Required |
| Ops validation (compiler) | Required (exists) |
| Analytics tracking | Required |

---

## Success Criteria

1. **Cost:** < $50/month at 500k playground visitors
2. **Engagement:** 30%+ of visitors try Copilot tab
3. **Edit success rate:** 80%+ of prompts produce valid ops
4. **Conversion lift:** 15%+ increase in playground → signup rate

---

## Open Questions

1. **Quick actions:** Pre-defined buttons for common requests? Which ones?
2. **Multilingual:** DeepSeek handles all languages? Test needed.
3. **Context size:** Full config or summarized? (token cost vs accuracy)
4. **Fallback:** If DeepSeek fails, show "Try Manual mode" or retry?
5. **CTA frequency:** Every response? Every 3rd? A/B test.

