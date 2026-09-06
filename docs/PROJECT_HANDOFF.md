# Digital Khata — Project Handoff

**Status:** Phases 0–8 complete, verified, and frozen (2026-08-29).
**Purpose of this document:** enable a new developer (human or AI assistant) to continue safely without reverse-engineering the codebase.

Read `docs/PRODUCT_VISION.md` for the future direction. **Do not start new feature phases without the owner's explicit approval.**

---

## A. Current Architecture

Offline-first single-page PWA. All writes go to IndexedDB first; sync is a queue-based afterthought behind a replaceable provider interface.

```
UI (React 19 + Tailwind v4, src/pages)
  │
  ├─ reads  → dexie-react-hooks useLiveQuery (src/hooks/useKhataData.ts)
  ├─ writes → repositories (src/data/repositories/*) — every write is a Dexie
  │            transaction that also enqueues a SyncAction
  │
  ├─ syncService (src/data/services/syncService.ts)
  │     push pending SyncActions → CloudProvider → pull remote changes
  │
  └─ CloudProvider interface (src/data/cloud/CloudProvider.ts)
        only implementation: RestCloudProvider scaffold (no real backend yet)
```

Key invariant: **IndexedDB is the source of truth.** The app is fully functional with the cloud absent, misconfigured, or unreachable.

### Tech stack
React 19 · TypeScript · Vite 8 · Tailwind v4 (CSS-first `@theme` in `src/index.css`) · React Router v7 · Dexie 4 (+ dexie-react-hooks) · vite-plugin-pwa (generateSW) · jsPDF 4 (lazy-loaded)

### Source layout
```
src/
  app/            App.tsx (routes+lock gate), layout/ (AppLayout, Header, navs, FAB)
  core/           types, config (nav/theme/constants), i18n (en/ur + RTL)
  data/           db (Dexie schema, migrations, seed), repositories, services
                  (sync, network, notifications), cloud (provider interface)
  features/       ai (rule engine, intents, nlp, adapters, responses, insights),
                  lock (LockScreen)
  pages/          one folder per route (11 pages)
  components/ui/  Button, Card, Sheet, ConfirmCard, EmptyState, PageLoader,
                  ErrorBoundary, PinPad, StatCard, LanguageSwitcher
  hooks/          useKhataData (live queries), useApp, useSync, useNetwork,
                  useOwner, useDueUdhaarNotifications, useCountUp
  lib/            utils (cn, formatCurrency, localDateKey, generateId…), pdf
  security/       pin.ts (PBKDF2 hash/verify)
```

---

## B. Phase 0–8 Implementation History

| Phase | Delivered |
|---|---|
| 0 | Folder structure, Tailwind v4 tokens, lint/build clean |
| 1 | Dexie schema, repositories, derived balances, seed data, localStorage→IndexedDB migration |
| 2 | CloudProvider interface, RestCloudProvider scaffold, syncService (push/pull/conflict), networkService, sync status indicator |
| 3 | Responsive shell: bottom nav (mobile), sidebar (desktop), FAB, Header, i18n EN/UR + RTL |
| 4 | Dashboard, Customers (+detail), Udhaar, Payments, Sales pages with live reactivity |
| 5 | Reports (periods, charts), Reminders (overdue/upcoming), notifications |
| 6 | Khata AI: rule engine, Roman Urdu + English intents, fuzzy name matching, ActionProposal + ConfirmCard, voice input (Web Speech API), local chat history |
| 7 | PIN lock (PBKDF2), PDF receipts (jsPDF, 80mm thermal style), PWA (manifest, icons, SW, offline) |
| 8 | Code splitting (924→359 kB main chunk), per-route ErrorBoundary, loading-state disambiguation, a11y passes (Sheet focus/Escape, aria), UTC+5 date bug fix app-wide, sync retry-backoff fixes, true-offline detection fix, RTL logical properties, dead code removal |

Owner-approved decisions: teal/gold brand; English-only PDF receipts (no Urdu font embed); 5-attempt/30s-cooldown PIN policy; provider-agnostic CloudAIAdapter (env-configured, no keys in frontend).

