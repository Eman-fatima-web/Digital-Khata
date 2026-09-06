# Digital Khata Phase 10 Implementation Plan (Quick Reference)

**Phase:** 10 (AI Core Upgrade — P0 Features)  
**Duration:** 3–4 weeks  
**Team:** 2–3 engineers  
**Start:** After Phase 9 approval  

---

## Quick Summary

Phase 10 implements the **voice-first AI foundation** by adding:

1. ✅ Voice output (TTS) — user hears AI responses
2. ✅ Cloud AI integration — complex queries via LLM
3. ✅ Large dataset support — pagination for 10k+ records
4. ✅ Enhanced NLP — better Urdu/Roman Urdu handling
5. ✅ Conflict resolution — detect + UI for sync conflicts
6. ✅ Mobile UX improvements — scrolling, touch, messaging

**Total Effort:** ~23 developer days

---

## Sprint Breakdown

### Week 1: Foundation (Voice + Cloud AI)

#### Task 1.1: Voice Output Adapter Pattern [3 days]

**Files to create:**

```
src/features/ai/voiceAdapters.ts
  ├─ VoiceOutputAdapter (interface)
  ├─ BrowserTTSAdapter (Web Speech API)
  ├─ CloudTTSAdapter (stub for future)
  └─ getVoiceAdapter(language, online): VoiceOutputAdapter

src/features/ai/types.ts (extend)
  └─ Add VoiceOutputAdapter interface
```

**Implementation:**

```typescript
// src/features/ai/voiceAdapters.ts

export interface VoiceOutputAdapter {
  readonly name: string
  isAvailable(): boolean
  speak(text: string, language: AILanguage): Promise<void>
}

export class BrowserTTSAdapter implements VoiceOutputAdapter {
  readonly name = 'browser'

  isAvailable(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window
  }

  async speak(text: string, language: AILanguage): Promise<void> {
    const utterance = new SpeechSynthesisUtterance(text)
    
    // Set language
    if (language === 'ur') {
      utterance.lang = 'ur-PK'
      // Try to find female voice
      const voices = window.speechSynthesis.getVoices()
      const urduVoice = voices.find(v => v.lang.startsWith('ur'))
      if (urduVoice) utterance.voice = urduVoice
    } else {
      utterance.lang = 'en-US'
    }
    
    // Voice selection (prefer female)
    const voices = window.speechSynthesis.getVoices()
    const femaleVoice = voices.find(v =>
      v.name.toLowerCase().includes('female') ||
      v.name.toLowerCase().includes('woman')
    )
    if (femaleVoice) utterance.voice = femaleVoice

    // Speech parameters
    utterance.rate = 0.9  // Slightly slower for clarity
    utterance.pitch = 1.2 // Higher pitch (more feminine)
    utterance.volume = 1.0

    return new Promise((resolve, reject) => {
      utterance.onend = () => resolve()
      utterance.onerror = () => reject(new Error('TTS error'))
      window.speechSynthesis.speak(utterance)
    })
  }
}

export function getVoiceAdapter(
  language: AILanguage,
  isOnline: boolean
): VoiceOutputAdapter {
  // For now, browser TTS; later add CloudTTSAdapter for online
  const browser = new BrowserTTSAdapter()
  if (browser.isAvailable()) return browser
  
  // Fallback: no-op if TTS unavailable
  return {
    name: 'none',
    isAvailable: () => false,
    speak: async () => {}
  }
}
```

**Tests:**

```typescript
test('BrowserTTSAdapter: speak English', async () => {
  const adapter = new BrowserTTSAdapter()
  expect(adapter.isAvailable()).toBe(true)
  await adapter.speak('Test message', 'en')
  // Verify speechSynthesis.speak called
})

test('BrowserTTSAdapter: speak Urdu', async () => {
  const adapter = new BrowserTTSAdapter()
  await adapter.speak('آزمائش پیغام', 'ur')
  // Verify language set to ur-PK
})
```

