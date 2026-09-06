# Digital Khata — AI Architecture

## Overview

The AI Assistant is the central intelligent operating layer of Digital Khata. It allows shopkeepers to operate the application through natural language in English, Urdu, Roman Urdu, or mixed language — via text or voice.

## Architecture

```
User (text or voice)
    │
    ▼
AI Chat UI (src/pages/AI/AI.tsx)
    │  Sends user input + conversation context
    ▼
AI Orchestrator (src/features/ai/orchestrator.ts)
    │  Pronoun resolution, context tracking, routes to engine or cloud
    ▼
AI Engine (src/features/ai/engine.ts)          AI Tool Layer (src/features/ai/tools.ts)
    │  Intent classification, entity extraction    │  Wraps existing repositories
    ▼                                              ▼
NLP (src/features/ai/nlp.ts)                  Repositories (customerRepo, udhaarRepo, etc.)
    │  Normalization, customer matching            │
    │  Amount extraction, pronoun detection        ▼
    ▼                                          IndexedDB → Sync Queue → Cloud Sync
Responses (src/features/ai/responses.ts)
    │  Bilingual response templates
    ▼
Natural language output (text + optional voice)
```

## Key Components

### 1. AI Orchestrator (`src/features/ai/orchestrator.ts`)

The orchestrator is the central coordination layer:

- **Conversation context**: Maintains a session-scoped `ConversationContext` that tracks the last customer, amount, and intent across turns.
- **Pronoun resolution**: Detects pronouns (us ne, us ko, him, her, etc.) and substitutes the last-known customer name before passing to the engine.
- **Routing**: Calls `runEngine()` for local intent processing. If the engine returns `fallback`, routes to `askAI()` which tries cloud AI.
- **Context update**: After each turn, updates the context with the resolved customer, amount, and intent.

### 2. AI Engine (`src/features/ai/engine.ts`)

The engine performs deterministic intent classification and entity extraction:

- **Intent classification**: 18 intents covering queries (balance, history, sales, overdue, etc.) and actions (payment, udhaar, sale, customer creation, etc.).
- **Entity extraction**: Customer matching (fuzzy + exact), amount extraction (words to numbers in 3 languages), payment method detection, period detection.
- **Proposal generation**: For action intents, returns an `ActionProposal` that requires user confirmation before execution.

### 3. AI Tool Layer (`src/features/ai/tools.ts`)

The tool layer wraps existing repositories with AI-specific signatures:

- `aiCreateCustomer()` → `customerRepo.addCustomer()`
- `aiAddUdhaar()` → `udhaarRepo.addUdhaar()`
- `aiRecordPayment()` → `paymentRepo.addPayment()`
- `aiRecordSale()` → `saleRepo.addSale()`
- `aiDeleteUdhaar()` → `udhaarRepo.deleteUdhaar()`
- `aiDeletePayment()` → `paymentRepo.deletePayment()`
- `aiGetBalance()` → inline computation from udhaar entries
- `aiGetHistory()` → merged timeline from udhaar, payments, sales

**Critical**: Every write goes through the same repositories that the UI pages use. This ensures:
- `syncStatus: 'pending'` is set on every new record
- `enqueueSyncAction()` is called for every mutation
- Offline-first behavior is preserved
- Conflict resolution remains compatible

### 4. NLP (`src/features/ai/nlp.ts`)

The NLP module handles multilingual text processing:

- **Normalization**: Unicode NFKC, Arabic-Indic digit conversion, Urdu character normalization, diacritics removal.
- **Customer matching**: Token-based scoring with fuzzy matching (Levenshtein distance). Handles exact, partial, and phonetic matches.
- **Amount extraction**: Parses numeric tokens and word-to-number mappings in English, Roman Urdu, and Urdu script. Supports multipliers (hundred, thousand, lakh, crore).
- **Pronoun detection**: Detects pronouns in all three languages for context resolution.
- **Greeting detection**: Recognizes greetings in all three languages.

### 5. Intents (`src/features/ai/intents.ts`)

18 supported intents:

| Intent | Category | Examples |
|--------|----------|----------|
| `GREETING` | Conversational | "salam", "hello", "assalam o alaikum" |
| `HELP` | Conversational | "help", "madad", "kya kar sakte ho" |
| `CREATE_CUSTOMER` | Action | "naya customer add karo", "customer banao" |
| `RECORD_PAYMENT` | Action | "Ahmed ki 2000 payment receive kar lo" |
| `ADD_UDHAAR` | Action | "Ahmed ko 5000 udhaar do" |
| `RECORD_SALE` | Action | "aaj ki sale likho 5000" |
| `DELETE_PAYMENT` | Action | "Ahmed ki payment delete karo" |
| `DELETE_UDHAAR` | Action | "Ahmed ka udhaar delete karo" |
| `SEND_REMINDER` | Action | "Ahmed ko reminder bhejo" |
| `CUSTOMER_BALANCE` | Query | "Ahmed ka balance batao" |
| `CUSTOMER_HISTORY` | Query | "Ahmed ka hisab dikhao" |
| `CUSTOMER_PAYMENTS_TOTAL` | Query | "Ahmed ki total payment" |
| `SALES_SUMMARY` | Query | "aaj ki sale kitni hui" |
| `OVERDUE_CUSTOMERS` | Query | "kis ka udhaar overdue hai" |
| `TOP_DEBTORS` | Query | "sabse zyada udhaar kis ka hai" |
| `BUSINESS_INSIGHT` | Query | "karobar kaisa chal raha hai" |
| `TOTALS` | Query | "kul kitna hai" |
| `UNKNOWN` | Fallback | Anything not matching above |

## Safety Model

### Confirmation Required for All Writes

The AI **never** silently modifies financial records. Every action intent produces an `ActionProposal` rendered as a `ConfirmCard`:

1. User says: "Ahmed ko 5000 udhaar do"
2. Engine returns: `{ type: 'proposal', proposal: { kind: 'ADD_UDHAAR', customerId: '...', amount: 5000 } }`
3. UI renders: ConfirmCard with "Confirm" and "Cancel" buttons
4. Only on user confirmation does `executeProposal()` call the repository

### Ambiguous Customer Handling

If multiple customers match (e.g., "Ahmed" matches Ahmed Khan, Ahmed Ali, Ahmed Raza), the engine returns a clarification asking the user to specify which customer. It never guesses.

### Failed Operations

If a repository operation fails, the AI reports the failure honestly: "Sorry, I couldn't save that transaction. Nothing was added to Ahmed's account." It never claims success after failure.

## Offline Behavior

- The local engine handles all 18 intents offline using IndexedDB data.
- Cloud AI is only used for conversational fallback when the local engine returns `UNKNOWN`.
- Offline users see: "Advanced AI is unavailable offline, but I can still answer questions using your saved Khata data."
- All writes continue through repositories and sync queue, even offline.

## Conversation Context

The orchestrator maintains session-scoped context:

```typescript
type ConversationContext = {
  turns: ConversationTurn[]       // Last 20 turns
  lastCustomerId?: string         // Most recently discussed customer
  lastCustomerName?: string       // Most recently discussed customer name
  lastAmount?: number             // Most recently discussed amount
  lastIntent?: string             // Most recently detected intent
}
```

**Pronoun resolution**: If the user says "us ko 5000 do" (give him 5000) after discussing Ahmed, the orchestrator injects "Ahmed" into the input before passing to the engine.

## Multilingual Support

The AI understands and responds in:

- **English**: "How much does Ahmed owe me?"
- **Roman Urdu**: "Ahmed ka kitna paisa reh gaya hai?"
- **Urdu script**: "احمد کا کتنا پیسہ رہ گیا ہے؟"
- **Mixed**: "Ahmed ka balance show karo"

Responses match the user's language preference (set in app settings).

## Extension Guide

### Adding a New Intent

1. Add the intent to the `Intent` union in `src/features/ai/intents.ts`.
2. Add keyword arrays and detection logic in `detectIntent()`.
3. Add a case in the `switch (intent)` block in `src/features/ai/engine.ts`.
4. Add response strings in `src/features/ai/responses.ts` (both `en` and `ur`).
5. If it's an action intent, add a tool function in `src/features/ai/tools.ts`.
6. Add the action kind to `ActionKind` in `src/core/types/index.ts`.
7. Add execution logic in `executeProposal()` in `src/pages/AI/AI.tsx`.
8. Add i18n keys in `src/core/i18n/en.ts` and `src/core/i18n/ur.ts`.

### Adding a New Tool Function

1. Create the function in `src/features/ai/tools.ts` wrapping the existing repository.
2. Return `ToolResult<T>` with `ok: true` or `ok: false`.
3. Never access `db.*` directly — always go through repositories.

## Testing

AI tests are in:
- `src/features/ai/nlp.test.ts` — NLP functions (pronoun detection, greeting detection, customer creation detection)
- `src/features/ai/intents.test.ts` — Intent classification (all 18 intents, mixed language, priority ordering)
- `src/features/ai/orchestrator.test.ts` — Orchestrator (context tracking, pronoun resolution, multi-turn)

Run: `npm test`

## Limitations

- **No streaming responses**: Cloud AI responses are fetched as a single payload.
- **No entity linking across sessions**: Context is session-scoped, not persisted.
- **No bulk operations**: Each action is processed individually.
- **No date range filtering**: Period detection is limited to today/week/month.
- **Voice input is browser-dependent**: `SpeechRecognition` is not available in all browsers.
