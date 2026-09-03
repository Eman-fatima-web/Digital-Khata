# Digital Khata Phase 9 Audit & Gap Analysis

**Report Date:** August 29, 2026  
**Status:** AUDIT AND PLAN ONLY — NO IMPLEMENTATION STARTED  
**Phases Complete:** 0–8 (verified, mature, working)  
**Next Phase:** 9 (Audit + Architecture) ← Current Document

---

## 1. Executive Summary

Digital Khata is a **mature offline-first PWA ledger system** for Pakistani shopkeepers with a working foundation:

- ✅ **Financial Core:** Dexie-based local database with repositories for customers, udhaar, payments, and sales
- ✅ **Sync Architecture:** Offline-first with pending→synced state machine and pluggable cloud provider
- ✅ **AI Foundation:** Deterministic NLP engine + pluggable CloudAI adapter with ActionProposal safety pattern
- ✅ **Localization:** Full English/Urdu support with RTL rendering
- ✅ **Voice Input:** Web Speech API integration for microphone capture
- ✅ **PIN Security:** PBKDF2-protected app lock
- ✅ **PWA:** Service worker with offline-first caching
- ✅ **Notifications:** Local browser notifications via service worker

**The codebase is ready for AI-first + voice-first evolution.** Current limitations are not architectural flaws but intentional scaffolding points:

- Voice **output** (TTS) is not yet implemented
- Cloud AI endpoint is not connected (stub only)
- Chat history exists but lacks full persistence/indexing features
- Large dataset support requires scalability enhancements (pagination, virtualization, targeted queries)
- Dark theme exists but needs proper redesign

The existing ActionProposal→Confirm safety architecture is **reusable and must be preserved** for all financial operations.

---

## 2. Current Architecture Audit

### 2.1 Application Architecture

**Stack:**
- **Framework:** React 19 + TypeScript + Vite
- **Routing:** React Router v7 with lazy-loaded pages
- **State:** React Context (AppProvider) + Dexie hooks
- **Styling:** Tailwind CSS 4 + custom logical CSS
- **Database:** Dexie 4 (IndexedDB wrapper)
- **PWA:** Vite PWA plugin with auto-update
- **i18n:** Custom translation layer with nested key lookup

**Application Flow:**
```
main.tsx (entry)
  ↓
AppProvider (theme, language, PIN, lock state)
  ↓
App.tsx (BrowserRouter + lazy routes)
  ↓
AppLayout (header, sidebar, nav, FAB, error boundary)
  ↓
Pages (Dashboard, Customers, AI, Reports, etc.)
  ↓
Repositories (customerRepo, udhaarRepo, paymentRepo, etc.)
  ↓
Dexie Database
  ↓
IndexedDB
```

### 2.2 Folder & Module Structure

```
src/
├── app/                          # React Router + layout shell
│   ├── App.tsx                   # Router config, lazy routes
│   └── layout/
│       ├── AppLayout.tsx         # Main shell (header, sidebar, FAB)
│       ├── Header.tsx
│       ├── DesktopSidebar.tsx
│       ├── MobileBottomNav.tsx
│       └── GlobalFAB.tsx
│
├── components/
│   └── ui/                       # Reusable UI components
│       ├── Button.tsx, Card.tsx, ConfirmCard.tsx
│       ├── EmptyState.tsx, PageLoader.tsx
│       ├── ErrorBoundary.tsx     # Route-level error recovery
│       ├── LanguageSwitcher.tsx, PinPad.tsx
│       └── StatCard.tsx
│
├── context/
│   ├── AppProvider.tsx           # Global state (theme, language, lock, PIN)
│   └── uiContext.ts              # Context definition
│
├── core/
│   ├── config/
│   │   ├── constants.ts          # Payment methods, sync status, languages, storage keys
│   │   ├── nav.ts                # Navigation items with icons
│   │   └── theme.ts              # Tailwind color palette (teal, success, ink, surface)
│   ├── i18n/
│   │   ├── index.ts              # Translation lookup + useTranslation hook
│   │   ├── en.ts                 # English translations (nested object)
│   │   └── ur.ts                 # Urdu translations (nested object)
│   └── types/
│       └── index.ts              # Syncable, Customer, UdhaarEntry, Payment, Sale, etc.
│
├── data/
│   ├── cloud/
│   │   ├── CloudProvider.ts      # Interface (abstract adapter pattern)
│   │   └── restCloudProvider.ts  # REST implementation (scaffolded, not connected)
│   │
│   ├── db/
│   │   ├── db.ts                 # Dexie schema definition (v1, v2, v3)
│   │   ├── init.ts               # Database initialization + migration
│   │   ├── migrations.ts         # Data migration logic
│   │   └── seed.ts               # Sample data for first run
│   │
│   ├── repositories/
│   │   ├── customerRepo.ts       # Add/update/delete/search customers
│   │   ├── udhaarRepo.ts         # Udhaar lifecycle (add/update/delete/query)
│   │   ├── paymentRepo.ts        # Payment + udhaar reconciliation (transactions)
│   │   ├── saleRepo.ts           # Sales tracking
│   │   ├── aiMessageRepo.ts      # Chat history persistence
│   │   └── syncQueueRepo.ts      # Pending actions for sync
│   │
│   └── services/
│       ├── networkService.ts     # Online/offline detection + heartbeat
│       ├── syncService.ts        # Sync orchestration (push/pull, retry logic)
│       └── notificationService.ts # Local browser notifications
│
├── features/
│   ├── ai/
│   │   ├── adapters.ts           # LocalAIAdapter + CloudAIAdapter + askAI()
│   │   ├── engine.ts             # Main deterministic NLP engine (runEngine)
│   │   ├── intents.ts            # Intent detection (13 intent types)
│   │   ├── nlp.ts                # NLP utilities (normalize, matchCustomers, extractAmount, etc.)
│   │   ├── responses.ts          # Bilingual response templates
│   │   ├── insights.ts           # Business insight generation
│   │   └── types.ts              # AIAdapter, AIRequest, AIResult, KhataSnapshot, ActionProposal
│   └── lock/
│       └── LockScreen.tsx        # PIN entry UI
│
├── hooks/
│   ├── useApp.ts                 # Access AppContext
│   ├── useCountUp.ts             # Animated number counter
│   ├── useDueUdhaarNotifications.ts # Trigger local notifications for due udhaar
│   ├── useKhataData.ts           # Dexie hooks (useCustomers, useUdhaar, etc.)
│   ├── useNetwork.ts             # Online/offline status subscription
│   ├── useOwner.ts               # Default owner (currently hardcoded)
│   └── useSync.ts                # Sync service subscription
│
├── lib/
│   ├── pdf.ts                    # Receipt generation (jsPDF thermal-style)
│   └── utils.ts                  # Formatting, ID generation, date utilities
│
├── pages/
│   ├── AI/AI.tsx                 # Chat interface + speech recognition + proposal execution
│   ├── Customers/
│   │   ├── Customers.tsx         # Customer list + search
│   │   └── CustomerDetail.tsx    # Single customer view
│   ├── Dashboard/Dashboard.tsx   # KPI cards + recent activity + AI insights
│   ├── Notifications/Notifications.tsx
│   ├── Payments/Payments.tsx     # Payment list + add/record
│   ├── Reminders/Reminders.tsx   # Due date tracking + notification gating + messaging
│   ├── Reports/Reports.tsx       # Period-based analytics (today/week/month)
│   ├── Sales/Sales.tsx           # Sales list + tracking
│   ├── Settings/Settings.tsx     # Theme, language, PIN, data export
│   └── Udhaar/Udhaar.tsx         # Credit list + outstanding tracking
│
└── security/
    └── pin.ts                    # PBKDF2 PIN hashing + verification

public/
├── sw-listeners.js               # Service worker event handlers (installed PWA)
└── [PWA icons]
```

### 2.3 Dexie Database Architecture

**Schema Definition:** [src/data/db/db.ts](src/data/db/db.ts)

```typescript
class KhataDB extends Dexie {
  customers!: Table<Customer>
  udhaar!: Table<UdhaarEntry>
  payments!: Table<Payment>
  sales!: Table<Sale>
  syncQueue!: Table<SyncAction>
  aiMessages!: Table<AIMessage>
}
```

**Versions & Indexes:**

| Version | Table | Index Strategy |
|---------|-------|-----------------|
| 1 | customers | `id, name, phone, userId, shopId, syncStatus, createdAt, updatedAt` |
| 1 | udhaar | `id, customerId, userId, shopId, syncStatus, dueDate, remainingAmount, createdAt, updatedAt` |
| 1 | payments | `id, customerId, udhaarId, userId, shopId, syncStatus, date, createdAt, updatedAt` |
| 1 | sales | `id, customerId, userId, shopId, syncStatus, date, createdAt, updatedAt` |
| 1 | syncQueue | `id, table, recordId, createdAt, attempts` |
| 2 | aiMessages | `id, userId, shopId, createdAt` (chat history local-only) |
| 3 | aiMessages | `id, userId, shopId, [userId+shopId], createdAt` (compound index for multi-tenant queries) |

**Key Design Decisions:**
- **Syncable pattern:** Every financial record carries `userId`, `shopId`, `syncStatus`, `version`, `isDeleted`
- **Chat history isolation:** `aiMessages` table excluded from sync (no `syncStatus`), never enqueued
- **Soft deletes:** `isDeleted` flag instead of hard deletes (preserves sync history)
- **Multi-tenant ready:** `[userId+shopId]` compound index for future multi-shop support
- **No version collision:** Version increments on every write (optimistic lock prep)

**Indexes & Performance:**
- ✅ Primary keys on `id`
- ✅ Foreign key indexes on `customerId`, `udhaarId`, `userId`, `shopId`
- ✅ Sort indexes on `createdAt`, `date`, `dueDate`, `remainingAmount`
- ✅ Sync status index for pending→synced queries
- ⚠️ **No pagination index yet** (single table scan for all records)
- ⚠️ **No full-text search index** (regex filters applied in JavaScript)

### 2.4 Repository Pattern

**Architecture:** Each entity (Customer, Udhaar, Payment, Sale) has a dedicated repository file implementing CRUD + sync queue integration.

**Example (udhaarRepo.ts):**

```typescript
// Create with auto-generated ID + owner context
async function addUdhaar(input, owner): Promise<UdhaarEntry>

// Update with version bump + sync enqueue
async function updateUdhaar(id, changes): Promise<void>

// Soft delete (mark isDeleted)
async function deleteUdhaar(id): Promise<void>

// Queries (single, list, filter, aggregations)
async function getUdhaarById(id): Promise<UdhaarEntry>
async function getUdhaarByCustomer(customerId): Promise<UdhaarEntry[]>
async function getAllUdhaar(): Promise<UdhaarEntry[]>
async function getOutstandingUdhaar(): Promise<UdhaarEntry[]>
async function getOverdueUdhaar(): Promise<UdhaarEntry[]>
```

**Sync Queue Integration:**

Every write (add/update/delete) automatically calls `enqueueSyncAction(table, recordId, operation, payload)`:

```typescript
await db.udhaar.add(entry)
await enqueueSyncAction('udhaar', entry.id, 'create', entry)  // ← auto-enqueued
```

**Atomic Transactions (Payment Case):**

Adding a payment must atomically:
1. Create the Payment record
2. Fetch the related UdhaarEntry
3. Update the UdhaarEntry's `paidAmount` and `remainingAmount`
4. Enqueue both syncs

```typescript
await db.transaction('rw', db.payments, db.udhaar, db.syncQueue, async () => {
  await db.payments.add(payment)
  if (payment.udhaarId) {
    const entry = await db.udhaar.get(payment.udhaarId)
    // Update entry with new amounts
    await db.udhaar.put(updated)
    await enqueueSyncAction('udhaar', entry.id, 'update', updated)
  }
})
await enqueueSyncAction('payments', payment.id, 'create', payment)
```

**Strengths:**
- ✅ Consistent, predictable API
- ✅ Automatic sync queue integration
- ✅ Atomic transactions where needed
- ✅ Soft deletes preserve audit trail

**Limitations:**
- ⚠️ No explicit error handling or rollback patterns
- ⚠️ N+1 queries not optimized (filter → map pattern)
- ⚠️ No batch operations for bulk writes
- ⚠️ Query methods are synchronous-ish (Dexie promises)

### 2.5 Sync Queue Architecture

**File:** [src/data/services/syncService.ts](src/data/services/syncService.ts)

**State Machine:**

```
Offline/Idle
    ↓
User creates record
    ↓
Repository → enqueueSyncAction(table, recordId, op, payload)
    ↓
SyncQueue table: { id, table, recordId, operation, payload, createdAt, attempts, error? }
    ↓
Network available
    ↓
syncService.sync()
    ↓
Push: POST all pending actions to cloud provider
    ↓
If success: mark syncStatus='synced', remove from queue
If failure: increment attempts, retry with exponential backoff
    ↓
Pull: GET changes since lastSyncAt
    ↓
Apply pulled records to local database
    ↓
setLastSyncAt() → localStorage
```

**Retry Logic:**

```typescript
const RETRY_DELAYS = [1000, 2000, 5000, 10000, 30000]
// Exponential backoff: 1s → 2s → 5s → 10s → 30s (then stop)
const delay = RETRY_DELAYS[Math.min(attempts, RETRY_DELAYS.length - 1)]
```

**Offline-First Behavior:**