**Acceptance:** Voice output audible on iOS Safari, Android Chrome, Desktop Firefox

---

#### Task 1.2: Integrate TTS into AI Chat [1 day]

**Files to modify:**

```
src/pages/AI/AI.tsx
  ├─ Import voiceAdapter
  ├─ After AI response, call await voiceAdapter.speak(text, language)
  ├─ Add "🔊" button to replay response
  └─ Show spinner while TTS playing

src/features/ai/responses.ts
  ├─ Shorten all response text (max 2-3 sentences for TTS)
  └─ Add variant: short responses for voice, detailed for text
```

**Implementation:**

```typescript
// In AI.tsx, after AI response generated:

const voiceAdapter = getVoiceAdapter(language, isOnline)
if (voiceAdapter.isAvailable() && userPreferences.enableVoice) {
  setThinking(true)
  try {
    await voiceAdapter.speak(responseText, language)
  } catch (err) {
    console.error('TTS failed:', err)
  }
  setThinking(false)
}
```

**Acceptance:** TTS plays after each AI response; user can hear confirmation text before confirming action

---

#### Task 1.3: Cloud AI Integration [5 days]

**Files to create/modify:**

```
src/data/cloud/restCloudProvider.ts (COMPLETE IMPLEMENTATION)
  ├─ Real push() method (send sync actions)
  └─ Real pull() method (fetch changes)

.env.example (create)
  ├─ VITE_AI_ENDPOINT=...
  ├─ VITE_API_BASE_URL=...
  └─ (no API keys in frontend!)

docs/CLOUD_SETUP.md (create)
  ├─ Backend requirements
  ├─ Authentication flow
  └─ Example endpoint
```

**Backend Contract (Example):**

```http
POST /api/ai/query
Content-Type: application/json
Authorization: Bearer <token>

{
  "prompt": "Ahmed ne 2000 payment kar",
  "language": "ur",
  "summary": {
    "customers": [
      { "id": "...", "name": "Ahmed", "phone": "0300...", "outstanding": 5000 }
    ],
    "totals": { ... }
  },
  "instruction": "Answer using ONLY the numbers provided in summary. Never invent amounts."
}
```

**Backend Response:**

```json
{
  "type": "proposal",
  "text": "Found Ahmed: record 2000 payment?",
  "proposal": {
    "kind": "RECORD_PAYMENT",
    "customerId": "...",
    "customerName": "Ahmed",
    "amount": 2000
  }
}
```

**Implementation (Frontend):**

```typescript
// src/features/ai/adapters.ts (implement CloudAIAdapter)

export class CloudAIAdapter implements AIAdapter {
  readonly name = 'cloud'
  private accessToken?: string

  async authenticate(credentials: CloudCredentials): Promise<boolean> {
    const endpoint = import.meta.env.VITE_AI_ENDPOINT
    if (!endpoint) return false
    
    try {
      const response = await fetch(`${endpoint}/auth/verify`, {
        headers: { Authorization: `Bearer ${credentials.accessToken}` }
      })
      if (response.ok) {
        this.accessToken = credentials.accessToken
        return true
      }
    } catch {
      return false
    }
    return false
  }

  async answer(request: AIRequest): Promise<AIResult> {
    const endpoint = import.meta.env.VITE_AI_ENDPOINT
    if (!endpoint || !this.accessToken) {
      return { type: 'fallback' }
    }

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000) // 10s timeout

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`
        },
        body: JSON.stringify({
          prompt: request.input,
          language: request.language,
          summary: summarizeData(request.data),
          instruction: 'Answer using ONLY the numbers provided...'
        }),
        signal: controller.signal
      })

      clearTimeout(timeout)

      if (!response.ok) {
        throw new Error(`Cloud AI error: ${response.status}`)
      }

      const json = (await response.json()) as { type: string; text?: string; proposal?: any }
      
      if (json.type === 'proposal') {
        return { type: 'proposal', text: json.text || '', proposal: json.proposal }
      }

      return { type: 'answer', text: json.text || '' }
    } catch (error) {
      console.error('Cloud AI failed:', error)
      return { type: 'fallback' }
    }
  }
}
```

**Fallback Logic (in askAI function):**

```typescript
export async function askAI(
  request: AIRequest,
  online: boolean
): Promise<AIResult> {
  // Try LocalAI first (always available)
  const local = new LocalAIAdapter()
  const result = await local.answer(request)

  // If LocalAI uncertain AND online: try CloudAI
  if (result.type === 'fallback' && online) {
    const cloud = new CloudAIAdapter()
    if (cloud.isAvailable()) {
      try {
        return await cloud.answer(request)
      } catch {
        // Fall through to honest fallback
      }
    }
  }

  // Honest fallback if both fail
  return {
    type: 'answer',
    text: getResponses(request.language).fallback(
      online,
      new CloudAIAdapter().isAvailable()
    )
  }
}
```

**Acceptance:** Cloud AI responds to queries when online; LocalAI fallback when offline or cloud fails

---

### Week 2: Scalability (Pagination + Data Slicing)

#### Task 2.1: Dexie Pagination Support [2 days]

**Files to modify:**

```
src/data/repositories/customerRepo.ts
src/data/repositories/udhaarRepo.ts
src/data/repositories/paymentRepo.ts
src/data/repositories/saleRepo.ts
  └─ Add paginated query methods
