# Digital Khata — Product Vision (Future Direction)

**This document describes intent only. None of it is implemented yet.**

The core product stays what it is: a Digital Khata / udhaar ledger for Pakistani shopkeepers. The long-term direction is to make the **existing** app highly AI-assisted and accessible — voice-first, multilingual, usable by people who cannot read or write comfortably. This is an evolution of the current app, not a replacement.

---

## 1. The Idea in One Sentence

The Khata AI Assistant becomes a natural-language/voice interface over the entire app: shopkeepers run their ledger by talking to it in Urdu, Roman Urdu, or English — and every financial write still requires explicit confirmation.

## 2. Who This Is For

- English-speaking shopkeepers
- Urdu-speaking shopkeepers
- Shopkeepers who cannot read/write comfortably — **voice is a first-class interaction mode, not an optional microphone button**
- Users who prefer speaking over typing on small screens

## 3. Target Interactions (illustrative, not spec)

**Multi-fact statement capture:**
> "Ahmed ne aaj 2000 rupay ka udhaar liya hai aur 15 September ko wapas karega."

The assistant parses customer, amount, date, and due date from one sentence, asks for confirmation when anything is ambiguous or missing, then creates the Udhaar record through the existing ActionProposal → Confirm flow.

**Advisory query with ledger context:**
> "Ahmed ko aur udhaar dena chahiye?"

The assistant analyzes Ahmed's existing khata — outstanding balance, payment history, overdue pattern, purchase history — and responds conversationally with a recommendation. It does not decide for the user.

**Ledger fact questions:**
> "Ahmed ne mera kitna udhaar wapas kiya hai?"

Answered from the actual local (and eventually cloud) ledger data. Never estimated, never fabricated.

## 4. Capability Goals for the Future Assistant

- Voice input (already present via Web Speech API) and **voice responses (TTS)** — a natural female Urdu/English voice where technically possible; no specific provider chosen yet
- Urdu, Roman Urdu, and English — natural conversational interaction, mixed-script tolerated
- Financial queries, customer history, udhaar creation, payment recording
- Reminders, reports, business insights
- Navigation and app assistance ("reports kholo", "naya customer banao")
- Human-readable and voice-friendly (speakable) responses

## 5. Non-Negotiable Safety Rules

- **The AI must NEVER silently modify financial records.** Every financial write uses a clear confirmation mechanism (today's ConfirmCard pattern; a voice-friendly equivalent — e.g., spoken read-back + explicit yes/no — must be designed before voice-first writes).
- No fabricated financial numbers. Answers come from ledger data only.
- Offline, the assistant answers honestly from local data and says what it cannot do.

## 6. Reminders / Messaging

Future versions may support automated reminder workflows, including WhatsApp-related workflows — but only through official, platform-sanctioned channels (e.g., WhatsApp Business API), respecting platform/API limitations and requiring user confirmation/authorization. **No unofficial automated WhatsApp messaging** (no headless browsers, no unofficial APIs).

## 7. Scalability Direction

The architecture must handle very large datasets — hundreds of thousands to millions of records:

- **Never load the entire database into React state or AI prompts.** The current `KhataSnapshot` (full tables) is acceptable only at small scale and must evolve into targeted queries.
- The AI layer should run **retrieval-style**: identify the relevant customer/period/records first (local deterministic lookups), then reason over only that slice.
- Local deterministic queries/actions stay local; cloud LLM calls receive only the relevant context slice.
- UI lists need pagination/virtualization; reads should be index-backed.

## 8. Offline / Online Principles

- **Offline-first for core ledger operations** — this never changes.
- Local deterministic queries and actions work offline.
- Online AI capabilities when internet is available.
- Honest offline fallback when cloud AI is unavailable — no pretending, no fabrication.

## 9. Language & RTL Requirements

**English:** sidebar on the left, normal LTR layout.

**Urdu:** sidebar/navigation moves to the right; layout uses RTL/logical CSS throughout (the app already uses logical properties — `start`/`end`/`ps`/`border-e` — so mirroring is automatic); correct text direction everywhere; numbers, dates, cards, forms, and dialogs must remain visually usable (avoid full-width mirrored numerals where readability suffers).

## 10. UI Principles

- Mobile and web must support **normal vertical scrolling** — no page may become vertically trapped or resist natural scrolling.
- Keep the current light theme (it works well).
- The **dark theme needs a proper visual redesign** — a deliberate, designed pass, not random color changes. Until then, leave it as is.

## 11. What NOT to Do (Guardrails for Future Developers)

- Do not change the core purpose: this is a khata/udhaar management app for Pakistani shopkeepers.
- Do not weaken the confirm-before-financial-write rule.
- Do not put LLM/API keys in the frontend.
- Do not send the entire database to an LLM.
- Do not implement unofficial WhatsApp automation.
- Do not redesign the whole app to chase the vision — extend the existing routes, repositories, and AI engine incrementally.

## 12. Suggested Sequencing (details in PROJECT_HANDOFF.md §P)

1. Harden current app (a11y labels, focus trap, pagination).
2. Conversational statement parsing + richer Urdu/Roman Urdu NLU (behind existing proposal contract).
3. Voice output (TTS) with speakable response phrasing.
4. Scalability: targeted AI retrieval, index-backed reads.
5. Cloud sync MVP, then official messaging integrations, then dark-theme redesign.

---

*Vision recorded 2026-08-29. Implementation of any item requires the owner's explicit approval.*