---

## C. Routes / Pages

All routes are lazy-loaded in `src/app/App.tsx`; the lock gate wraps the entire router.

| Path | Page | Notes |
|---|---|---|
| `/dashboard` | Dashboard | Stats, recent activity, AI insight card, overdue banner |
| `/customers` | Customers | Search, add (Sheet via `?add=true`), balance chips |
| `/customers/:id` | CustomerDetail | History, per-customer udhaar/payments/sales |
| `/udhaar` | Udhaar | Status chips (Pending/Partial/Paid/Overdue), payment button, receipt |
| `/payments` | Payments | Record payment, method select, receipt |
| `/sales` | Sales | Add sale, customer link |
| `/ai` | Khata AI | Chat, voice input, ConfirmCards, history |
| `/reports` | Reports | Today/week/month, sales trend, per-customer |
| `/reminders` | Reminders | Overdue + upcoming, WhatsApp/Web Share (user-initiated only) |
| `/notifications` | Notifications | Local notification log + permission management |
| `/settings` | Settings | PIN management, theme, language, data info |

Modal pattern: pages read `?add=true` / `?udhaar=<id>` search params and render a `Sheet`; the global FAB navigates to these URLs. This makes add-flows deep-linkable.

---

## D. Data Model & Dexie Schema

`src/core/types/index.ts` — every syncable record extends `Syncable`:
`id (uuid), userId, shopId, createdAt, updatedAt (ISO), syncStatus ('synced'|'pending'|'conflict'|'error'), version (int), isDeleted? (soft delete)`

Entities: `Customer` (name, phone, address?), `UdhaarEntry` (customerId, description, amount, paidAmount, remainingAmount, dueDate?), `Payment` (customerId, udhaarId?, amount, method, date), `Sale` (customerId?, amount, description, date), `SyncAction` (queue rows), `AIMessage` (chat history, deliberately non-syncable).

Schema (`src/data/db/db.ts`, Dexie versions 1–3):
- `customers: id, name, phone, shopId, syncStatus`
- `udhaar: id, customerId, dueDate, remainingAmount, syncStatus`
- `payments: id, customerId, udhaarId, date, syncStatus`
- `sales: id, customerId, date, syncStatus`
- `syncQueue: id, table, recordId, createdAt, attempts`
- `aiMessages: id, userId, shopId, [userId+shopId], createdAt` (compound index added v3)

**Balances are always derived** — never stored per-customer. `remainingAmount` lives on each udhaar row; a customer's balance = Σ remainingAmount of their entries. `paidAmount + remainingAmount` is maintained transactionally in `paymentRepo` (payments linked to an udhaar adjust it; overpayment clamps remaining to 0).

⚠ **Pakistan timezone rule:** never compute "today" with `toISOString().split('T')[0]` (rolls to tomorrow after 7pm in UTC+5). Always use `localDateKey()` from `src/lib/utils.ts`.

---

## E. Repository Pattern

`src/data/repositories/` — one file per entity. Every write:
1. builds the record with sync fields (`syncStatus: 'pending'`, `version + 1`),
2. writes inside a Dexie `rw` transaction (paymentRepo also adjusts the linked udhaar row),
3. enqueues a `SyncAction` with the full payload.

Reads for the UI go through `useLiveQuery` hooks (`src/hooks/useKhataData.ts`), NOT the repo read functions — the hooks return `undefined` while loading (so pages distinguish loading from empty) and re-render automatically on any table change.

Known duplication (accepted): several repo read functions (`searchCustomers`, `getOverdueUdhaar`, `getOutstandingUdhaar`, `get*ById`, `update*`) are currently unused by pages. They are correct API surface for future server/AI code — do not delete blindly, but do not add new duplicate read paths either.

---

## F. Sync Architecture

`src/data/services/syncService.ts` (singleton):
- Triggers: app start, browser `online` event, manual retry (Header button).
- Push: reads `syncQueue` ordered by `createdAt`, hands to provider, marks success (delete action + flip record `syncStatus` to `synced`) or failure (increment `attempts`, store error, schedule retry with escalating backoff 1s→2s→5s→10s→30s cap).
- Pull: `provider.pull(since)` → apply with pending-local-preservation; last-write-wins by `updatedAt`; local-newer marks `syncStatus: 'conflict'` (no conflict UI yet).
- Idempotency: action/record ids are UUIDs; provider contract is to ignore duplicates.