```

**Implementation:**

```typescript
// Example: customerRepo.ts

export type PaginationResult<T> = {
  data: T[]
  hasMore: boolean
  nextCursor?: string
}

export async function getCustomersPaginated(
  limit: number = 50,
  cursor?: string
): Promise<PaginationResult<Customer>> {
  let query = db.customers.filter(c => !c.isDeleted).sortBy('name')

  // Dexie offset approach (cursor = last ID from previous page)
  if (cursor) {
    query = query.filter(c => c.id > cursor)
  }

  const data = await query.limit(limit + 1).toArray()
  const hasMore = data.length > limit

  return {
    data: data.slice(0, limit),
    hasMore,
    nextCursor: hasMore ? data[limit - 1].id : undefined
  }
}
```

**Acceptance:** Pagination works; large lists don't load all data into memory

---

#### Task 2.2: Data Slicing for AI Engine [1 day]

**Files to modify:**

```
src/features/ai/engine.ts
  └─ Modify runEngine() to accept partial snapshot
```

**Implementation:**

```typescript
// Before:
export function runEngine(
  input: string,
  data: KhataSnapshot,  // All 100k records
  language: AILanguage
): AIResult { ... }

// After:
export function runEngine(
  input: string,
  data: KhataSnapshot,  // Only relevant records (sliced)
  language: AILanguage
): AIResult { ... }

// In AI.tsx, before calling engine:
const targetCustomer = matchCustomers(input, allCustomers)
const slicedData = targetCustomer?.status === 'unique'
  ? {
      customers: [targetCustomer.customer],
      udhaar: udhaar.filter(e => e.customerId === targetCustomer.customer.id),
      payments: payments.filter(p => p.customerId === targetCustomer.customer.id),
      sales: sales.filter(s => s.customerId === targetCustomer.customer.id)
    }
  : { customers: allCustomers.slice(0, 100), udhaar, payments, sales }
```

**Acceptance:** AI engine receives only relevant context (5–50 records, not 100k+)

---

#### Task 2.3: Pagination UI Components [1 day]

**Files to create:**

```
src/components/ui/PaginationControls.tsx
  ├─ Next/Previous buttons
  ├─ Cursor management
  └─ "Loading..." state while fetching

src/hooks/usePagination.ts
  ├─ Generic pagination hook
  ├─ useCustomersPaginated(limit)
  └─ usePagination(fetchFn, limit)
