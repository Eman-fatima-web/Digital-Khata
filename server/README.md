# Digital Khata Server

Secure backend AI gateway for Digital Khata — the AI-powered business assistant for Pakistani shopkeepers.

## Architecture

```
React Frontend
      ↓
Authenticated API (JWT)
      ↓
AI Gateway (Express)
      ↓
Security / Authorization
      ↓
AI Provider (OpenAI/Mock)
      ↓
Structured Tool Calls
      ↓
Validation (Zod)
      ↓
Business Logic
      ↓
Repositories
      ↓
Database
```

## Features

- **Secure AI Gateway**: Server-side AI provider integration (API keys never exposed to frontend)
- **Authentication**: JWT-based authentication with user/business context
- **Tenant Isolation**: All data access scoped to authenticated business
- **Structured Tool Calls**: Zod-validated tool arguments prevent injection
- **Rate Limiting**: Protects against abuse
- **AI Provider Abstraction**: Swap providers without changing application code
- **Audit Logging**: All AI interactions logged for security review

## Setup

1. Install dependencies:
```bash
cd server
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your values
```

3. Run development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
npm start
```

## API Endpoints

### Authentication

**POST /api/auth/login**
```json
{
  "email": "demo@example.com",
  "password": "demo123"
}
```
Response:
```json
{
  "token": "jwt-token-here",
  "user": {
    "id": "user-1",
    "businessId": "business-1",
    "email": "demo@example.com"
  }
}
```

**POST /api/auth/register**
```json
{
  "email": "new@example.com",
  "password": "secure-password",
  "businessName": "My Shop"
}
```

### AI Chat

**POST /api/ai/chat**
Headers: `Authorization: Bearer <token>`
```json
{
  "prompt": "Ahmed ka balance batao",
  "conversationHistory": [],
  "businessData": {
    "customers": [...],
    "transactions": [...]
  }
}
```
Response:
```json
{
  "response": "Ahmed ka outstanding Rs. 8,500 hai.",
  "toolCalls": [],
  "usage": {
    "promptTokens": 50,
    "completionTokens": 20,
    "totalTokens": 70
  }
}
```

### Tool Execution

**POST /api/ai/tool/execute**
Headers: `Authorization: Bearer <token>`
```json
{
  "toolName": "record_payment",
  "arguments": {
    "customerId": "uuid-here",
    "amount": 5000,
    "method": "Cash"
  },
  "confirmationToken": "confirmation-token-here"
}
```

## Security

- **API Keys**: Stored server-side only, never exposed to frontend
- **Authentication**: JWT tokens with 7-day expiry
- **Tenant Isolation**: All queries scoped to authenticated business
- **Tool Validation**: Zod schemas validate all tool arguments
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Input Sanitization**: Business data minimized before sending to AI
- **Audit Logging**: All AI interactions logged

## Environment Variables

See `.env.example` for all configuration options.

**Critical**: Never commit `.env` file with real secrets.

## Production Deployment

1. Set `NODE_ENV=production`
2. Use strong `JWT_SECRET` (32+ characters)
3. Configure real `AI_PROVIDER_API_KEY`
4. Set up production database (replace in-memory store)
5. Use HTTPS for all connections
6. Configure proper CORS origins
7. Set up monitoring and alerting

## Testing

```bash
npm test
```

## License

Proprietary — Digital Khata