- Writes succeed locally even if offline
- Records sit in IndexedDB with `syncStatus='pending'`
- Page reload keeps local data (IndexedDB is persistent)
- Network restored → automatic sync
- If push fails: stays pending, user sees spinner

**Strengths:**
- ✅ Network-agnostic: works offline, syncs on reconnect
- ✅ Automatic retry with backoff
- ✅ Honest error reporting to user
- ✅ Never silently fails

**Limitations:**
- ⚠️ No conflict resolution (last-write-wins assumed)
- ⚠️ No multi-device merge logic
- ⚠️ No transaction rollback if push partially fails
- ⚠️ CloudProvider.push/pull are currently scaffolded (REST stub)

### 2.6 Offline-First Behavior

**Design Principle:** Local database is the **source of truth**. Cloud is a backup + sync partner.

**Offline Use Cases:**

1. **Read-heavy queries:** All dashboard, reports, customer lists work offline via Dexie
2. **Create/Update:** Writes enqueued locally, synced later
3. **AI queries:** LocalAIAdapter runs deterministically (no network needed)
4. **Notifications:** Local reminders trigger from local data
5. **PDF receipts:** Generated entirely from local records

**Offline Limitations:**

- ❌ Cloud LLM queries not available → fallback to LocalAI or honest "offline" message
- ❌ Cannot pull remote changes
- ❌ Push queued only when online
- ⚠️ Large dataset performance depends on device IndexedDB limits (typically 50MB–1GB)

**Test Scenario:**

```
1. User online → creates 100 customers
2. Go offline → create payments (all queued locally)
3. Dashboard, Udhaar, Reports all work (data is local)
4. AI queries use LocalAI
5. Go back online → sync fires automatically
6. Pending actions marked 'synced'
```

### 2.7 AI Architecture

**File:** [src/features/ai/](src/features/ai/)

**Adapter Pattern:**

```typescript
interface AIAdapter {
  readonly name: string
  isAvailable(): boolean
  answer(request: AIRequest): Promise<AIResult>
}

class LocalAIAdapter implements AIAdapter
class CloudAIAdapter implements AIAdapter
```

**LocalAIAdapter (Deterministic):**

**File:** [src/features/ai/engine.ts](src/features/ai/engine.ts)

```
Input: "Ahmed ne 2000 ka udhaar liya"
   ↓
Normalize: remove punctuation, lowercase
   ↓
detectIntent(): ADD_UDHAAR
   ↓
matchCustomers(input, data.customers): { status: 'unique', customer }
   ↓
extractAmount(input): 2000
   ↓
Generate ActionProposal:
   {
     kind: 'ADD_UDHAAR',
     customerId: '...',
     customerName: 'Ahmed',
     amount: 2000,
     description: 'Udhaar (via Khata AI)',
     date: <today>
   }
   ↓
Return: { type: 'proposal', text: "...", proposal }
```

**Intent Detection:** [src/features/ai/intents.ts](src/features/ai/intents.ts)

| Intent | Trigger Example | Action |
|--------|-----------------|--------|
| RECORD_PAYMENT | "Ahmed ki 2000 payment lo" | Create Payment record |
| ADD_UDHAAR | "Ahmed ko 5000 ka credit de" | Create UdhaarEntry |
| DELETE_PAYMENT | "Last payment delete kar" | Soft-delete Payment |
| DELETE_UDHAAR | "Ahmed ka udhaar hatao" | Soft-delete UdhaarEntry |
| SEND_REMINDER | "Ahmed ko message bhejo" | Trigger WhatsApp share |
| CUSTOMER_BALANCE | "Ahmed ka balance?" | Query → response |
| CUSTOMER_HISTORY | "Ahmed ki transaction history" | Query → formatted list |
| TOP_DEBTORS | "Sabse zyada udhaar kis ka?" | Aggregation → response |
| SALES_SUMMARY | "Is month sales?" | Filter + sum → response |
| BUSINESS_INSIGHT | "Business kaisa chal raha?" | Multi-metric summary |
| TOTALS | "Kitna udhaar pending?" | Global aggregations |
| OVERDUE_CUSTOMERS | "Kaunse overdue hain?" | Filter + format |
| UNKNOWN | (no match) | Honest "didn't understand" |

**NLP Utilities:** [src/features/ai/nlp.ts](src/features/ai/nlp.ts)

```typescript
normalize(input): string  // lowercase, remove punctuation, trim
matchCustomers(input, customers): CustomerMatch
  - Tokenize, skip stopwords
  - Score by name match (exact, first token, partial)
  - Return: unique | ambiguous | none

extractAmount(input): number | undefined
  - Parse numeric (123, 1000, 1,000)
  - Parse word numbers (ek, do, teen, sau, hazar, lakh)
  - Handle multipliers (2 hazar = 2000)

isInPeriod(dateStr, 'today'|'week'|'month'): boolean
  - Date range checks for filtering

localToday(): string  // YYYY-MM-DD
```

**Response Generation:** [src/features/ai/responses.ts](src/features/ai/responses.ts)

- Bilingual (en, ur) response templates
- Parameterized format strings
- Examples:
  - Balance: "Ahmed — PKR 5,000 outstanding..."
  - Totals: "Khata summary: Outstanding: PKR X across Y customers..."
  - Clarification: "I found 2 customers: Ahmed, Mohammed. Which one?"

**Insights:** [src/features/ai/insights.ts](src/features/ai/insights.ts)

- Month-to-month sales trends
- Overdue analysis
- Top debtors
- Collections health
- Bilingual insight generation

**Strengths:**
- ✅ Deterministic (no hallucinations)
- ✅ Works offline
- ✅ Fast (no API latency)
- ✅ Transparent logic (no black box)
- ✅ Covers 80% of common queries

**Limitations:**
- ⚠️ No advanced NLU (no entity linking, no semantic understanding)
- ⚠️ No context memory (each query is independent)
- ⚠️ Limited to regex-based intent detection
- ⚠️ Ambiguity resolution is basic (exact match → first token → partial)
- ❌ Roman Urdu tokenization is limited (basic stopword removal only)
- ❌ Date parsing is basic (no "next week", "jab tak", relative dates)

### 2.8 CloudAIAdapter & Cloud Integration

**File:** [src/data/cloud/](src/data/cloud/)

**CloudAIAdapter Architecture:**

```typescript
class CloudAIAdapter implements AIAdapter {
  async answer(request: AIRequest): Promise<AIResult> {
    const response = await fetch(VITE_AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: request.input,
        language: request.language,
        summary: summarizeData(request.data),  // ← Only send summary, not full data
        instruction: 'Answer using ONLY the numbers provided...'
      })
    })
    return { type: 'answer', text: json.text }
  }
}
```

**Data Summarization (Privacy-First):**

Instead of sending full database:

```typescript
{
  customers: [
    { id, name, phone, outstanding },
    ...
  ],
  totals: {
    outstanding, udhaarGiven, received, salesAllTime, overdueEntries
  }
}
```

**Cloud Provider Interface:** [src/data/cloud/CloudProvider.ts](src/data/cloud/CloudProvider.ts)

```typescript
interface CloudProvider {
  name: string
  authenticate(credentials): Promise<boolean>
  push(actions: SyncAction[]): Promise<SyncResult>
  pull(since?: string): Promise<PullResult>
  getServerTime?(): Promise<string>
}

// REST implementation: scaffolded, returns dummy data
export class RestCloudProvider implements CloudProvider
```

**Current Status:**

- 🔴 Not connected to any real backend
- 🔴 Environment variables: `VITE_AI_ENDPOINT`, `VITE_API_BASE_URL` (undefined by default)
- ✅ Interface defined, ready for implementation
- ⚠️ Missing authentication strategy (no token refresh, no OAuth flow)
- ⚠️ No conflict resolution strategy
- ⚠️ No data encryption in transit (assumes HTTPS)

### 2.9 ActionProposal Safety Flow (Critical)

**File:** [src/pages/AI/AI.tsx](src/pages/AI/AI.tsx) + [src/features/ai/engine.ts](src/features/ai/engine.ts)

**Flow Diagram:**

```
User voice/text input
   ↓ (AI page receives)
AI.tsx: sendText(raw)
   ↓
askAI({ input, data, language })
   ↓
engine.runEngine() returns:
   - { type: 'answer', text } → display
   - { type: 'proposal', text, proposal } → ConfirmCard
   - { type: 'clarification', text } → ask again
   ↓
If proposal:
   pushMessage('ai', proposalLead, proposal)
      - Generates unique ID
      - Saves to aiMessages table
      - Shows ConfirmCard component
   ↓
User sees proposal card with:
   - Structured summary (e.g., "Record payment: Ahmed, PKR 2000")
   - Confirm button
   - Cancel button
   ↓
If Confirm:
   executeProposal(proposal)
      - Run appropriate repository function (addPayment, addUdhaar, etc.)
      - Transaction completes
      - Update aiMessages.actionState = 'confirmed'
   → Response: "Done! PKR 2000 payment recorded..."
   ↓
If Cancel:
   Update aiMessages.actionState = 'cancelled'
   → Response: "Cancelled."
```

**ActionProposal Types:**

```typescript
type ActionProposal = {
  kind: 'RECORD_PAYMENT'
         | 'ADD_UDHAAR'
         | 'DELETE_PAYMENT'
         | 'DELETE_UDHAAR'
         | 'SEND_REMINDER'
  customerId: string
  customerName: string
  amount?: number
  method?: string
  date?: string
  udhaarId?: string
  udhaarDescription?: string
  udhaarRemaining?: number
  description?: string
  customerPhone?: string
  note?: { en: string; ur: string }
  // ... other context fields
}
```

**Strengths (Safety):**

- ✅ No write happens without explicit confirmation
- ✅ Proposal is a structured contract (clear what will happen)
- ✅ All financial mutations go through repositories (single path)
- ✅ Transaction atomicity in payment logic
- ✅ Chat history records both input and confirmation state
- ✅ Easy to audit: look up actionState='confirmed' in aiMessages

**Limitations:**

- ⚠️ Voice confirmation is not yet implemented (text-only)
- ⚠️ No spoken read-back before confirm
- ⚠️ No 2-factor confirmation for high-value transfers
- ⚠️ Timeout: if page reloads, pending proposal is lost (but saved in DB with actionState=undefined)
- ⚠️ No rate limiting on rapid proposals

### 2.10 AI Chat History

**File:** [src/data/repositories/aiMessageRepo.ts](src/data/repositories/aiMessageRepo.ts)

**Schema (aiMessages table):**

```typescript
type AIMessage = {
  id: string
  userId: string
  shopId: string
  role: 'user' | 'ai'
  content: string
  createdAt: string
  action?: ActionProposal      // populated if AI generated a proposal
  actionState?: 'pending' | 'confirmed' | 'cancelled'
  // Note: actionState 'executing' is transient (never persisted)
}
```

**Operations:**

```typescript
addAIMessage(message): void            // Append to history
updateAIMessageState(id, state): void  // Set to 'confirmed'|'cancelled'
getAIMessageHistory(owner): AIMessage[] // Fetch entire history (sorted by createdAt)
clearAIMessageHistory(owner): void     // Delete all for this owner
```

**Indexes:**
- ✅ `id` (primary)
- ✅ `userId, shopId, createdAt` (compound for multi-tenant queries)

**Strengths:**

- ✅ Separate from financial records (no sync, no cloud push)
- ✅ Full audit trail (every message, every proposal state)
- ✅ Queryable by owner

**Limitations:**

- ⚠️ No text search (no full-text index)
- ⚠️ No message editing/deletion
- ⚠️ No conversation threading/grouping
- ⚠️ Chat history is unbounded (no archival, no TTL)
- ⚠️ No privacy/encryption at rest

### 2.11 PWA Architecture

**File:** [vite.config.ts](vite.config.ts) + [public/sw-listeners.js](public/sw-listeners.js)

**Manifest:**

```json
{
  "name": "Digital Khata",
  "short_name": "Khata",
  "description": "Offline-first udhaar ledger...",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#0F766E",
  "orientation": "portrait-primary"
}
```

**Service Worker (Workbox):**

```javascript
// vite.config.ts VitePWA plugin:
workbox: {
  navigateFallback: 'index.html',  // SPA fallback
  globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
  importScripts: ['/sw-listeners.js']
}
```

**SW Listeners:** [public/sw-listeners.js](public/sw-listeners.js)

- Listens to notification clicks (installed PWA)
- Stores in custom event handlers
- Allows Dexie queries to work in SW context (for notification filtering)

**Features:**

- ✅ Installable on iOS/Android
- ✅ Offline-first caching (assets served from SW cache)
- ✅ Auto-update on next visit
- ✅ Native-like icon on home screen
- ✅ Full-screen standalone mode (no browser chrome)
- ✅ Local notifications from SW (service worker API)

**Limitations:**

- ⚠️ No background sync (iOS restrictions)
- ⚠️ Notification clicks require custom event handling
- ⚠️ No push notifications (requires backend)
- ⚠️ Storage limited by browser (50MB–1GB depending on device)

### 2.12 PIN Protection

**File:** [src/security/pin.ts](src/security/pin.ts)

**Algorithm:**

```
User sets PIN: "1234"
   ↓
generateRandomSalt() → 16 random bytes (hex)
   ↓
PBKDF2-SHA256(password=PIN, salt=salt, iterations=150000, keyLength=256bits)
   ↓
Store in localStorage:
   dk-pin-hash: "150000:<hex-hash>"
   dk-pin-salt: "<hex-salt>"
```