```

**Acceptance:** Customers, Udhaar, Payments, Sales pages show pagination UI

---

#### Task 2.4: Update List Pages to Use Pagination [1 day]

**Files to modify:**

```
src/pages/Customers/Customers.tsx
src/pages/Udhaar/Udhaar.tsx
src/pages/Payments/Payments.tsx
src/pages/Sales/Sales.tsx
  └─ Replace `useCustomers()` with `usePaginatedCustomers()`
     └─ Add "Load More" button
```

**Acceptance:** Lists load incrementally; no janky scrolling with 10k+ records

---

### Week 3: NLP + Conflict Handling

#### Task 3.1: Enhanced NLP (Urdu/Roman Urdu) [3 days]

**Files to create/modify:**

```
src/lib/romanUrduMap.ts (create)
  ├─ Roman Urdu phonetic variants
  └─ Example: { "Ehmed": "Ahmed", "adai": "ada" }

src/features/ai/nlp.ts (modify)
  ├─ Improve matchCustomers() with phonetic scoring
  ├─ Add extractFraction() for "sawa", "dhai", "saphed"
  ├─ Enhance date parsing for relative dates
  └─ Better Roman Urdu tokenization
```

**Implementation:**

```typescript
// src/lib/romanUrduMap.ts
export const romanUrduVariants = {
  // Phonetic variants
  'ahmed': ['Ehmed', 'Ahmad', 'Hmad'],
  'udhaar': ['udhar', 'odhaar', 'udaar'],
  'payment': ['paiment', 'payement'],
  'kya': ['ky', 'ks'],
  'hain': ['hain', 'han', 'hn'],
  
  // Amount variants
  'lakh': ['lac', 'lak', 'lakhs'],
  'hazar': ['hajar', 'hazaar', 'hazaaar'],
  'sawa': ['sawah', 'suwa'],  // 1.25x
  'dhai': ['dhaai', 'dheyi'],  // 2.5x
  'saphed': ['saphaid'],        // 0.5x
  
  // Action verbs
  'dena': ['de', 'diya', 'diye', 'dijiye'],
  'lena': ['le', 'liya', 'liye', 'lejiye'],
  'likho': ['likh', 'likhao'],
}

// src/features/ai/nlp.ts
export function phoneticScore(name1: string, name2: string): number {
  const norm1 = normalize(name1)
  const norm2 = normalize(name2)
  
  if (norm1 === norm2) return 100  // Exact match
  
  // Check variants
  for (const [canonical, variants] of Object.entries(romanUrduVariants)) {
    if (normalize(canonical) === norm1 && variants.some(v => normalize(v) === norm2)) {
      return 80  // Variant match
    }
  }
  
  // Levenshtein distance fallback
  return levenshteinSimilarity(norm1, norm2) * 70
}

export function matchCustomers(input: string, customers: Customer[]): CustomerMatch {
  const tokens = normalize(input)
    .split(' ')
    .filter(token => token.length > 1 && !STOPWORDS.has(token))

  if (tokens.length === 0) return { status: 'none' }

  const scored = customers
    .map(customer => {
      let score = 0
      
      // Phone number match
      if (tokens.includes(customer.phone)) {
        return { customer, score: 100 }
      }
      
      // Name tokens + phonetic variants
      const nameTokens = normalize(customer.name).split(' ')
      for (const token of tokens) {
        // Exact match
        if (nameTokens.includes(token)) {
          score = Math.max(score, 80)
          continue
        }
        
        // Phonetic variant
        const phoneticSim = phoneticScore(token, customer.name)
        score = Math.max(score, phoneticSim)
      }
      
      return { customer, score }
    })
    .filter(entry => entry.score > 40)  // Lower threshold for variants

  if (scored.length === 0) return { status: 'none' }

  const best = Math.max(...scored.map(e => e.score))
  const top = scored.filter(e => e.score === best)

  if (top.length === 1) return { status: 'unique', customer: top[0].customer }
  return { status: 'ambiguous', candidates: top.map(e => e.customer) }
}