`networkService.ts`: `navigator.onLine` + events + a 30s heartbeat to an uncached URL (`/__network-ping__`) that the service worker does NOT intercept — this is what makes true offline (server down, SW serving from cache) detectable. The heartbeat URL must never be precached/routed by the SW.

`RestCloudProvider` is a scaffold: without `VITE_API_BASE_URL` it returns a clear error and all actions stay queued — this is the expected state today. **No real cloud provider exists yet by design.**

---

## G. AI Architecture

`src/features/ai/` — deterministic, local, rule-based:

- `intents.ts` — regex classifier (English + Roman Urdu): RECORD_PAYMENT, ADD_UDHAAR, DELETE_*, SEND_REMINDER, queries (balance/top-debtors/sales/overdue/history/insight/totals).
- `nlp.ts` — normalization, stopword-filtered fuzzy customer matching (unique/ambiguous/none), amount extraction (digits, commas, "do hazaar"/"panch lakh" word numbers), method/period detection.
- `engine.ts` — pure function `(input, snapshot, language) → AIResult`. **Every write intent returns `{type:'proposal', proposal}`; only queries compute answers.**
- `responses.ts` — all user-facing strings in EN + UR (no fabricated numbers; every amount comes from the snapshot).
- `adapters.ts` — `AIAdapter` interface. `LocalAIAdapter` (always). `CloudAIAdapter` (optional, `VITE_AI_ENDPOINT`, env-configured backend wrapper, **answers only — it can never emit proposals**). `askAI` = local first; cloud only on local fallback + online + configured; honest fallback message otherwise.
- Chat history: `aiMessages` table, local-only, per user+shop.

### ⚠ AI SAFETY RULES (non-negotiable)
1. **The AI never silently modifies financial records.** Action intents produce an `ActionProposal` rendered as a `ConfirmCard` (`src/components/ui/ConfirmCard.tsx`) with Cancel/Confirm. Only a user tap on Confirm calls the repository (`executeProposal` in `src/pages/AI/AI.tsx`).
2. Proposal state machine: `pending → executing → confirmed|cancelled`, persisted per message; reload cannot resurrect a confirmed card.
3. Never fabricate numbers — every amount in a response must come from the local snapshot.
4. Cloud adapter is answer-only. If that ever changes, the confirm-first rule still applies.
5. Reminder sending is user-initiated (WhatsApp `wa.me` link or Web Share) — no automated customer messaging.

---

## H. PIN / Security Architecture

`src/security/pin.ts` + `src/features/lock/LockScreen.tsx`:
- 4-digit local app-lock PIN. PBKDF2-SHA256, 150k iterations, random 16-byte salt, constant-time compare. Stored in localStorage as `dk-pin-hash`/`dk-pin-salt` (plaintext PIN never persisted).
- Lock gate in `App.tsx` (`isLocked ? <LockScreen/> : <Routes/>`), unlock flag per browser tab (sessionStorage `dk-unlocked`).
- 5 failed attempts → 30s cooldown; counter resets when cooldown triggers (fresh 5 attempts after expiry).
- **The PIN protects the local UI only. It is NOT cloud authentication and never establishes identity for sync.**

Security limitations (known, accepted): data in IndexedDB/localStorage is not encrypted at rest; a determined user on the device can read it. No CSP headers configured. No cloud auth at all yet.

---

## I. PWA / Offline Architecture

- `vite.config.ts`: VitePWA generateSW, `registerType: 'autoUpdate'`, manifest (name, theme `#0F766E`, 4 icons incl. maskable, `display: standalone`), workbox precaches all build assets (49 entries), `navigateFallback: index.html`, `importScripts: ['/sw-listeners.js']`.
- `src/main.tsx` registers the SW; `public/sw-listeners.js` handles `notificationclick` (focus/open app).
- Offline shell: the entire app loads from SW cache with no server. Verified by killing the server and reloading.
- Update flow: new build → waiting SW → `autoUpdate` activates on reload (dev prompt handled by vite-plugin-pwa).
- Do not precache the network-ping heartbeat URL (see §F).