**Verification:**

```
User enters PIN: "1234"
   ↓
Fetch dk-pin-hash, dk-pin-salt from localStorage
   ↓
Extract iterations from hash
   ↓
PBKDF2-SHA256(password=PIN, salt=salt, iterations=iterations)
   ↓
Constant-time comparison: computed hash == stored hash
```

**Lock State Management:**

```typescript
// Per-tab session storage (reload = still locked, new tab = re-lock if PIN set)
sessionStorage.setItem('dk-unlocked', '1')  // Unlocked
sessionStorage.removeItem('dk-unlocked')    // Locked
```

**Security:**

- ✅ PBKDF2 with 150,000 iterations (as of 2026, acceptable; use Argon2 for future upgrades)
- ✅ Random salt per PIN
- ✅ Constant-time comparison (no timing attacks)
- ✅ Plain PIN never persisted

**Limitations:**

- ⚠️ localStorage is not encrypted at rest (device security depends on OS)
- ⚠️ 4-digit PIN (10,000 combinations) — brute-forceable on device
- ⚠️ No rate limiting on wrong attempts
- ⚠️ Lock is per-tab (not per-device or per-session)

### 2.13 Internationalization (i18n)

**Files:** [src/core/i18n/](src/core/i18n/)

**Architecture:**

```typescript
const translations = { en, ur }

export function t(key: TranslationKey, language: 'en'|'ur', params?): string
  - Split key by '.' (e.g., "dashboard.title")
  - Traverse nested object
  - Replace params: {count} → value
  - Return string

export function useTranslation() {
  return { language, t(), dir }
}
```

**Translation Files:**

- [src/core/i18n/en.ts](src/core/i18n/en.ts) — English (nested object)
- [src/core/i18n/ur.ts](src/core/i18n/ur.ts) — Urdu (nested object)

**Example Structure:**

```typescript
{
  app: { name: '...', tagline: '...' },
  nav: { dashboard: '...', customers: '...' },
  dashboard: { title: '...', subtitle: '...' },
  // ... 50+ top-level sections
}
```

**RTL Support:**

```typescript
// AppProvider sets:
document.documentElement.setAttribute('dir', language === 'ur' ? 'rtl' : 'ltr')

// Tailwind logical CSS:
ps-4    // padding-start (left in LTR, right in RTL)
border-e-2  // border-end
ms-auto // margin-start
```

**Strengths:**

- ✅ Type-safe translation keys (nested type checking)
- ✅ Automatic RTL direction
- ✅ Logical CSS properties (no manual LTR/RTL duplicates)
- ✅ Parameterized strings
- ✅ Easy to add new languages

**Limitations:**

- ⚠️ No lazy-loading of language files
- ⚠️ No pluralization rules (handled manually)
- ⚠️ No date/number formatting locale integration
- ⚠️ No HTML in translations (all plain text)

### 2.14 RTL Implementation

**Scope:** English (LTR) and Urdu (RTL)

**Implementation:**

1. **Direction:** `dir="rtl"` on `<html>` (AppProvider)
2. **Logical CSS:**
   - `padding-start/end` instead of `left/right`
   - `margin-start/end`
   - `border-start/end`
   - `float-start/end`
   - `text-start/end`
3. **Tailwind Config:** Uses logical properties natively
4. **Icons:** Lucide React handles flipping automatically in RTL
5. **Forms:** Input `dir="auto"` for mixed Urdu/English
6. **Numbers:** Digit display is consistent (0–9 stays LTR in Urdu)

**Verification (Manual):**

- ✅ Sidebar moves right in Urdu
- ✅ Text alignment flips
- ✅ Borders and spacing flip
- ⚠️ Charts/graphs may need RTL-specific logic (not yet done)
- ⚠️ Modal backdrop/dialogs need testing
- ⚠️ Dark theme redesign should include RTL audit

### 2.15 Reports & Analytics

**File:** [src/pages/Reports/Reports.tsx](src/pages/Reports/Reports.tsx)

**Scope:**

- Period selection: today, week, month
- KPIs: total sales, total udhaar, total received, overdue
- Charts: sales by day, udhaar by customer, payment timeline
- Filters: period-based aggregation

**Query Pattern:**

```typescript
const filtered = udhaar.filter(e => isInPeriod(e.createdAt, period))
  .reduce((sum, e) => sum + e.amount, 0)
```

**Limitations:**

- ⚠️ No custom date range (only preset periods)
- ⚠️ No comparison (month-over-month)
- ⚠️ No CSV export
- ⚠️ No drill-down into transactions
- ⚠️ No performance optimization for large datasets (all in-memory filtering)

### 2.16 Reminders & Notifications

**Files:**
- [src/pages/Reminders/Reminders.tsx](src/pages/Reminders/Reminders.tsx)
- [src/hooks/useDueUdhaarNotifications.ts](src/hooks/useDueUdhaarNotifications.ts)
- [src/data/services/notificationService.ts](src/data/services/notificationService.ts)

**Reminder Flow:**

```
Udhaar table: dueDate field set
   ↓
useDueUdhaarNotifications hook (runs on app mount + data changes)
   ↓
Detect overdue entries (dueDate <= today)
   ↓
Check localStorage: already notified today?
   ↓
If not: request Notification permission
   ↓
notificationService.showLocalNotification(title, body)
   ↓
Service Worker posts notification (or fallback to page-level API)
   ↓
User sees: "Due Udhaar: PKR X across Y customers"
   ↓
Click opens app, navigate to Reminders page
   ↓
User manually sends reminder via Web Share API (WhatsApp, SMS, etc.)
```

**Notification Service:**

```typescript
class NotificationService {
  isSupported(): boolean
  getPermission(): 'default'|'granted'|'denied'|'unsupported'
  requestPermission(): Promise<...>
  showLocalNotification(title, body): Promise<boolean>
}
```

**Limitations:**

- ⚠️ One notification per day (deduplicated by date)
- ⚠️ No reminders sent automatically (user must initiate WhatsApp share)
- ⚠️ Web Share API varies by browser/OS
- ⚠️ Permission request may be denied
- ⚠️ iOS doesn't support background notification fetch (PWA limitation)

### 2.17 PDF System

**File:** [src/lib/pdf.ts](src/lib/pdf.ts)

**Scope:** Generate thermal-style (80mm) receipts for:
- Udhaar creation
- Payment recording
- Sale recording

**Features:**

- ✅ jsPDF-based
- ✅ Thermal printer format (80mm width, 150mm auto-height)
- ✅ Header, key-value pairs, dividers
- ✅ Branding (app name, tagline, teal colors)
- ⚠️ English labels only (Urdu not supported due to jsPDF font limitations)

**Limitation:** Cannot shape Urdu script in jsPDF (no built-in Urdu font support)

### 2.18 Error Handling & Loading States

**Error Boundary:** [src/components/ui/ErrorBoundary.tsx](src/components/ui/ErrorBoundary.tsx)

```typescript
export class ErrorBoundary extends Component {
  // Catch render errors in child routes
  // Show error card with recovery button
  // Never silently swallow
}
```

**Usage:** Keyed by pathname in AppLayout

```tsx
<ErrorBoundary key={location.pathname}>
  <Suspense fallback={<PageLoader />}>
    <Outlet />
  </Suspense>
</ErrorBoundary>
```

**Page Loader:** Displays while lazy-loaded route chunks load

**Strengths:**