export function extractFraction(input: string): number | undefined {
  const fractionMap: Record<string, number> = {
    'sawa': 1.25, 'sawah': 1.25,
    'dhai': 2.5, 'dhaai': 2.5,
    'saphed': 0.5, 'saphaid': 0.5,
    'aadha': 0.5, 'adha': 0.5,
    'teen_chauthai': 0.75, 'tin_chauthai': 0.75
  }
  
  const tokens = normalize(input).split(' ')
  for (const token of tokens) {
    if (fractionMap[token]) return fractionMap[token]
  }
  return undefined
}
```

**Acceptance:** Phonetic matching works; "Ehmed" matches "Ahmed"; fraction parsing works ("sawa 1000" = 1250)

---

#### Task 3.2: Conflict Detection + UI [2 days]

**Files to create/modify:**

```
src/data/db/db.ts (v4 migration)
  └─ Add conflictLog table

src/data/repositories/conflictLogRepo.ts (create)
  ├─ addConflict()
  ├─ getUnresolvedConflicts()
  └─ resolveConflict(id, resolution)

src/data/services/syncService.ts (modify)
  ├─ detectConflict() during pull
  └─ Halt sync, notify UI

src/components/ui/ConflictResolutionModal.tsx (create)
  ├─ Show local vs. remote record
  ├─ "Use Local" / "Use Remote" buttons
  └─ Resume sync after resolution
```

**Implementation:**

```typescript
// src/data/db/db.ts (v4)
this.version(4).stores({
  // existing tables...
  conflictLog: 'id, recordId, table, createdAt, resolvedAt'
})

// src/data/services/syncService.ts
private async detectConflict(
  local: KhataEntity,
  remote: KhataEntity
): Promise<boolean> {
  // Same record, different versions = conflict
  return local.id === remote.id && local.version !== remote.version
}

async sync(): Promise<boolean> {
  // ... push logic ...
  
  const pullResult = await this.provider.pull(since)
  
  for (const { table, record: remote } of pullResult.records) {
    const local = await this.getLocalRecord(table, remote.id)
    
    if (local && this.detectConflict(local, remote)) {
      // Store conflict, halt sync
      await db.conflictLog.add({
        id: generateId(),
        recordId: remote.id,
        table,
        localVersion: local.version,
        remoteVersion: remote.version,
        localRecord: local,
        remoteRecord: remote,
        createdAt: nowISO()
      })
      
      // Notify UI
      this.conflictDetected.notify({
        conflicts: [{ table, recordId: remote.id, local, remote }]
      })
      
      this.setState('conflict')
      return false  // Halt sync
    }
  }
  
  // Continue if no conflicts
  await this.applyPulledRecords(pullResult.records)
  this.setState('idle')
  return true
}

// src/components/ui/ConflictResolutionModal.tsx
export function ConflictResolutionModal({
  conflicts,
  onResolve
}: {
  conflicts: ConflictLog[]
  onResolve: (id: string, resolution: 'local' | 'remote') => void
}) {
  const [selected, setSelected] = useState<'local' | 'remote'>('local')

  return (
    <Modal title="Sync Conflict">
      <div className="space-y-4">
        <p>This record was edited on another device. Which version should we keep?</p>
        
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <h3>Local (This Device)</h3>
            <p>Version {conflicts[0].localVersion}</p>
            <pre>{JSON.stringify(conflicts[0].localRecord, null, 2)}</pre>
            <Button
              variant={selected === 'local' ? 'primary' : 'outline'}
              onClick={() => setSelected('local')}
            >
              Keep Local
            </Button>
          </Card>
          
          <Card>
            <h3>Remote (Other Device)</h3>
            <p>Version {conflicts[0].remoteVersion}</p>
            <pre>{JSON.stringify(conflicts[0].remoteRecord, null, 2)}</pre>
            <Button
              variant={selected === 'remote' ? 'primary' : 'outline'}
              onClick={() => setSelected('remote')}
            >
              Keep Remote
            </Button>
          </Card>
        </div>
        
        <Button onClick={() => onResolve(conflicts[0].id, selected)}>
          Resolve & Resume Sync
        </Button>
      </div>
    </Modal>
  )
}
```

**Acceptance:** Conflicts detected and displayed; user can choose resolution; sync resumes after

---

#### Task 3.3: Mobile UX Polish [2 days]

**Files to modify:**

```
src/app/layout/AppLayout.tsx
  ├─ Add SyncStatusIndicator to header
  └─ Show online/offline/syncing status

