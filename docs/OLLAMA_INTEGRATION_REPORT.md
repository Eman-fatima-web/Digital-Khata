# Ollama Direct Integration Report

## Summary

Replaced the FastAPI intermediary OllamaProvider with a direct Ollama native API integration. The provider now calls `POST http://localhost:11434/api/chat` directly, eliminating the Python/FastAPI dependency.

## Files Changed

| File | Change |
|------|--------|
| `server/providers/OllamaProvider.ts` | Rewritten — calls Ollama native `/api/chat` and `/api/tags` directly |
| `server/.env.example` | Updated env vars: `OLLAMA_BASE_URL`, `OLLAMA_MODEL=qwen3:4b`, removed `AI_SERVICE_URL` |
| `server/tests/ollama.test.ts` | Rewritten — all 23 tests updated for Ollama native API format |
| `server/tests/openrouter.test.ts` | Fixed optional chaining for TS strict mode |
| `server/routes/reports.ts` | Fixed type cast for `p.method` (TS strict mode) |

## Provider Flow

```
Frontend (AI.tsx)
  → CloudAIAdapter.askAI()
    → POST /api/ai/chat (server)
      → Provider factory selects provider
        → OllamaProvider.answer()
          → POST http://localhost:11434/api/chat
            → { model, messages, stream: false, options: { temperature, num_predict } }
          ← { message: { content }, prompt_eval_count, eval_count }
      ← AIProviderResponse { text, usage }
    ← response to frontend
```

## Provider Selection Mechanism

Set `AI_PROVIDER` in `server/.env`:

| Value | Provider | Fallback |
|-------|----------|----------|
| `ollama` | OllamaProvider | — |
| `openrouter` | OpenRouterProvider (if key set) | MockAIProvider |
| _(empty)_ | Auto-detect: OpenRouter → CloudAI → Mock | — |

Factory: `server/providers/index.ts` → `createAIProvider()` / `getAIProvider()`

## Configuration

```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:4b
```

Install Ollama: https://ollama.com/download
Pull model: `ollama pull qwen3:4b`

## Request/Response Format

**Request** (to Ollama):
```json
{
  "model": "qwen3:4b",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "stream": false,
  "options": {
    "temperature": 0.7,
    "num_predict": 1000
  }
}
```

**Response** (from Ollama):
```json
{
  "message": { "content": "..." },
  "prompt_eval_count": 42,
  "eval_count": 18
}
```

## Business Data Handling

Business data is **summarized** before sending to the LLM to reduce token usage:
- Only counts and totals are sent (e.g., `customerCount`, `totalOutstanding`, `totalSales`)
- Full customer lists, individual transactions, and PII are never sent to the LLM
- Summarization happens in `OllamaProvider.summarizeBusinessData()`

## Security

- Ollama **never** writes directly to the database
- All data mutations follow: AI → Proposal → Confirmation → Tool → Repo → DB
- Auth/tenant isolation/confirmation security/audit logging are preserved
- No API keys or sensitive data logged

## Health Check

`checkOllamaHealth()` calls `GET /api/tags` (Ollama native endpoint):
- Returns `{ status, model, models }` with available model list
- Gracefully returns `{ status: 'disconnected', error }` if Ollama is not running

## Fallback Behavior

- If `AI_PROVIDER=ollama` but Ollama is unreachable, the provider throws an error (does not silently fall back)
- The provider factory selection is static — it picks one provider at startup
- To use cloud AI as fallback, set `AI_PROVIDER=openrouter` or leave empty with `OPENROUTER_API_KEY` set

## Test Results

| Check | Result |
|-------|--------|
| `cd server && npm run build` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run build` (frontend) | PASS |
| Ollama tests (23/23) | PASS |
| OpenRouter tests (15/15) | PASS |
| All server tests (53/53) | PASS |
| Total tests (400/404) | 4 pre-existing failures (unrelated) |

### Pre-existing Failures (not related to this change)

1. `scheduler.test.ts` — expects 2 jobs, now 4 (weekly/monthly added in Phase 18)
2. `usePaginatedData.test.ts` — 2 scalability tests timing out
3. `phase4.test.ts` — monthly sales date mocking issue

## Remaining Issues

- None introduced by this change. The 4 pre-existing test failures should be addressed separately.