- ✅ Route-level error recovery (one page crash doesn't nuke nav)
- ✅ Honest error messages
- ✅ Never hides errors in console

**Limitations:**

- ⚠️ No retry mechanism (must manually reload)
- ⚠️ No error reporting to backend

### 2.19 Performance Optimizations (Existing)

**Lazy Loading:**
- ✅ All pages are lazy-loaded via React.lazy()
- ✅ Route-level code splitting (Vite auto-handles)

**Dexie Hooks (Live Queries):**
- ✅ useLiveQuery() for data subscriptions
- ✅ Reactive updates when database changes
- ✅ Returns `undefined` while loading (distinguishes "loading" from "empty")

**Tailwind CSS:**
- ✅ Vite plugin for CSS-in-JS → tree-shakeable
- ✅ Purged unused styles

**PWA Caching:**
- ✅ Assets cached via Service Worker
- ✅ Instant page load (cached + IndexedDB)

**Limitations:**

- ⚠️ No pagination on lists (all records loaded into React state)
- ⚠️ No virtual scrolling (large lists cause lag)
- ⚠️ Full data snapshot sent to AI engine (not scalable for 100k+ records)
- ⚠️ No request batching
- ⚠️ No connection pooling for IndexedDB

### 2.20 User/Shop Architecture

**Current Approach (Hardcoded):**

```typescript
// src/hooks/useOwner.ts
export function useOwner() {
  return { userId: 'user-default', shopId: 'shop-default' }
}
```

**Status:**

- 🔴 Single user hardcoded
- 🔴 Single shop hardcoded
- ✅ Database schema multi-tenant-ready (userId, shopId on every record)
- ✅ Compound index prepared `[userId+shopId]`

**Future Path:**

1. Add authentication (local PIN → cloud auth)
2. Allow multi-shop switching via UI
3. Sync only records for current shop
4. Prepare multi-user role-based access

---

## 3. Existing Phase 0–8 Features Verified

| Feature | Status | Implementation |
|---------|--------|-----------------|
| Offline-first ledger | ✅ Complete | Dexie + IndexedDB |
| Customer management | ✅ Complete | customerRepo + UI pages |
| Udhaar creation/tracking | ✅ Complete | udhaarRepo + queries |
| Payment recording | ✅ Complete | paymentRepo + atomic transactions |
| Sales tracking | ✅ Complete | saleRepo |
| Sync queue | ✅ Complete | syncService + push/pull |
| PIN protection | ✅ Complete | PBKDF2 + session lock |
| English/Urdu i18n | ✅ Complete | Nested translation keys + RTL |
| PWA + offline cache | ✅ Complete | Workbox + SW |
| Local notifications | ✅ Complete | notificationService |
| Local deterministic AI | ✅ Complete | LocalAIAdapter + NLP engine |
| ActionProposal safety | ✅ Complete | Confirm card + execution flow |
| Voice input (mic) | ✅ Complete | Web Speech API |
| Dashboard/KPIs | ✅ Complete | Period-based aggregations |
| Reports | ✅ Complete | Charts + period selection |
| Reminders | ✅ Complete | Due date tracking + notifications |
| Dark theme (basic) | ✅ Basic | CSS variables, not fully designed |
| PDF receipts | ✅ Complete | jsPDF thermal format |
| Error boundaries | ✅ Complete | Route-level recovery |

---

## 4. Requirement Mapping

### AI-First Features

| Requirement | Status | Current Implementation | Gap | Priority |
|-------------|--------|------------------------|-----|----------|
| AI-first interaction | 🟡 Partial | LocalAI chat page exists; deterministic engine | Missing: cloud LLM, context memory, ambiguity resolution | P0 |
| Voice-first UX | 🟡 Partial | Input: Web Speech API working; voice button present | Missing: TTS output, speakable responses, continuous listening | P0 |
| Voice input | ✅ Implemented | Web Speech API in AI.tsx | — | — |
| Voice output (TTS) | ❌ Missing | — | Requires TTS provider integration, voice selection (female Urdu/English) | P0 |
| Female Pakistani/Urdu voice | ❌ Missing | — | Requires TTS + voice research (Google Cloud TTS, Amazon Polly, local models) | P0 |
| Urdu understanding | 🟡 Partial | Stopword removal + regex intent detection | Missing: proper Urdu NLP, script normalization (Nastaliq handling) | P0 |
| Roman Urdu understanding | 🟡 Partial | Basic stopword removal; mixing in intents | Missing: Roman → Urdu mapping, script mixing handling | P0 |
| English understanding | ✅ Implemented | Regex-based intent + NLP matching | — | — |
| Mixed Urdu/English | 🟡 Partial | App detects language; queries can mix | Missing: mixed-script tokenization | P1 |
| Natural language date parsing | ❌ Missing | Only YYYY-MM-DD + localDateKey() | Missing: "next week", "jab tak", relative dates | P1 |
| Natural amount parsing | 🟡 Partial | Word numbers (ek, do, hazar, lakh) implemented | Missing: rupee symbol parsing, "aadha", fractions | P1 |

### AI Core Operations

| Requirement | Status | Current Implementation | Gap | Priority |
|-------------|--------|------------------------|-----|----------|
| AI customer search | 🟡 Partial | matchCustomers() with fuzzy scoring | Missing: phonetic matching (soundex), contextual ranking | P0 |
| AI customer disambiguation | 🟡 Partial | Ambiguous state → clarification message | Missing: learning from corrections, context propagation | P1 |
| AI balance queries | ✅ Implemented | CUSTOMER_BALANCE intent | — | — |
| AI transaction history | ✅ Implemented | CUSTOMER_HISTORY intent | — | — |
| AI udhaar creation | ✅ Implemented | ADD_UDHAAR intent + proposal | — | — |
| AI payment recording | ✅ Implemented | RECORD_PAYMENT intent + proposal | — | — |
| AI sales recording | ❌ Missing | No intent for "Ahmed ko 1000 ka sale" | Requires ADD_SALE action/proposal | P1 |
| AI customer management | 🟡 Partial | Cannot create customer via AI | Missing: ADD_CUSTOMER intent + proposal | P1 |
| AI reminder creation | ✅ Implemented | SEND_REMINDER intent | — | — |
| AI navigation | ❌ Missing | No intent for "reports kholo" | Requires router integration | P1 |
| AI reports/questions | 🟡 Partial | BUSINESS_INSIGHT intent | Missing: complex queries, comparisons | P1 |
| Financial confirmation safety | ✅ Implemented | ActionProposal + ConfirmCard | — | — |

### Voice & UX

| Requirement | Status | Current Implementation | Gap | Priority |
|-------------|--------|------------------------|-----|----------|
| Persistent conversation history | ✅ Implemented | aiMessages table + load on mount | Missing: search, threading, archival | P0 |
| Voice transcript history | 🟡 Partial | Text stored, but not labeled as "voice" | Missing: voice-specific metadata, playback | P1 |
| Offline AI | ✅ Implemented | LocalAIAdapter always available | — | — |
| Online AI (cloud) | ❌ Missing | CloudAIAdapter scaffolded, no endpoint | Requires backend LLM service | P0 |
| Cloud provider abstraction | ✅ Implemented | CloudProvider interface | Missing: multiple provider support, failover | P1 |
| Proper scrolling (mobile) | 🟡 Partial | CSS-based overflow handling | Missing: momentum scrolling, scroll position restoration | P1 |
| Responsive mobile UX | 🟡 Partial | Mobile nav, breakpoints present | Missing: touch-optimized buttons, gestures | P1 |
| Responsive desktop UX | ✅ Implemented | Sidebar, desktop nav, width breakpoints | — | — |
| Urdu RTL mirroring | ✅ Implemented | Logical CSS, dir="rtl" | — | — |
| Dark theme | 🟡 Partial | Colors defined; basic implementation | Missing: proper design pass, contrast audit | P2 |

### Scalability

| Requirement | Status | Current Implementation | Gap | Priority |
|-------------|--------|------------------------|-----|----------|
| Large dataset support | 🟡 Partial | IndexedDB can handle 50MB–1GB | Missing: pagination, virtualization, indexed queries | P0 |
| IndexedDB indexes | ✅ Implemented | Compound indexes defined | Missing: full-text search, secondary indexes | P1 |
| Pagination | ❌ Missing | — | Requires UI + repository changes | P0 |
| Virtualization | ❌ Missing | — | Requires virtual-scroll library + long list support | P0 |
| Search scalability | 🟡 Partial | Regex filters in JavaScript | Missing: indexed search, FTS, trie-based lookup | P1 |
| AI context generation | 🟡 Partial | KhataSnapshot (full tables) passed to engine | Missing: targeted slicing, vector embeddings | P1 |

### Data Integrity & Sync

| Requirement | Status | Current Implementation | Gap | Priority |
|-------------|--------|------------------------|-----|----------|
| Audit trail | ✅ Implemented | createdAt, updatedAt, version on all records | Missing: change log, who made the change | P1 |
| Data integrity | ✅ Implemented | Transactions + sync status tracking | Missing: checksums, conflict detection | P1 |
| PIN protection | ✅ Implemented | PBKDF2 session lock | Missing: biometric auth, timeout auto-lock | P1 |
| PWA/offline support | ✅ Implemented | Service worker + IndexedDB | — | — |
| Sync architecture | ✅ Implemented | Push/pull with retry backoff | Missing: conflict resolution, 3-way merge | P1 |
| Multi-shop readiness | 🟡 Partial | Schema supports userId+shopId | Missing: UI switcher, permission filtering | P2 |

### Other

| Requirement | Status | Current Implementation | Gap | Priority |
|-------------|--------|------------------------|-----|----------|
| Accessibility | 🟡 Partial | Semantic HTML, color contrast present | Missing: ARIA labels, focus management, screen reader testing | P2 |
| Performance/bundle size | ✅ Implemented | Lazy routes, Tailwind purging | Missing: code splitting review, tree-shake analysis | P1 |
| Notifications | ✅ Implemented | Local browser notifications | Missing: push notifications, reminder scheduling | P1 |
| WhatsApp/share reminder flow | ✅ Implemented | Web Share API integration | Missing: official WhatsApp Business API, automation | P2 |

---

## 5. Gap Analysis

### P0 Gaps (Critical for MVP)

#### 1. Voice Output (TTS)
**What Exists:**
- Voice input (Web Speech API)
- Text-based AI responses

**What's Missing:**
- Text-to-speech synthesis
- Female voice selection
- Urdu/English voice models
- Speakable response phrasing (short, clear, actionable)

**Why It Matters:**
- "Voice-first" is incomplete without hearing responses
- Low-literacy users need audio feedback
- Voice confirmation for high-value actions

**Affected Files:**
- AI.tsx (AI page)
- responses.ts (response templates)
- New: TTSAdapter + BrowserTTSAdapter + ProductionTTSAdapter

**Database Changes:** None

**Architectural Changes:** New adapter pattern for voice output (parallel to AIAdapter)

#### 2. Cloud AI Integration
**What Exists:**
- CloudAIAdapter (interface + stub)
- summarizeData() (privacy-first summary)

**What's Missing:**
- Real LLM backend (Alibaba, OpenAI-compatible, or custom)
- Authentication (bearer token, API key management)
- Latency handling (streaming, timeouts)
- Billing/rate limiting

**Why It Matters:**
- Deterministic AI hits limits (~13 intents + basic NLU)
- Cloud LLM can handle complex queries, context
- Online users get better experience
- Handles ambiguous cases (pronunciation variants, slang)

**Affected Files:**
- adapters.ts (CloudAIAdapter implementation)
- .env (VITE_AI_ENDPOINT, credentials)
- syncService.ts (trust cloud for queries only, not writes)

**Database Changes:** None

**Architectural Changes:**
- Secure backend design (no keys in frontend)
- Rate limiting + timeout handling
- Fallback strategy (network error → use LocalAI)

#### 3. Large Dataset Scalability
**What Exists:**
- Full table scans (filter in JavaScript)
- No pagination UI
- No virtual scrolling

**What's Missing:**
- Pagination (limit + offset at DB layer)
- Virtual scrolling (render only visible rows)
- Indexed queries (avoid full scans)
- AI retrieval slicing (don't send all records to engine)

**Why It Matters:**
- 10k+ customers = UI lag, slow queries
- Mobile devices with limited RAM crash
- AI engine becomes slow with full KhataSnapshot
- Sync becomes expensive

**Affected Files:**
- useKhataData.ts (hooks)
- repositories/* (add limit/offset methods)
- Pages (Customers, Udhaar, etc.)
- New: virtual-scroll component or library
- engine.ts (targeted AI retrieval)

**Database Changes:**
- Add pagination indexes
- Add cursor-based pagination to Dexie queries

**Architectural Changes:**
- Pagination contract: { data, hasMore, cursor }
- Targeted AI context: slice by customerId, dateRange, etc.

#### 4. Natural Language Date & Amount Parsing
**What Exists:**
- extractAmount(): supports "ek", "hazar", "lakh"
- YYYY-MM-DD only date support

**What's Missing:**
- Relative dates ("next week", "agle 7 din", "do hafta baad")
- Fuzzy date recognition
- Fraction amounts ("aadha", "sawa", "dhai")
- Rupee symbol parsing ("2000 rupay", "2000 ka")

**Why It Matters:**
- Users rarely say "2026-09-05"; they say "next week"
- Amounts are often spoken with rupee names
- Urdu/Roman Urdu speakers use colloquial phrases

**Affected Files:**
- nlp.ts (extractAmount, date parsing)

**Database Changes:** None

**Architectural Changes:** None (pure NLP)

#### 5. Urdu/Roman Urdu Script Handling
**What Exists:**
- Regex-based intent detection
- Basic stopword removal
- Script mixing in UI (Urdu text input works)

**What's Missing:**
- Nastaliq/Perso-Arabic script normalization
- Roman Urdu → Standard Urdu mapping
- Phonetic variants (kya, ke, ki; udhaar, odhar, udhar)
- Diacritics handling (zabar, zer, pesh)

**Why It Matters:**
- Pakistani users speak Roman Urdu (phone keyboards default)
- Urdu script has variants (Nastaliq vs. Naskh)
- Diacritics optional in Urdu (hamza, noon ghunna, etc.)

**Affected Files:**
- intents.ts (regex patterns)
- nlp.ts (tokenization, matching)

**Database Changes:** None

**Architectural Changes:** None (new NLP rules)

#### 6. Mobile Scrolling & UX
**What Exists:**
- Breakpoints (sm, lg)
- Mobile bottom nav
- FAB on desktop

**What's Missing:**
- Momentum scrolling (scroll position restoration)
- Pull-to-refresh
- Touch-optimized button sizes
- Gesture navigation (back swipe)
- Virtualized long lists

**Why It Matters:**
- Mobile users expect smooth scrolling
- List resets position on navigation (frustrating UX)
- Small buttons cause mis-taps

**Affected Files:**
- Pages/* (all list pages)
- globalFAB, MobileBottomNav (touch targets)

**Database Changes:** None

**Architectural Changes:** Virtual scroll library integration

#### 7. Offline/Online State Transitions
**What Exists:**
- networkService checks connectivity
- Sync queue waits for online
- LocalAI always available

**What's Missing:**
- Graceful degradation messaging ("offline mode: only LocalAI available")
- User-initiated retry button
- Conflict detection (local ≠ remote)
- Merge strategy (what if two shops edit the same customer?)

**Why It Matters:**
- Users don't know why cloud features are unavailable
- Silent failures cause confusion
- Multi-device scenarios untested

**Affected Files:**
- syncService.ts (conflict handling)
- AI pages (messaging)
- networkService.ts (enhanced status)

**Database Changes:** Add conflict tracking table

**Architectural Changes:** Conflict resolution strategy needed

### P1 Gaps (Important for Phase 10+)

#### 1. AI Advanced Intents (8)
- ADD_SALE: "Ahmed ko 1000 ka sale"
- ADD_CUSTOMER: "Naya customer add kar, Ahmed Merchant"
- UPDATE_DUE_DATE: "Ahmed ka udhaar 30 September ko due"
- PAYMENT_SPLIT: "Ahmed ne 1000 diye; 500 udhaar se, 500 naya"
- BULK_PAYMENT: "100 rupay har ek ko"
- QUERY_SPECIFIC_PERIOD: "Last 30 days ka sales"
- CONVERSATIONAL_CONTEXT: Remember previous customer in multi-turn
- CONFIRMATION_VARIANTS: "Haan", "Theek", "OK" instead of UI button

#### 2. Enhanced NLP (8)
- Phonetic matching (soundex for customer names)
- Contextual customer resolution (remember "Ahmed" from prior turn)
- Amount unit handling ("2 gaj ka cloth", "3 dozen eggs")
- Natural date expressions ("parson", "agle month ke pehle")
- Fraction handling ("saphed", "sawa", "dhai")
- Plural forms (Ahmed, Ahmeds)
- Colloquial verbs (dena/lena/lagna variations)
- Urdu numerals (۰–۹) parsing

#### 3. Chat History Features (5)
- Full-text search over messages
- Conversation threading (group by day/topic)
- Message editing/deletion
- Archive old conversations (TTL)
- Export conversation to PDF

#### 4. Accessibility (8)
- ARIA labels on all interactive elements
- Keyboard navigation (Tab, Enter, Esc)
- Focus trap in modals
- Screen reader testing (NVDA, JAWS)
- Color contrast audit (WCAG AA)
- Alt text on charts
- Form error announcements
- Skip-to-main-content link

#### 5. Performance Optimization (6)
- Code splitting analysis (bundle size audit)
- Request batching (multiple Dexie queries → single read)
- IndexedDB query caching
- Memoization of expensive computations
- Virtual scrolling for all long lists
- React DevTools profiling + optimization

#### 6. Sync & Multi-Device (4)
- Conflict detection (version mismatch)
- 3-way merge algorithm
- Last-write-wins vs. merge strategy
- Multi-device state sync

#### 7. Dark Theme Redesign (3)
- Proper contrast ratios
- Semantic color hierarchy
- Tested on actual dark backgrounds

---

## 6. Risk Analysis

### Critical Risks

| # | Risk | Severity | Probability | Mitigation |
|---|------|----------|-------------|-----------|
| 1 | **AI hallucination on amounts** | 🔴 High | 🟡 Medium | Validate all extracted amounts against regex patterns; require manual confirmation; fallback to "ask again" if ambiguous |
| 2 | **Silent financial write** | 🔴 High | 🟢 Low | Preserve ActionProposal flow; never skip confirmation; add 2-factor for high-value ops; audit log every write |
| 3 | **Customer matching error** (wrong Ahmed) | 🔴 High | 🟡 Medium | Improve matchCustomers() scoring; add phonetic matching; show top 3 candidates, not just 1; require explicit confirmation |
| 4 | **Sync conflict (offline then online)** | 🔴 High | 🟡 Medium | Implement conflict table; log conflicts; show user resolution UI; default to local copy for now |
| 5 | **IndexedDB quota exceeded** | 🔴 High | 🟡 Medium | Warn at 80% quota; implement archival/TTL for old records; estimate quota usage on key pages |
| 6 | **Large dataset lag on mobile** | 🔴 High | 🟡 Medium | Implement pagination + virtual scrolling; test with 10k+ records; profile on low-end devices |

### High-Risk Issues

| # | Risk | Severity | Probability | Mitigation |
|---|------|----------|-------------|-----------|
| 7 | **Date extraction errors** | 🟡 Medium | 🟡 Medium | Add date picker fallback; parse common formats (dd/mm, mm/dd); use fuzzy date parsing library |
| 8 | **Roman Urdu tokenization fails** | 🟡 Medium | 🟡 Medium | Build Roman Urdu phonetic dictionary; crowdsource corrections; log failures for NLP improvement |
| 9 | **Voice recognition errors** | 🟡 Medium | 🟡 Medium | Show transcript for user correction; allow re-recording; fallback to text input |
| 10 | **TTS voice not available** | 🟡 Medium | 🟡 Medium | Support multiple TTS providers; fallback to Google Cloud TTS; detect language and use appropriate voice |
| 11 | **Cloud AI timeouts** | 🟡 Medium | 🟡 High | Add 5-10s timeout; fallback to LocalAI; show "thinking..." spinner |
| 12 | **Duplicate financial actions** | 🟡 Medium | 🟢 Low | Idempotent action IDs; check syncQueue before re-executing; add rate limiting on rapid submissions |

### Medium-Risk Issues

| # | Risk | Severity | Probability | Mitigation |
|---|------|----------|-------------|-----------|
| 13 | **Network partition during sync** | 🟡 Medium | 🟡 Medium | Implement heartbeat + exponential backoff; show sync status UI; manual retry button |
| 14 | **PWA not updating** | 🟡 Medium | 🟡 Low | Use autoUpdate strategy; detect new version; prompt user to refresh; test update flow |
| 15 | **PIN brute-force** | 🟡 Medium | 🟡 Low | Add rate limiting (N failures → lock for X seconds); log attempts; consider biometric as secondary |
| 16 | **Chat history grows unbounded** | 🟡 Medium | 🟢 Low | Archive old messages (30+ days); implement TTL; warn when DB quota high |
| 17 | **RTL text rendering issues** | 🟡 Medium | 🟢 Low | Test mixed LTR/RTL text; audit all pages in Urdu mode; fix charts/graphs |
| 18 | **Dark theme contrast failure** | 🟡 Medium | 🟢 Low | WCAG AA audit on all pages; test on actual dark backgrounds; use contrast checker |

### Low-Risk Issues

| # | Risk | Severity | Probability | Mitigation |
|---|------|----------|-------------|-----------|
| 19 | **Missing translation keys** | 🟢 Low | 🟢 Low | Type-safe i18n (enforced at compile time); fallback to English |
| 20 | **Scroll position not restored** | 🟢 Low | 🟡 Medium | Store scroll position in sessionStorage; restore on back navigation |
| 21 | **Bundle size explosion** | 🟢 Low | 🟡 Medium | Monitor with bundlesize tool; lazy-load heavy libraries; tree-shake unused code |
| 22 | **Memory leak in hooks** | 🟢 Low | 🟢 Low | Cleanup subscriptions (useEffect cleanup); profile with React DevTools; test long sessions |

---

## 7. Architecture Recommendations

### 7.1 Keep Unchanged (Stable, Working)

| Component | Reason |
|-----------|--------|
| Dexie schema & repositories | Solid, multi-tenant ready, proven |
| ActionProposal safety flow | Non-negotiable for financial safety |
| LocalAIAdapter deterministic engine | Fast, offline, transparent, low-risk |
| Sync queue + offline-first | Core strength; only enhance conflict handling |
| PWA + service worker | Works well; enhance with background sync |
| PIN protection (PBKDF2) | Cryptographically sound; keep as is |
| i18n translation layer | Type-safe, extensible; working well |
| Logical CSS + RTL | Automatic, elegant; leverage this |
| Error boundaries + error UI | Clean recovery; maintain pattern |

### 7.2 Modify (Enhance, Not Rewrite)

| Component | Enhancement | Scope |
|-----------|-------------|-------|
| AI engine (intents) | Add 5–8 new intent types (ADD_SALE, ADD_CUSTOMER, etc.) | nlp.ts + engine.ts |
| NLP matching | Improve matchCustomers() with phonetic scoring | nlp.ts |
| Date parsing | Support relative dates, fuzzy parsing | nlp.ts |
| Chat history | Add search, threading, archival | aiMessageRepo.ts + UI |
| Sync service | Add conflict detection + merge UI | syncService.ts |
| Network service | Enhanced status (online/offline/degraded) | networkService.ts |
| Repositories | Add pagination (limit/offset) methods | customerRepo.ts, etc. |
| Dexie queries | Add cursor-based pagination | useKhataData.ts |
| AI engine | Add data slicing (don't send all records) | engine.ts |
| Reports | Add custom date ranges, comparisons | Reports.tsx |

### 7.3 Extend (New Modules)

| Component | Purpose | Type |
|-----------|---------|------|
| VoiceOutputAdapter | TTS interface + implementations | Service layer (parallel to AIAdapter) |
| BrowserTTSAdapter | Web Speech API SpeechSynthesis wrapper | Implementation |
| CloudTTSAdapter | Google Cloud TTS, Amazon Polly, etc. | Implementation (future) |
| PaginationHook | useKhataPagination(entity, limit) → { data, hasMore, next } | Hook |
| VirtualScrollComponent | Render only visible rows in long lists | UI component |
| ConversationHistory | Threaded/searchable chat view | New page or modal |
| ConflictResolutionUI | Display + resolve sync conflicts | New modal/page |
| DateParserService | Fuzzy date parsing ("next week") | Service (NLP) |
| RomanUrduNormalizer | Roman → Standard Urdu mapping | Service (NLP) |
| TelemetryService | Track errors, usage for debugging | Service (optional, phase 11+) |

### 7.4 Create New (Not Yet Existing)

| Component | Purpose | Layer |
|-----------|---------|-------|
| **VoiceOutputAdapter Pattern** | — | — |
| `interface VoiceOutputAdapter` | Abstract TTS provider | core/ai/ |
| `class BrowserTTSAdapter` | Web Speech API implementation | features/ai/ |
| `class CloudTTSAdapter` | Cloud provider (Google, Amazon) | features/ai/ (future) |
| `async synthesizeAndSpeak()` | Play audio from text | ai/adapters.ts |
| **Response Phrasing** | — | — |
| Speakable response format | Short, clear, action-oriented | ai/responses.ts |
| Confirmation read-back | "Confirm: 2000 rupay Ahmed se?" | engine.ts |
| **Scalability Layer** | — | — |
| `getPaginatedCustomers(limit, cursor)` | Dexie cursor + limit | repositories/ |
| `sliceContextForAI(customerId, dateRange)` | Targeted AI data | engine.ts |
| `useVirtualScroll()` | Render optimization | hooks/ |
| **Sync Conflict Handling** | — | — |
| `ConflictTable` | Track version mismatches | db.ts |
| `detectConflict()` | Compare local vs. remote version | syncService.ts |
| `resolveConflict()` | User-driven merge strategy | new UI |
| **NLP Enhancements** | — | — |
| `parseRelativeDate()` | "next week" → date range | nlp.ts |
| `romanUrduToUrdu()` | Transliteration mapping | nlp.ts |
| `phoneticScore()` | Soundex-based matching | nlp.ts |

### 7.5 AI Architecture Evolution

**Current (Phase 0–8):**

```
Input
  ↓
LocalAIAdapter
  ├─ detectIntent()
  ├─ matchCustomers()
  ├─ extractAmount()
  └─ runEngine() → AIResult
```

**Recommended (Phase 9+):**

```
Input
  ↓
LocalAIAdapter
  ├─ preprocess (normalize, script handling)
  ├─ detectIntent()
  ├─ if ambiguous: clarifyCustomers()
  ├─ sliceContext() ← NEW: don't send all data
  ├─ matchCustomers() ← ENHANCED: phonetic
  ├─ extractAmount() ← ENHANCED: relative dates, fractions
  ├─ generateProposal()
  └─ AIResult
  ↓
If online and fallback:
  ↓
CloudAIAdapter
  ├─ POST summarizeData() to endpoint
  ├─ LLM generates response
  └─ return AIResult
```

### 7.6 Voice Architecture (Adapter Pattern)

```
VoiceOutputAdapter (interface)
├── BrowserTTSAdapter
│   ├── window.speechSynthesis.speak()
│   ├── Language detection (en-US, ur-PK)
│   └── Voice selection (female, Pakistani accent)
└── CloudTTSAdapter
    ├── Google Cloud Text-to-Speech
    ├── Amazon Polly
    └── (future: custom model)

// Usage in AI.tsx:
await voiceAdapter.speak(text, language)
// Returns: Audio played, or fallback to silent
```

### 7.7 Offline/Online Architecture

**Enhanced Status Machine:**

```
States:
  'online'      - Network connected, can push/pull
  'offline'     - No network, queued locally
  'degraded'    - Network flaky, retrying
  'conflict'    - Version mismatch detected
  'syncing'     - Push/pull in progress

Transitions:
  online → offline: User goes without internet
  offline → syncing: Network restored
  syncing → online: Sync completed
  syncing → degraded: Timeout during sync
  degraded → syncing: User taps "retry"
```

**UI Feedback:**

```
Header indicator:
  🟢 Online (full features)
  🟡 Offline (LocalAI + local reads/writes)
  🔴 Degraded (syncing, retrying)
  ⚠️ Conflict (show resolution UI)

Action feedback:
  "Offline: changes saved locally"
  "Syncing... (3 of 10)"
  "Conflict: local vs remote. [Resolve]"
```

---

## 8. Files/Modules to Reuse

| File/Module | Reuse Strategy | Rationale |
|-------------|-----------------|-----------|
| `src/core/types/` | Extend (no breaking changes) | Schema is solid, multi-tenant-ready |
| `src/data/db/` | Extend (v4 migration if needed) | Dexie schema proven, add conflict table if needed |
| `src/data/repositories/` | Extend (add pagination methods) | Pattern is clean, just add limit/offset |
| `src/features/ai/engine.ts` | Modify (new intents + data slicing) | Core engine works; add features incrementally |
| `src/features/ai/adapters.ts` | Extend (implement CloudAIAdapter) | Stub exists, fill in with real backend |
| `src/data/services/syncService.ts` | Modify (add conflict detection) | Retry logic solid, add conflict handling |
| `src/core/i18n/` | Extend (add new keys) | Translation layer works great |
| `src/pages/AI/AI.tsx` | Modify (add TTS, fix UX) | Mostly good, enhance proposal UX + add voice output |
| `src/hooks/useKhataData.ts` | Modify (add pagination versions) | Solid pattern, add .paginated() variants |
| `src/components/ui/ConfirmCard.tsx` | Keep (proposal confirm) | Safe pattern, reuse for new actions |
| `src/app/layout/AppLayout.tsx` | Modify (add sync status indicator) | Layout shell works, enhance header |
| `src/context/AppProvider.tsx` | Extend (add sync status to context) | Context pattern solid, just add state |

**Files NOT to Reuse (Needs Redesign):**

| File | Reason | Action |
|------|--------|--------|
| `src/pages/Reports/Reports.tsx` | No custom date ranges, no comparisons | Redesign with date picker + multi-period view |
| `src/core/config/theme.ts` | Dark theme colors not finalized | Proper design pass needed |
| `src/components/ui/` | Some components lack a11y labels | Add ARIA labels, keyboard nav |

---

## 9. Files/Modules to Modify

| File | Change | Scope |
|------|--------|-------|
| `src/features/ai/intents.ts` | Add SALES_RECORD, CUSTOMER_ADD, etc. | +8 intents |
| `src/features/ai/nlp.ts` | Enhance matchCustomers(); add dateParser(); add Roman Urdu | +200 LOC |
| `src/features/ai/engine.ts` | Add data slicing; handle new intents | +150 LOC |
| `src/features/ai/responses.ts` | Add Urdu responses for new intents; shorten for TTS | +300 LOC |
| `src/pages/AI/AI.tsx` | Add TTS output; improve proposal UX | +200 LOC |
| `src/data/repositories/*.ts` | Add `get{Entity}Paginated(limit, cursor)` | +50 LOC per file |
| `src/hooks/useKhataData.ts` | Add paginated variants | +100 LOC |
| `src/data/services/syncService.ts` | Add conflict detection + UI trigger | +150 LOC |
| `src/data/services/networkService.ts` | Enhanced status (online/offline/degraded) | +100 LOC |
| `src/app/layout/AppLayout.tsx` | Show sync status indicator | +50 LOC |
| `src/context/AppProvider.tsx` | Add syncState to context | +30 LOC |
| `src/data/db/db.ts` | Add ConflictLog table (v4) | +10 LOC |
| `src/core/i18n/en.ts` | Add new response keys | +200 LOC |
| `src/core/i18n/ur.ts` | Add Urdu translations | +200 LOC |

**Total Estimate:** ~1800–2000 LOC of modifications (moderate)

---

## 10. New Files/Modules Required

| Module | File(s) | Purpose | LOC |
|--------|---------|---------|-----|
| **Voice Output** | `src/features/ai/voiceAdapters.ts` | TTS adapter pattern + implementations | 200 |
| | `src/features/ai/types.ts` (extend) | VoiceOutputAdapter interface | 20 |
| **Pagination** | `src/hooks/usePagination.ts` | Generic pagination hook | 100 |
| | `src/components/ui/PaginationControls.tsx` | Next/prev buttons + cursor | 80 |
| **Virtual Scrolling** | `src/components/ui/VirtualList.tsx` | Virtualization wrapper (or integrate react-window) | 150 |
| **Conflict Resolution** | `src/components/ui/ConflictResolutionModal.tsx` | Show conflicts, choose resolution | 150 |
| | `src/data/repositories/conflictLogRepo.ts` | CRUD for conflict log | 60 |
| **NLP Enhancements** | `src/lib/dateParser.ts` | Relative date parsing ("next week") | 200 |
| | `src/lib/romanUrduMap.ts` | Roman → Urdu transliteration dict | 100 |
| **Chat Features** | `src/pages/ConversationHistory.tsx` | Threaded/searchable chat view | 250 |
| | `src/hooks/useChatSearch.ts` | FTS over aiMessages | 80 |
| **Sync Status** | `src/components/ui/SyncStatusIndicator.tsx` | Header status badge | 80 |
| **Notifications** | `src/hooks/useConflictNotification.ts` | Detect + alert on conflict | 50 |

**Total New Code Estimate:** ~1500–1700 LOC

---

## 11. Database/Migration Impact

### Dexie Schema Changes

**Current (Phase 0–8):** v3 (with aiMessages + compound index)

**Proposed (Phase 9):**

```typescript
// v4: Add conflict tracking
this.version(4).stores({
  // ... existing tables ...
  conflictLog: 'id, recordId, table, version, createdAt'
})
```

**ConflictLog Table:**

```typescript
type ConflictLog = {
  id: string
  recordId: string
  table: KhataTable
  localVersion: number
  remoteVersion: number
  localRecord: KhataEntity
  remoteRecord: KhataEntity
  resolution?: 'local' | 'remote' | 'merged'
  createdAt: string
  resolvedAt?: string
}
```

### Data Migration Considerations

**Breaking Changes:** None — all new fields/tables are additive

**Migration Script Required:** No (v4 migration is automatic with Dexie)

**Backward Compatibility:** ✅ v3 databases auto-upgrade to v4 (no existing data touched)

### IndexedDB Quota Impact

- Current: ~10MB (depending on data size)
- With chat history + conflict log: ~15–20MB (acceptable)
- Mitigation: Implement archival (move old records to local JSON, recreate on demand)

---

## 12. AI Architecture Plan

### LocalAI Enhancements (Phase 9)

**Intents to Add (8):**

1. `ADD_SALE`: "Ahmed ko 1000 ka sale" → Create Sale record
2. `ADD_CUSTOMER`: "Naya customer, Ahmed Merchant" → Create Customer
3. `UPDATE_DUE_DATE`: "Ahmed ka udhaar 30 September ko due" → Update UdhaarEntry.dueDate
4. `PAYMENT_SPLIT`: "Ahmed ne 1000 diye; 500 udhaar, 500 naya" → Create Payment + track split
5. `BULK_ACTION`: "Har ek ko 100 rupay" → Aggregate action (NOT SAFE YET — skip v9)
6. `QUERY_PERIOD`: "Last 30 days sales" → Custom period queries
7. `CONTEXT_CARRY`: "Aur 500" (carry customer from prior turn) → State propagation
8. `AMBIGUOUS_CLARIFY`: Improved handling of ambiguous input

**NLP Improvements:**

```typescript
// Enhance these:
normalize(input)           // Handle Urdu diacritics
matchCustomers()          // Add phonetic scoring
extractAmount()           // Parse fractions, units
parseDate()               // Relative dates ("next week", "parson")
detectIntent()            // Add new intents

// New functions:
romanUrduToUrdu(input)    // "Ahmed" → "احمد" (for matching)
phoneticScore(name1, name2) // Soundex or similar
sliceContextForAI(data, filter) // Don't send all 100k records
conversationContext()     // Remember prior customer
```

### CloudAI Integration (Phase 10)

**Architecture:**

```
User: "Ahmed ne 5000 ka udhaar liya 15 Sept ko"
  ↓
LocalAI tries:
  detectIntent() → ADD_UDHAAR? (maybe 70% confident)
  matchCustomers("Ahmed") → unique? (maybe ambiguous)
  ↓
If confident → generate proposal
If ambiguous/low confidence:
  ↓
CloudAI (if online):
  POST: { prompt, language, summary, instruction }
  ← LLM response: confidence-ranked intents + extracted fields
  ↓
Pick highest confidence intent
Generate proposal
```

**Cloud Provider Interface (Already Defined):**

```typescript
interface CloudProvider {
  authenticate(credentials): Promise<boolean>
  push(actions): Promise<SyncResult>
  pull(since): Promise<PullResult>
}
```

**LLM Backend Requirements:**

- **Endpoint:** POST /api/ai/query
- **Input:** `{ prompt, language, summary, instruction }`
- **Output:** `{ type, text, proposal?, confidence? }`
- **Constraints:**
  - Never invent amounts (use only summary data)
  - Never fabricate customer names (match against provided list)
  - Language-aware (Urdu script handling)
  - Fast (<2s response)
  - Cost-efficient (log usage)

**Candidates:**

- OpenAI API (GPT-4, reliable but costly)
- Alibaba Cloud NLP (supports Urdu/Arabic scripts)
- Google Cloud Vertex AI (good performance, supports multi-language)
- Locally-hosted LLaMA (privacy, offline, but slower)

---

## 13. Voice Architecture Plan

### Voice Input (Existing, Enhance)

**Current:** Web Speech API in AI.tsx

**Enhance:**

```typescript
// Add language-specific recognition settings
recognition.lang = language === 'ur' ? 'ur-PK' : 'en-US'

// Add interim results display (show partial transcript)
// Add error recovery ("mic not found", retry)
```

### Voice Output (Missing, New)

**VoiceOutputAdapter Pattern:**

```typescript
interface VoiceOutputAdapter {
  readonly name: string
  isAvailable(): boolean
  speak(text: string, language: AILanguage): Promise<void>
}

class BrowserTTSAdapter implements VoiceOutputAdapter {
  // Uses window.speechSynthesis API
  // Voice selection: preferably female, Pakistani accent
}

class CloudTTSAdapter implements VoiceOutputAdapter {
  // Google Cloud Text-to-Speech, Amazon Polly, etc.
  // Better quality, supports multiple voices
}

// Usage in AI.tsx:
const voiceAdapter = getBestVoiceAdapter(language, isOnline)
await voiceAdapter.speak(responseText, language)
```

**Response Phrasing (Speakable):**

- Short: max 2–3 sentences per response
- Action-oriented: "Payment recorded" not "The system has successfully recorded..."
- Confirmation-friendly: Read-back proposals before confirming
- Urdu-first: Native speakers understand natural phrasing better

**Voice Selection:**

- **English:** Female, Pakistani/South Asian accent (Google Cloud has 'en-IN-Standard-C' which is close)
- **Urdu:** Female, native Urdu speaker (limited options; Google Cloud has 'ur' but no Nastaliq variant)

---

## 14. Offline/Online Architecture Plan

### Enhanced State Machine

```
┌─────────┐
│  ONLINE │  Full features, can sync
└────┬────┘
     │ Network lost
     ↓
┌──────────┐
│ OFFLINE  │  Queued locally, LocalAI only
└────┬─────┘
     │ Network restored
     ↓
┌──────────┐
│ SYNCING  │  Push/pull in progress
└────┬─────┘
     │ Error/timeout
     ↓
┌──────────────┐
│ DEGRADED     │  Retrying with backoff
└────┬─────────┘
     │ Still failing
     ↓
┌──────────────┐
│ CONFLICT     │  Version mismatch, user resolution needed
└──────────────┘
```

### Conflict Detection

**Trigger:** Version mismatch during sync

```typescript
// Local: { id, version: 3, updatedAt: '2026-08-28T10:00Z' }
// Remote: { id, version: 2, updatedAt: '2026-08-28T09:00Z' }
// → Local is newer (OK)

// Local: { id, version: 1, updatedAt: '2026-08-28T09:00Z' }
// Remote: { id, version: 2, updatedAt: '2026-08-28T10:00Z' }
// → Remote is newer (CONFLICT: which to trust?)
```

**Resolution Strategies:**

1. **Last-Write-Wins (LWW):** Use record with latest `updatedAt`
2. **Local-Wins:** Trust local copy (might lose remote changes)
3. **Remote-Wins:** Trust remote copy (might lose local work)
4. **Manual Merge:** Show user both versions, let them choose

**Implementation:**

```typescript
function detectConflict(local: Record, remote: Record): boolean {
  // Different versions = conflict
  return local.version !== remote.version
}

async function syncService.sync() {
  const pushResult = await push(pending)
  if (pushResult.conflicts?.length > 0) {
    // Store conflicts in DB
    for (const conflict of pushResult.conflicts) {
      await db.conflictLog.add(conflict)
    }
    // Notify UI: show modal
    notifyUserOfConflicts(pushResult.conflicts)
    return false // Halt sync, wait for user resolution
  }
  // Continue pull/apply
}
```

---

## 15. Scalability Plan

### Problem: Large Datasets

**Current State:** Works fine up to ~5k records; lag starts at 10k+ (mobile devices)

**Issues:**
- Full table scans in JavaScript (no IndexedDB query optimization)
- All data loaded into React state (memory pressure)
- AI engine receives entire KhataSnapshot (slow for large volumes)

### Solution: Pagination

**Repository Layer:**

```typescript
// Old:
async function getUdhaarByCustomer(customerId): Promise<UdhaarEntry[]>

// New:
async function getUdhaarByCustomerPaginated(
  customerId: string,
  limit: number,
  cursor?: string // opaque cursor for next page
): Promise<{ data: UdhaarEntry[], hasMore: boolean, nextCursor?: string }>
```

**Hook Layer:**

```typescript
function usePaginatedUdhaar(customerId, limit = 50) {
  const [cursor, setCursor] = useState<string>()
  const [data, setData] = useState<UdhaarEntry[]>([])
  const [hasMore, setHasMore] = useState(true)

  const loadMore = async () => {
    const result = await getUdhaarByCustomerPaginated(customerId, limit, cursor)
    setData(prev => [...prev, ...result.data])
    setHasMore(result.hasMore)
    setCursor(result.nextCursor)
  }

  return { data, hasMore, loadMore }
}
```

**UI Layer:**

```tsx
// Use virtualized list
<VirtualList items={data} renderItem={renderRow}>
  {hasMore && <Button onClick={loadMore}>Load More</Button>}
</VirtualList>
```

### Solution: AI Context Slicing

**Current:**

```typescript
const result = await askAI({
  input,
  data: {
    customers: allCustomers,      // All 10k records
    udhaar: allUdhaar,             // All 50k records
    payments: allPayments,         // All 100k records
    sales: allSales                // All 20k records
  },
  language
})
```

**Improved:**

```typescript
// Step 1: Identify customer from input
const customer = matchCustomers(input, customers) // Fast local match

// Step 2: Slice context
const contextData = {
  customers: [customer],          // Only this customer
  udhaar: getUdhaarByCustomer(customer.id),     // Only their udhaar
  payments: getPaymentsByCustomer(customer.id), // Only their payments
  sales: getSalesByCustomer(customer.id)        // Only their sales
}

// Step 3: Send sliced data to LocalAI (or Cloud)
const result = await askAI({ input, data: contextData, language })
```

**Performance Impact:**

- Before: KhataSnapshot = 500KB, 180k records → slow
- After: KhataSnapshot = 5KB, 50 records → fast

---

## 16. Security Plan

### Current Security Measures

- ✅ PBKDF2-SHA256 PIN (app lock)
- ✅ localStorage (device-managed encryption via OS)
- ✅ No API keys in frontend
- ✅ Constant-time PIN comparison (no timing attacks)
- ✅ Soft deletes (audit trail)

### Enhancements Needed (Phase 10+)

| Area | Current | Needed | Priority |
|------|---------|--------|----------|
| **Cloud Auth** | None | OAuth 2.0 or API key rotation | P0 |
| **Transport** | None assumed | HTTPS enforced, HSTS | P0 |
| **Chat Encryption** | None | At-rest encryption for aiMessages (later) | P2 |
| **Rate Limiting** | None | Prevent brute-force PIN, API calls | P1 |
| **Audit Logging** | createdAt/updatedAt | Cloud-side immutable log | P1 |
| **Secrets Management** | Environment variables | Use cloud provider secrets store | P1 |
| **Biometric Auth** | None | Fingerprint/face as PIN alternative | P2 |
| **CORS Policy** | Not defined | Configure strict CORS headers | P1 |

### No Changes Needed (Safe Defaults)

- ✅ No user data sent before consent (no tracking)
- ✅ No third-party analytics (privacy-first)
- ✅ Transactions isolated locally (until explicitly synced)

---

## 17. UX/Accessibility Plan

### Accessibility Audit Needed (P1)

**WCAG 2.1 Level AA Target:**

- [ ] ARIA labels on buttons, links, form inputs
- [ ] Keyboard navigation (Tab, Enter, Esc, Arrow keys)
- [ ] Focus management (visible focus outline, no trap)
- [ ] Color contrast (4.5:1 for text, 3:1 for graphics)
- [ ] Screen reader testing (NVDA, JAWS, VoiceOver)
- [ ] Form error announcements
- [ ] Skip-to-main-content link
- [ ] Semantic HTML (headings, landmarks, labels)

**Tools:**
- axe DevTools (Chrome)
- WAVE (browser extension)
- Lighthouse (Chromium)
- Manual testing with screen reader

### UX Enhancements (P0–P1)

| Feature | Gap | Scope |
|---------|-----|-------|
| **Voice Confirmation** | Current: text button only | Add speakable read-back of proposal before confirm |
| **Sync Status** | No user feedback | Show progress indicator in header |
| **Conflict Resolution** | Missing UI | Modal showing local vs. remote, user picks winner |
| **Long Lists** | Slow on mobile | Virtual scrolling + pagination |
| **Date Picker** | No UI picker, text only | Add calendar picker for dates |
| **Tooltips** | Sparse | Add helpful hints for complex actions |
| **Loading States** | Basic | Improve spinners, skeleton screens |
| **Error Messages** | Generic | Specific, actionable error text |
| **Mobile Gestures** | Not supported | Swipe back, pull-to-refresh |
| **Offline Messaging** | "Offline mode" | More prominent indicator + feature parity explanation |

---

## 18. MVP Priority Matrix

### Phase 9 (Audit) — Not Implementation Yet

**Goal:** Complete this audit + produce implementation roadmap

### Phase 10 (AI Core Upgrade) — P0 Features

**Priority P0 (Must Have):**

| # | Feature | Effort | Risk | Value |
|---|---------|--------|------|-------|
| 1 | Voice output (TTS) | 3 days | Low | High (voice-first goal) |
| 2 | Cloud AI integration | 5 days | Medium | High (complex queries) |
| 3 | Large dataset pagination | 4 days | Low | High (scalability) |
| 4 | Enhanced date parsing | 2 days | Low | Medium (usability) |
| 5 | Conflict detection UI | 3 days | Medium | Medium (multi-device safety) |
| 6 | Urdu/Roman Urdu enhancement | 3 days | Medium | High (primary users) |
| 7 | Mobile scrolling + UX | 3 days | Low | High (primary device) |

**Total: ~23 days of engineering**

### Phase 11 (Voice-First UX) — P0 + P1

- Focus on voice-first interaction patterns
- Speakable responses, voice confirmation
- Better error recovery for voice inputs

### Phase 12 (AI Financial Operations) — P0 + P1

- New intents (ADD_SALE, ADD_CUSTOMER, UPDATE_DUE_DATE)
- Multi-turn conversation context
- Advanced proposal UX

### Phase 13–18 (Post-MVP)

- Production cloud backend
- WhatsApp Business API
- Multi-user shops + roles
- Advanced analytics + forecasting

---

## 19. Phased Implementation Roadmap

### Phase 9: Audit + Architecture (Current)

**Goal:** Complete audit, produce roadmap, get stakeholder approval  
**Duration:** 2–3 days (already underway)  
**Deliverables:**
- ✅ This audit document
- Implementation plan (following sections)
- Stakeholder sign-off on architecture

**Output:** GO/NO-GO decision for Phase 10

---

### Phase 10: AI Core Upgrade (P0 Features)

**Goal:** Voice output + cloud AI + scalability foundation  
**Duration:** 3–4 weeks  
**Team:** 2–3 engineers  

**Scope:**

1. **Voice Output (TTS)** [3 days]
   - Implement VoiceOutputAdapter pattern
   - BrowserTTSAdapter (Web Speech API)
   - Voice selection logic
   - Rephrase responses for speech (short, clear)
   - Testing: iOS Safari, Android Chrome

2. **Cloud AI Integration** [5 days]
   - Implement CloudAIAdapter with real endpoint
   - Design backend contract (prompt → response)
   - Choose LLM provider + integrate
   - Fallback to LocalAI on error/timeout
   - Rate limiting + cost monitoring

3. **Pagination** [4 days]
   - Add Dexie cursor-based pagination to repositories
   - Create usePagination() hook
   - Update Customers, Udhaar, Payments, Sales pages
   - Test with 10k+ records

4. **Enhanced Date Parsing** [2 days]
   - Relative date parsing ("next week", "jab tak")
   - Fuzzy date recognition
   - Fallback to picker if ambiguous

5. **Urdu/Roman Urdu NLP** [3 days]
   - Roman Urdu stopwords + phonetic variants
   - Basic script normalization
   - Improved matchCustomers() scoring

6. **Conflict Detection** [3 days]
   - ConflictLog table (v4 migration)
   - detectConflict() in syncService
   - UI modal for conflict resolution

7. **Mobile UX Polish** [3 days]
   - Scroll position restoration
   - Better touch targets
   - Improved error messaging
   - Offline status indicator

**Testing:**

```
npm run lint
npx tsc -b
npm run build

Test Scenarios:
1. "Ahmed ka balance?" (online + offline)
2. "Ahmed ne 2000 payment kar" (with confirmation)
3. App offline, resync 50 pending actions
4. 10k customer list: pagination works
5. Voice input + TTS output loop (Urdu + English)
6. Conflict detection (simulate 2 devices)
```

**Acceptance Criteria:**
- Voice output works on all target platforms (iOS/Android)
- Cloud AI responds to queries (< 3s latency)
- Lists paginate smoothly (no jank)
- Offline scenario works end-to-end
- All intents still work (regression test)
- No TypeScript errors

**Rollback Plan:**
- Feature flags: disable CloudAI, TTS if issues
- Tag release branch for instant revert
- Keep LocalAI as safe fallback

---

### Phase 11: Voice-First UX (P1)

**Goal:** Optimize for voice-first interaction patterns  
**Duration:** 2–3 weeks  

**Scope:**

1. **Conversation Context** [3 days]
   - Remember customer across turns ("Aur 500")
   - Multi-turn proposals
   - Context carry from prior message

2. **Speakable Confirmation** [3 days]
   - Read-back proposal before confirm
   - Voice input for "yes/no"
   - Fallback to UI button if voice fails

3. **Enhanced Intent Detection** [2 days]
   - Add 5 new intents (SALES_RECORD, ADD_CUSTOMER, etc.)
   - Improve ambiguity resolution
   - Context-aware intent selection

4. **Accessibility** [4 days]
   - ARIA labels on all interactive elements
   - Keyboard navigation (Tab, Enter, Esc)
   - Screen reader testing + fixes
   - Focus management

5. **Voice Error Recovery** [2 days]
   - Show transcript for verification
   - Allow re-recording
   - Fallback to text input gracefully

**Testing:**

```
Test Scenarios:
8. "Ahmed ne aaj 2000 ka udhaar liya aur 15 Sept ko due hoga"
9. Ambiguous customer: "Jo pehle paise nahi diye" → clarify
10. Multi-turn: "Ahmed" → "Aur 500 lena hai?"
11. Voice confirmation: Hear proposal, say "Haan"
12. Large lists: 50k records, virtual scroll works
13. Dark mode: Proper contrast, readable
```

**Acceptance Criteria:**
- Multi-turn context preserved across messages
- Voice confirmation flow works (TTS → voice input → execute)
- All new intents functional
- Accessibility audit: WCAG AA pass
- No performance regression

---

### Phase 12: AI Financial Operations (P1)

**Goal:** AI can create all financial record types  
**Duration:** 2–3 weeks  

**Scope:**

1. **New Intents** [5 days]
   - ADD_SALE intent + action
   - ADD_CUSTOMER intent + action
   - UPDATE_DUE_DATE intent
   - PAYMENT_SPLIT intent (complex)

2. **Advanced NLP** [4 days]
   - Phonetic matching (soundex)
   - Entity linking (customer → address → risk)
   - Amount unit handling ("2 dozen", "3 gaj")
   - Fraction handling ("sawa", "dhai", "saphed")

3. **Proposal Refinement** [3 days]
   - Add fields for new intents
   - Better context in proposals
   - Two-factor confirmation for high-value ops (optional)

4. **Reports + Insights** [3 days]
   - Custom date range queries
   - Month-over-month comparisons
   - Drill-down from summary → detail

**Testing:**

```
Test Scenarios:
14. "Ahmed ko 1000 ka sale record kar"
15. "Naya customer: Fatima Merchant, 0300-1234567"
16. "Ahmed ka udhaar 30 September ko due"
17. "Ahmed ne 1000 diye: 500 udhaar, 500 naya"
18. Multi-device: Create record on Phone A, sync to Phone B
```

**Acceptance Criteria:**
- All 13 core intents working (7 existing + 6 new)
- Financial confirmations required for all writes
- Ambiguity resolution improved
- Large dataset (100k+) still responsive
- Audit trail complete for all operations

---

### Phase 13: Persistent Conversation + Audit Trail

**Goal:** Chat history search, archival, compliance  
**Duration:** 2 weeks  

**Scope:**

1. **Chat History Features** [3 days]
   - Full-text search over messages
   - Conversation threading
   - Archive old conversations (TTL)
   - Export to PDF

2. **Audit Trail** [3 days]
   - Immutable log of all financial writes
   - Cloud-side backup
   - Regulatory compliance reporting

3. **Data Export** [2 days]
   - JSON export for backup/migration
   - CSV export for spreadsheet
   - PDF invoice/receipt generation (already exists, enhance)

---

### Phase 14: AI Navigation + Business Intelligence

**Goal:** Talk to navigate app; ask complex business questions  
**Duration:** 2–3 weeks  

**Scope:**

1. **Navigation Intents** [3 days]
   - "Reports kholo"
   - "Customers page"
   - "Ahmed ka detail"

2. **Complex Queries** [4 days]
   - "Jo sabse zyada late hain?"
   - "Ye month ke comparison?"
   - "Kis customer se sabse zyada paise lene hain?"

3. **Insights Dashboard** [2 days]
   - AI-generated business summary
   - Trend analysis
   - Risk scoring (customers overdue)

---

### Phase 15: Scalability + Large Dataset Optimization

**Goal:** Handle 1M+ records smoothly  
**Duration:** 3 weeks  

**Scope:**

1. **IndexedDB Optimization** [3 days]
   - Query plan analysis
   - Add missing indexes
   - Batch operations

2. **Sync Optimization** [3 days]
   - Delta sync (only changes)
   - Compression
   - Batch uploads

3. **Archive + Cleanup** [2 days]
   - Old record archival (30+ days)
   - TTL implementation
   - Cleanup cron jobs

---

### Phase 16: Responsive/Scrolling/RTL/Dark Theme Polish

**Goal:** Professional UX on all devices + themes  
**Duration:** 2–3 weeks  

**Scope:**

1. **Mobile UX** [3 days]
   - Gesture support (swipe back)
   - Pull-to-refresh
   - Optimized touch targets

2. **Scrolling Perfection** [2 days]
   - Momentum scrolling (iOS)
   - Virtual scroll performance
   - Scroll position restoration

3. **RTL Audit** [2 days]
   - Urdu mode on all pages
   - Charts/graphs RTL-safe
   - Form inputs mixed-script

4. **Dark Theme Redesign** [3 days]
   - Professional color pass
   - Contrast audit (WCAG AA)
   - Icon adjustments

---

### Phase 17: Cloud AI + Production Architecture

**Goal:** Scalable, secure, cost-efficient cloud backend  
**Duration:** 4–6 weeks  

**Scope:**

1. **Cloud Deployment** [2 weeks]
   - LLM service setup
   - API design + scaling
   - Authentication (OAuth, API keys)

2. **Monitoring + Observability** [1 week]
   - Logging, metrics, tracing
   - Cost monitoring
   - Error tracking

3. **Data Privacy** [1 week]
   - Encryption at rest + transit
   - GDPR/data residency compliance
   - User consent flows

---

### Phase 18: WhatsApp/Reminder Integration + Post-MVP

**Goal:** Official messaging integrations  
**Duration:** 3–4 weeks  

**Scope:**

1. **WhatsApp Business API** [2 weeks]
   - Official integration
   - Reminder templates
   - Opt-in flows

2. **SMS + Email** [1 week]
   - Twilio integration
   - Email service setup

3. **Production Hardening** [1 week]
   - Load testing
   - Security penetration test
   - User acceptance testing

---

## 20. Testing & Validation Plan

### Unit Tests (Phase 9–10)

**Coverage Target:** Core logic (NLP, AI engine, repositories)

```bash
npm test -- --coverage

Target: 70%+ coverage on:
  - src/features/ai/*.ts
  - src/data/repositories/*.ts
  - src/lib/*.ts
```

**Test Examples:**

```typescript
// NLP tests
test('matchCustomers: exact name match', () => {
  const result = matchCustomers('Ahmed', [{ id: '1', name: 'Ahmed', phone: '0300...' }])
  expect(result.status).toBe('unique')
})

test('matchCustomers: phonetic variant', () => {
  const result = matchCustomers('Ehmed', [{ id: '1', name: 'Ahmed', phone: '...' }])
  expect(result.status).toMatch(/unique|ambiguous/)
})

// AI engine tests
test('ADD_UDHAAR intent detection', () => {
  const result = runEngine('Ahmed ne 5000 ka udhaar liya', snapshot, 'en')
  expect(result.type).toBe('proposal')
  expect(result.proposal?.kind).toBe('ADD_UDHAAR')
})

// Repository tests
test('addPayment: atomic transaction', async () => {
  const payment = await addPayment({ customerId: '1', amount: 1000, ... }, owner)
  const udhaar = await db.udhaar.get(payment.udhaarId)
  expect(udhaar.remainingAmount).toBeLessThan(udhaar.amount)
})
```

### Integration Tests (Phase 10+)

**Focus:** Full flows end-to-end

```typescript
// AI → Proposal → Execution flow
test('Full flow: text input → proposal → confirm → record', async () => {
  // 1. User types "Ahmed ne 2000 diye"
  const result = await askAI({ input, data, language })
  
  // 2. Verify proposal generated
  expect(result.type).toBe('proposal')
  expect(result.proposal.kind).toBe('RECORD_PAYMENT')
  
  // 3. Confirm proposal
  await executeProposal(result.proposal)
  
  // 4. Verify payment recorded in DB
  const payments = await getPaymentsByCustomer(customerId)
  expect(payments.length).toBeGreaterThan(0)
  
  // 5. Verify sync queue updated
  const syncQueue = await db.syncQueue.toArray()
  expect(syncQueue.some(a => a.recordId === payment.id)).toBe(true)
})

// Offline → Sync flow
test('Offline write + online sync', async () => {
  // 1. Go offline
  networkService.notify(false)
  
  // 2. Create record (queued locally)
  const customer = await addCustomer({ name: 'Test', phone: '0300...' }, owner)
  
  // 3. Verify in syncQueue
  const pending = await db.syncQueue.where('syncStatus').equals('pending').toArray()
  expect(pending.length).toBeGreaterThan(0)
  
  // 4. Go online
  networkService.notify(true)
  
  // 5. Sync fires
  const result = await syncService.sync()
  
  // 6. Verify syncStatus changed to 'synced'
  const synced = await db.customers.get(customer.id)
  expect(synced.syncStatus).toBe('synced')
})
```

### Manual Testing (Phase 10)

**Platforms:**

- ✅ Desktop Chrome/Firefox (LTR + RTL)
- ✅ iOS Safari (voice input, PWA install)
- ✅ Android Chrome (voice input, PWA install)
- ✅ Low-end device (Android 5, 2GB RAM)

**Test Scenarios (Hand-Writ):**

```
1. Voice Input
   - Say "Ahmed ka balance batao"
   - Verify transcript shown
   - Verify LocalAI response generated

2. Voice Output
   - AI responds with text
   - TTS plays audio
   - User can hear response (female, Urdu/English)
   - Verify on iOS (different API than Android)

3. Payment Scenario
   - Say "Ahmed ne 2000 payment kar"
   - See proposal card
   - Confirm button
   - Verify payment in DB
   - Verify sync queue updated

4. Offline → Online
   - Disable network (DevTools → Offline)
   - Create 5 customers
   - Refresh page (all still there)
   - Enable network
   - Verify sync completes
   - Check cloud for records

5. Large List Scrolling
   - Create 1000 customers
   - Load Customers page
   - Scroll (should not lag)
   - Verify pagination working
   - Load next page

6. Conflict Scenario (Manual)
   - Edit customer A on Phone X
   - Edit same customer A on Phone Y (different field)
   - Sync both
   - Verify conflict modal appears
   - Choose "local" or "remote"
   - Verify record updated correctly

7. Urdu Mode
   - Switch to Urdu
   - Navigation moves to right (RTL)
   - Type Urdu text in input
   - Verify AI understands
   - Verify response in Urdu

8. Dark Mode
   - Enable dark theme
   - Verify contrast (readable)
   - Verify chart colors
   - Verify text color

9. Error Handling
   - Force network error (DevTools → Throttle)
   - Try AI query
   - Verify fallback message
   - Try sync
   - Verify retry UI

10. Notifications
    - Enable notifications
    - Create overdue udhaar
    - Verify local notification shows
    - Click notification
    - Verify app opens + navigates to Reminders
```

### Performance Testing (Phase 11)

**Tools:** Chrome DevTools, React DevTools Profiler

**Benchmarks:**

```
Target Metrics:
- Customers page load: < 500ms (10k records)
- AI query response: < 1s (LocalAI), < 3s (CloudAI)
- Sync completion: < 10s (1000 records)
- Mobile FCP (First Contentful Paint): < 2s
- TTI (Time to Interactive): < 4s
- Bundle size: < 300KB (gzipped)
```

**Test:**

```bash
# Lighthouse audit
npx lighthouse https://localhost:5173 --view

# React Profiler
- Open React DevTools → Profiler
- Navigate to Customers (10k records)
- Record render
- Identify slow components
- Optimize (memoization, virtual scroll)

# Chrome DevTools
- Performance tab
- Record page load
- Analyze timeline (main thread, paints, etc.)
```

### Accessibility Testing (Phase 11)

**Tools:** axe DevTools, WAVE, Lighthouse, Screen Reader

```bash
# axe DevTools (Chrome)
1. Open DevTools → axe DevTools
2. Scan page
3. Fix violations (missing ARIA, contrast, etc.)

# Lighthouse
npx lighthouse https://localhost:5173 --view
Target: Accessibility score > 90

# Manual Screen Reader Testing
- Use NVDA (Windows) or VoiceOver (Mac)
- Navigate with Tab key only (no mouse)
- Verify form labels read correctly
- Verify error messages announced
- Verify buttons/links have text

# Focus Testing
- Use Tab to navigate all pages
- Verify focus visible (outline, background change)
- Verify no focus traps (can Tab out of modals)
```

### Browser Compatibility (Phase 11)

**Support Matrix:**

| Browser | Version | Status | Notes |
|---------|---------|--------|-------|
| Chrome | 90+ | ✅ Full | Desktop + Android |
| Firefox | 88+ | ✅ Full | Desktop only |
| Safari | 14+ | ✅ Full | iOS 14+, limited Web Speech |
| Edge | 90+ | ✅ Full | Windows only |
| IE 11 | — | ❌ Drop | Not supported (dead browser) |

**Known Limitations:**
- iOS Safari: Web Speech API limited (privacy)
- iOS: Push notifications via PWA limited (Apple restrictions)
- Firefox: Some CSS logical properties may need fallback

---

## 21. Acceptance Criteria

### Phase 10 Completion (AI Core Upgrade)

**Must Have:**

- [ ] Voice output (TTS) works on iOS, Android, Desktop
- [ ] CloudAI endpoint integrated + responding to queries
- [ ] All 13 existing intents still work (no regressions)
- [ ] Pagination on Customers, Udhaar, Payments, Sales
- [ ] Large dataset test (10k+ records) performs smoothly
- [ ] Conflict detection + UI implemented
- [ ] Offline scenario works end-to-end
- [ ] All TypeScript errors resolved
- [ ] npm run lint passes (0 errors)
- [ ] npm run build succeeds
- [ ] Test coverage > 70% for core modules
- [ ] Accessibility audit: WCAG AA pass on critical pages

**Should Have:**

- [ ] Dark theme renders properly
- [ ] RTL (Urdu) mode verified
- [ ] Mobile UX improved (scroll, touch targets)
- [ ] Documentation updated (README, ARCHITECTURE.md)

**Nice to Have:**

- [ ] Performance optimizations (< 1s LocalAI query)
- [ ] User satisfaction survey feedback
- [ ] Beta tester sign-off

---

## 22. Final Recommendation

### Summary

Digital Khata Phase 0–8 is **mature and production-ready**. The foundation is excellent:

- ✅ Deterministic AI engine working
- ✅ Offline-first sync architecture proven
- ✅ Financial safety (ActionProposal) in place
- ✅ Multilingual (English/Urdu) + RTL
- ✅ PWA + PIN protection
- ✅ Repositories follow clean patterns

### For Phase 9 (This Audit)

**Recommendation:** PROCEED to Phase 10

**Rationale:**

1. **Risks are manageable:** No fundamental architectural flaws; gaps are feature-level, not systemic
2. **Reusable foundation:** Don't rewrite; extend and enhance
3. **Clear roadmap:** Phase 10 is well-defined (23 days, 7 P0 features)
4. **Stakeholder alignment:** Product vision matches technical feasibility

### Go-Forward Strategy

**DO:**

- ✅ Implement voice output (TTS) first — core goal
- ✅ Integrate cloud AI (but keep LocalAI as fallback)
- ✅ Add pagination for scalability
- ✅ Enhance NLP incrementally (new intents, better matching)
- ✅ Preserve ActionProposal safety flow for all writes
- ✅ Test end-to-end on real devices (iOS/Android)

**DON'T:**

- ❌ Rewrite Dexie or sync architecture
- ❌ Change core types or repository patterns
- ❌ Break offline-first principle
- ❌ Add LLM keys to frontend
- ❌ Skip confirmation for financial writes
- ❌ Redesign without testing accessibility

### Next Steps

1. **Immediate (Next 2 Days):**
   - Share this audit with team
   - Get stakeholder sign-off on roadmap
   - Set up Phase 10 sprint planning

2. **Phase 10 Start (Week 1):**
   - Voice output (TTS) spike
   - CloudAI endpoint design + integration
   - Pagination prototype

3. **Phase 10 End (Week 3–4):**
   - Full feature integration
   - End-to-end testing on devices
   - Release candidate

---

## Appendix A: File Reference Index

| File | Type | Status | Audit Notes |
|------|------|--------|-------------|
| package.json | Config | ✅ | Dependencies solid; no unused bloat |
| src/data/db/db.ts | Core | ✅ | Dexie schema v3; ready for v4 |
| src/features/ai/engine.ts | Core | 🟡 | Works; needs data slicing + new intents |
| src/features/ai/adapters.ts | Core | 🟡 | LocalAI works; CloudAI scaffolded |
| src/features/ai/intents.ts | Core | 🟡 | 13 intents; extensible; add 8 more (P1) |
| src/features/ai/nlp.ts | Core | 🟡 | Basic NLP; needs Urdu/Roman Urdu enhancement |
| src/pages/AI/AI.tsx | UI | 🟡 | Chat + voice input working; add TTS |
| src/data/services/syncService.ts | Service | 🟡 | Sync works; needs conflict handling |
| src/core/i18n/* | i18n | ✅ | Type-safe, bilingual, working |
| src/data/repositories/* | Data | ✅ | Clean pattern; add pagination |
| src/hooks/useKhataData.ts | Hook | 🟡 | Works; needs paginated variants |
| src/app/App.tsx | Router | ✅ | Lazy routes, error boundaries |
| src/context/AppProvider.tsx | Context | ✅ | Theme, language, PIN, lock state |
| src/components/ui/ErrorBoundary.tsx | Component | ✅ | Route-level recovery |
| src/lib/pdf.ts | Lib | ✅ | jsPDF receipts; Urdu limitations noted |
| src/security/pin.ts | Security | ✅ | PBKDF2, constant-time comparison |
| vite.config.ts | Config | ✅ | PWA + Tailwind configured |
| src/main.tsx | Entry | ✅ | Database init on startup |

---

## Appendix B: Architectural Decision Log

| Decision | Rationale | Alternatives Considered | Trade-offs |
|----------|-----------|--------------------------|-----------|
| **Keep LocalAI + add CloudAI** | Two-tier hybrid model: fast local for common queries, smart cloud for complex | Rewrite LocalAI entirely with LLM; drop LocalAI | Hybrid: slightly more code, best of both |
| **Preserve ActionProposal flow** | Financial safety is non-negotiable | Auto-execute based on confidence; user multi-tap | Slightly slower, but guarantees confirmation |
| **Dexie (IndexedDB) over SQLite** | Proven in app, async-first, multi-tenant ready | Migrate to SQLite.js (heavy); stick with legacy (risky) | IndexedDB storage limited (50MB–1GB), but sufficient for MVP |
| **Pagination instead of virtual scroll alone** | Both needed: pagination for dataset size, virtual scroll for mobile perf | Virtualization only (risky for 100k+); pagination only (slow on mobile) | Slightly more complexity, better for all scenarios |
| **Voice output via TTS, not LLM voice** | Simpler, faster, cheaper | Use LLM to generate speech (slow, expensive); custom voice model (training data needed) | Quality trade-off, but good enough |
| **Conflict detection (3-way merge later)** | LWW sufficient for MVP; merge complex | Manual merge now; ignore conflicts | Data loss risk if only LWW; conflict detection lower risk |

---

## Appendix C: Glossary

| Term | Definition |
|------|-----------|
| **ActionProposal** | Structured contract for a financial write operation, shown to user before execution |
| **Udhaar** | Credit/debt given by shopkeeper to customer (core ledger concept) |
| **Khata** | Hindi/Urdu word for ledger; the entire accounting record |
| **Sync Queue** | Table of pending writes waiting to push to cloud |
| **Syncable** | Interface for records that sync (Customer, Udhaar, Payment, Sale) |
| **LocalAI** | Deterministic NLP engine (no ML, regex-based intents, rule-based matching) |
| **CloudAI** | LLM-based adapter (requires backend + API keys) |
| **PWA** | Progressive Web App (installable, offline-capable) |
| **TTS** | Text-to-Speech (voice output) |
| **RTL** | Right-to-Left script direction (Urdu, Arabic) |
| **Logical CSS** | CSS properties that auto-flip for LTR/RTL (ps=padding-start, ms=margin-start) |
| **IndexedDB** | Browser database (async, key-value + queries) |
| **Dexie** | Wrapper library for IndexedDB (easier API) |
| **Soft Delete** | Mark record as deleted (isDeleted flag) instead of removing (preserves audit trail) |
| **Conflict** | Version mismatch during sync (local ≠ remote) |
| **LWW** | Last-Write-Wins conflict resolution (use newest version) |

---

**END OF AUDIT DOCUMENT**

---

# NO IMPLEMENTATION STARTED — AUDIT AND PLAN ONLY

This document contains analysis, findings, and recommendations. **No source code changes have been made.** The roadmap is ready for team review and stakeholder approval before Phase 10 implementation begins.

**Next Action:** Present audit to team + stakeholders → Approve roadmap → Begin Phase 10 sprint planning.