src/pages/AI/AI.tsx (enhance)
  ├─ Better responsive layout
  ├─ Touch-optimized buttons
  └─ Scroll position restoration

All pages:
  ├─ Verify mobile breakpoints work
  ├─ Test on actual devices (iOS + Android)
  └─ Improve touch targets (min 44px)
```

**Acceptance:** App feels smooth on mobile; user knows sync status; no layout breaks

---

### Week 4: Testing + Polish

#### Task 4.1: Testing [3 days]

**Unit Tests:**

```bash
# Create tests for:
npm test -- src/features/ai/nlp.test.ts
npm test -- src/features/ai/adapters.test.ts
npm test -- src/data/services/syncService.test.ts
npm test -- src/components/ui/ConflictResolutionModal.test.tsx

# Target: 70%+ coverage
npm test -- --coverage
```

**Integration Tests:**

```typescript
// Test full flows
test('AI → Proposal → Confirm → Payment recorded', async () => {
  // 1. User says "Ahmed ne 2000 payment kar"
  const result = await askAI({ input, data, language })
  
  // 2. Proposal shown
  expect(result.type).toBe('proposal')
  
  // 3. User confirms
  await executeProposal(result.proposal)
  
  // 4. Payment in DB
  const payments = await getPaymentsByCustomer('ahmed-id')
  expect(payments.length).toBeGreaterThan(0)
})

test('Offline write + online sync', async () => {
  // Go offline
  networkService.notify(false)
  
  // Create customer
  const customer = await addCustomer({ ... }, owner)
  
  // Go online
  networkService.notify(true)
  
  // Sync completes
  await syncService.sync()
  
  // Verify synced
  const synced = await db.customers.get(customer.id)
  expect(synced.syncStatus).toBe('synced')
})
```

**Manual Testing (Devices):**

```
Platforms:
  - iOS Safari (latest)
  - Android Chrome (latest)
  - Firefox Desktop
  - Chrome Desktop

Test Scenarios:
1. Voice input + TTS output (English + Urdu)
2. Create 5 records offline
3. Go online, verify sync
4. Create 1000 customers, verify pagination
5. Edit same record on 2 devices, resolve conflict
6. Dark mode rendering
7. RTL (Urdu) mode full app
8. Large scrollable list (no jank)
```

**Acceptance:** All tests pass; manual testing on real devices successful

---

#### Task 4.2: Performance Audit [1 day]

**Tools:**

```bash
# Lighthouse score
npx lighthouse https://localhost:5173

# Bundle size
npm run build
# Check dist/ size (<300KB gzipped)

# React Profiler
# - Navigate to Customers (10k records)
# - Record render time
# - Identify slow components
```

**Targets:**

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Lighthouse Performance | >80 | ? | Check |
| Bundle Size (gzipped) | <300KB | ? | Check |
| LocalAI Query | <1s | ? | Check |
| Pagination Load | <500ms | ? | Check |
| Mobile FCP | <2s | ? | Check |

**Acceptance:** Performance meets targets; no regressions vs. Phase 8

---

#### Task 4.3: Documentation [1 day]

**Files to create/update:**

```
PHASE_10_SUMMARY.md
  ├─ Features implemented
  ├─ Testing results
  └─ Known issues

ARCHITECTURE.md (update)
  ├─ AI architecture diagram
  ├─ Sync flow diagram
  └─ Voice I/O architecture