---

## J. Notification Architecture

`src/data/services/notificationService.ts`: permission management + `showLocalNotification` via `registration.showNotification` (SW-first; page-level `new Notification` fallback). `useDueUdhaarNotifications` (AppLayout) fires once per day when overdue udhaar exists (dedup via `dk-reminder-notified-date`).

Local-only: notifications remind the shopkeeper; they never message customers. Real-device display testing is still pending (headless browsers deny permission).

---

## K. Current Limitations

1. No real cloud backend — sync queue accumulates with retries (correct behavior, by design).
2. No conflict-resolution UI (`syncStatus: 'conflict'` is set but not surfaced).
3. Single-user / single-shop hard-coded (`user-default`/`shop-default` via `useOwner`); multi-user scaffold exists in types/STORAGE_KEYS only.
4. PDF receipts are English-only (jsPDF can't shape Urdu without a large embedded font).
5. Voice input exists (Web Speech API); no voice output.
6. Local rule-based AI only (cloud adapter scaffold, no endpoint deployed).
7. Notifications untested on real devices.
8. Dark theme functions but was never visually redesigned (owner deferred).

---

## L. Known Technical Debt

- Form `<label>`s are visual only — not associated with inputs via `htmlFor`/`id` (screen readers rely on placeholders). Add associations when next touching forms.
- `Sheet` has Escape/focus-restore but no full Tab focus trap.
- Repo read functions partially unused (see §E) — read paths duplicated between repos and hooks by design, but keep them from drifting.
- No test suite, no CI. Verification is manual: lint + tsc + build + browser QA.
- `AppState`/`User`/`Shop` types in `core/types` are ahead of implementation (single-user app today).
- AI engine receives the full table snapshots (`KhataSnapshot`) — fine now, must become targeted queries at scale (see vision doc).
- Dexie `filter()` calls are full-table scans (isDeleted checks). Fine ≤ tens of thousands of rows; needs index-backed queries beyond that.

---

## M. Performance Status (as of handoff)

- Main bundle: **359 kB (116 kB gzip)** — down from 924 kB pre-Phase-8.
- jsPDF + html2canvas isolated in on-demand chunks (402 kB + 200 kB raw) fetched only when a receipt is generated.
- All 11 routes lazy-loaded (`React.lazy` + Suspense + PageLoader); route chunks 0.6–33 kB.
- CSS 46.5 kB (8.5 kB gzip). PWA precache 49 entries / ~1.36 MB.
- `aiMessages` compound index added (Dexie v3) for history queries.
- No virtualization on lists yet — lists render everything (fine at current scale; see scalability).

---

## N. Scalability Risks

1. **Full-table reads into React state**: every page loads all rows of its tables via `useLiveQuery`. At ~10k+ records per table this will jank. Fix direction: pagination/limit + Dexie `offset/limit` or `useLiveQuery` with where-clauses.
2. **AI snapshot**: `KhataSnapshot` ships whole tables to the intent engine (and would to the cloud LLM). Must become targeted queries (per-customer, aggregated totals) before large datasets — never send the entire DB to an LLM.
3. **Sync queue**: unbounded growth without a backend; actions replay whole payloads. At scale, batch and compact.
4. **Dexie filters**: full scans for isDeleted/sort in JS. Index-backed queries + `orderBy(index)` needed at scale.
5. **localStorage PIN/migration keys**: fine for one user; per-user namespacing needed for multi-user.

---

## O. Features NOT Implemented (deliberately)

Cloud sync backend · user accounts/auth · multi-shop/multi-user · conflict UI · Urdu PDF receipts · voice output (TTS) · automated/official WhatsApp Business API workflows · biometric unlock (WebAuthn) · data export/backup (beyond PDF) · virtualized lists · automated tests/CI · analytics · dark-theme redesign.

---

## P. Recommended Phase 9+ Roadmap (suggested order — needs owner approval)

1. **Stabilize & harden (small):** label associations, Sheet focus trap, list pagination, conflict banner UI, notification real-device QA.
2. **Voice-first AI (the vision, see PRODUCT_VISION.md):** conversational multi-entity statements ("Ahmed ne aaj 2000 ka udhaar liya, 15 Sep ko wapas karega"), voice output, deeper Urdu/Roman Urdu NLU — always behind the existing ActionProposal+Confirm contract.
3. **Scalability pass:** targeted AI queries, index-backed reads, virtualization.
4. **Cloud sync MVP:** real backend behind the existing `CloudProvider`, auth, conflict resolution UI.
5. **Dark theme redesign, Urdu PDF font, WhatsApp Business API integration (official only).**

---

## Q. Where to Make Changes (most-touched files)

| Task | File(s) |
|---|---|
| New page/route | `src/app/App.tsx` (lazy import + Route), `src/pages/<Name>/`, nav in `src/core/config/nav.ts`, i18n keys in `src/core/i18n/en.ts` **and** `ur.ts` (keep parity — 191 keys each) |
| Data model change | `src/core/types/index.ts` + new Dexie `version(n)` in `src/data/db/db.ts` (never edit an old version's stores) |
| New write operation | repository in `src/data/repositories/` (transaction + enqueue pattern — copy `paymentRepo.addPayment`) |
| AI intents | `src/features/ai/intents.ts` (patterns) → `engine.ts` (handling) → `responses.ts` (EN+UR strings) |
| AI actions | Add `ActionKind` in `core/types`, proposal in `engine.ts`, executor case in `AI.tsx executeProposal`, labels in `actionLabels` |
| Sync behavior | `src/data/services/syncService.ts`; provider in `src/data/cloud/` |
| Theming | `src/index.css` (@theme tokens) + `src/core/config/theme.ts` |
| PWA | `vite.config.ts` (manifest/workbox), `public/sw-listeners.js` |

Env vars (none required to run): `VITE_API_BASE_URL` (cloud sync), `VITE_AI_ENDPOINT` (cloud AI backend wrapper). **Never put provider API keys in the frontend.**

---

## R. How to Run / Build / Verify

```bash
npm install
npm run dev        # dev server (Vite)
npm run lint       # ESLint — must be zero errors/warnings
npx tsc -b         # TypeScript project build check
npm run build      # production build to dist/ (tsc -b + vite build + SW gen)
npm run preview    # serve dist/ locally (use --port 4173 --strictPort)
```

Manual verification checklist (no automated tests exist):
1. Lint + tsc + build clean.
2. Golden path in preview: add customer → add udhaar → record payment → balances update everywhere (Dashboard, CustomerDetail, Reports) without reload.
3. Edge cases: overpayment clamps to 0; delete payment restores udhaar remaining.
4. AI: command produces ConfirmCard; **DB unchanged until Confirm**; Cancel writes nothing.
5. Offline: DevTools offline OR stop the server → app reloads from SW; writes still work and queue; header shows "Offline — changes saved locally".
6. Urdu: `dir="rtl"` + `lang="ur-PK"`, no horizontal overflow on any route.
7. PIN: create → lock → wrong PIN shake → correct unlock → reload stays unlocked per tab.

Windows note: stopping `vite preview` may orphan the process — kill via `netstat -ano | grep :4173` then `powershell Stop-Process -Id <pid> -Force`.

---

## S. AI Financial-Action Safety Rules (repeat — this is the contract)

1. AI proposes, human confirms, repository executes. No exceptions without an explicit future product spec.
2. Confirmations must show action type, customer, amount, method/date before the buttons.
3. Numbers in AI responses come only from local data — never invent or estimate.
4. Offline AI answers from local data and says so; cloud AI is answer-only today.
5. Deletes are soft (`isDeleted`) and also confirm-gated.
6. Reminders to customers are always user-initiated (wa.me link / Web Share).

---

*Prepared 2026-08-29 after a full Phase 0–8 audit. Lint/tsc/build all clean at handoff.*