docs/AI_SETUP.md (create)
  ├─ How to set up cloud AI endpoint
  ├─ Backend API contract
  └─ Testing locally

docs/VOICE_SETUP.md (create)
  ├─ Supported platforms
  ├─ Voice selection options
  └─ Known limitations (iOS, Android)

README.md (update)
  ├─ Link to new docs
  └─ Phase 10 feature summary
```

**Acceptance:** Documentation complete and accurate

---

## Task Dependencies

```
Week 1:
  Task 1.1 (Voice Adapter) → Task 1.2 (TTS Integration)
  Task 1.1 also depends on: Task 1.3 (Cloud AI) as alternative

Week 2:
  Task 2.1 (Pagination) → Task 2.4 (UI Integration)
  Task 2.2 (Data Slicing) can start in parallel

Week 3:
  Task 3.1 (Enhanced NLP) independent
  Task 3.2 (Conflict Handling) independent
  Task 3.3 (Mobile UX) after all features

Week 4:
  All tasks must complete before testing
  Task 4.1 (Testing) → Task 4.2 (Performance) → Task 4.3 (Docs)
```

---

## Rollback Plan

**If Voice Output Fails:**
- Feature flag: `ENABLE_VOICE_OUTPUT = false`
- Fallback: Text-only responses
- No data loss

**If Cloud AI Fails:**
- Feature flag: `ENABLE_CLOUD_AI = false`
- Fallback: LocalAI only
- Honest user message: "Offline mode"

**If Sync Conflicts Occur:**
- Default: Last-Write-Wins (local copy)
- Show warning to user
- Allow manual resolution later

**If Performance Regresses:**
- Revert pagination changes
- Use simpler lazy-loading
- Optimize virtual scroll

---

## Success Metrics (Phase 10 Completion)

### Functional
- ✅ All 13 intents working (no regressions)
- ✅ TTS output working on iOS, Android, Desktop
- ✅ CloudAI responding to queries when online
- ✅ LocalAI fallback when offline
- ✅ Pagination on all list pages
- ✅ Conflict resolution UI working
- ✅ No TypeScript errors

### Performance
- ✅ Bundle size < 300KB (gzipped)
- ✅ LocalAI query < 1s
- ✅ Pagination load < 500ms
- ✅ Mobile FCP < 2s
- ✅ 10k+ record lists scroll smoothly

### Quality
- ✅ Test coverage > 70%
- ✅ npm run lint: 0 errors
- ✅ npm run build: succeeds
- ✅ All manual test scenarios pass
- ✅ WCAG AA accessibility pass (critical pages)

### User Experience
- ✅ User can hear AI responses
- ✅ User knows sync status
- ✅ User can resolve conflicts
- ✅ Large lists don't lag
- ✅ Mobile feels responsive

---

## Budget & Resources

**Team:** 2–3 engineers  
**Duration:** 3–4 weeks (21–28 days)  
**Effort:** ~23 developer days  

**Breakdown:**
- Voice (TTS): 4 days
- Cloud AI: 6 days
- Pagination: 4 days
- NLP: 4 days
- Conflict Handling: 2 days
- Mobile UX: 2 days
- Testing: 3 days

**Tools/Services:**
- LLM Provider (OpenAI, Alibaba, Google Cloud): TBD
- TTS Provider (Browser API, Google Cloud): Free (browser), $$ (cloud)
- Testing: Free (Jest, Playwright, axe)
- Monitoring: Free (Sentry free tier)

---

## Go/No-Go Criteria

**GO to Phase 10 if:**
- ✅ Phase 9 audit approved by stakeholders
- ✅ Backend team ready for Cloud AI endpoint
- ✅ Design sign-off on TTS voice options
- ✅ Test devices available (iOS + Android)

**NO-GO if:**
- ❌ Phase 9 findings show architectural issues
- ❌ Cloud AI provider not selected
- ❌ Team capacity unavailable

---

**Next Action:** Await Phase 9 approval → Begin Week 1 planning → Sprint starts
