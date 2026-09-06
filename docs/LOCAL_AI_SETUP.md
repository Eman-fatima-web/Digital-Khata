# Local AI Setup Guide — Ollama + FastAPI

Digital Khata supports running AI locally through [Ollama](https://ollama.com), giving you a fully offline-capable AI assistant. No internet, API keys, or cloud costs required.

## Architecture

```
React Chatbox → Express Server → FastAPI AI Service → Ollama → Local LLM
     (browser)      (Node.js)        (Python)        (localhost:11434)  (Gemma/Llama/Qwen)
```

The FastAPI service acts as a bridge, converting between the Express server's OpenAI-compatible message format and Ollama's native API.

## Prerequisites

1. **Ollama** — Download from [ollama.com](https://ollama.com) and install
2. **Python 3.10+** — For the FastAPI service
3. **Node.js 18+** — Already required for Digital Khata

## Step 1: Install and Start Ollama

```bash
# macOS / Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows: Download from https://ollama.com/download
```

Start the Ollama server:

```bash
ollama serve
```

Ollama runs on `http://localhost:11434` by default.

## Step 2: Pull a Model

Choose a model based on your hardware:

| Model | Command | Size | Best For |
|-------|---------|------|----------|
| Gemma 3 (recommended) | `ollama pull gemma3` | ~2.3 GB | Balanced quality/speed |
| Llama 3.2 | `ollama pull llama3.2` | ~2.0 GB | General conversation |
| Qwen 2.5 | `ollama pull qwen2.5` | ~2.3 GB | Multilingual (Urdu) |
| Phi-3 mini | `ollama pull phi3` | ~2.3 GB | Low-resource devices |

```bash
# Example: pull the recommended model
ollama pull gemma3
```

Verify the model is available:

```bash
ollama list
```

## Step 3: Start the FastAPI AI Service

```bash
cd ai-service

# Create a virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # Linux/macOS
# venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt

# Start the service
python main.py
```

The service starts on `http://localhost:8000` by default.

Verify it's running:

```bash
curl http://localhost:8000/api/health
```

Expected response:

```json
{
  "status": "ok",
  "ollama_status": "connected",
  "model": "gemma3",
  "models": ["gemma3:latest"]
}
```

## Step 4: Configure the Express Server

Edit `server/.env` (or create it from `server/.env.example`):

```env
# Select Ollama as the AI provider
AI_PROVIDER=ollama

# FastAPI service URL (default: http://localhost:8000)
AI_SERVICE_URL=http://localhost:8000

# Ollama configuration (used by FastAPI service)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma3
```

## Step 5: Configure the Frontend (Optional)

Users can switch AI providers from **Settings → AI Provider** in the app:

- **Auto-detect** — Uses the best available provider automatically
- **Local AI (Ollama)** — Forces local LLM usage
- **Cloud AI (OpenRouter)** — Uses cloud LLM (requires API key)

The preference is stored locally per device.

## Step 6: Start the Application

```bash
# Terminal 1: Express server
cd server
npm install
npm run dev

# Terminal 2: FastAPI service (if not already running)
cd ai-service
python main.py

# Terminal 3: Frontend
npm run dev
```

## Environment Variables Reference

### Express Server (`server/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_PROVIDER` | _(auto)_ | `ollama`, `openrouter`, or empty for auto-detect |
| `AI_SERVICE_URL` | `http://localhost:8000` | URL of the FastAPI AI service |

### FastAPI Service (`ai-service/.env` or environment)

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `gemma3` | Default model to use |
| `OLLAMA_TIMEOUT` | `30` | Request timeout in seconds |
| `AI_SERVICE_PORT` | `8000` | Port for the FastAPI service |
| `AI_SERVICE_HOST` | `0.0.0.0` | Host to bind to |

## Health Check Endpoint

The Express server exposes a public status endpoint:

```bash
GET /api/ai/status
```

Response when Ollama is active:

```json
{
  "provider": "ollama",
  "available": true,
  "ollama": {
    "status": "connected",
    "model": "gemma3",
    "models": ["gemma3:latest", "llama3.2:latest"]
  }
}
```

## Troubleshooting

### "Ollama service unreachable"

- Ensure Ollama is running: `ollama serve`
- Check the FastAPI service can reach Ollama: `curl http://localhost:11434/api/tags`
- Verify `OLLAMA_BASE_URL` matches your Ollama installation

### "Ollama request timed out"

- Larger models need more time. Increase `OLLAMA_TIMEOUT` in the FastAPI service.
- Check system resources — local LLMs are CPU/GPU intensive.

### Slow responses

- Use a smaller model (e.g., `phi3` for low-resource devices)
- Ensure GPU acceleration is enabled if available
- Reduce `max_tokens` in requests for faster responses

### Model not found

- Pull the model first: `ollama pull gemma3`
- Check available models: `ollama list`
- Update `OLLAMA_MODEL` to match an available model name

### FastAPI service won't start

- Ensure Python 3.10+: `python --version`
- Install dependencies: `pip install -r requirements.txt`
- Check port 8000 isn't in use: `lsof -i :8000` (Linux/macOS)

## Switching Between Providers

You can switch between Ollama and OpenRouter without code changes:

```bash
# Use local Ollama
AI_PROVIDER=ollama

# Use cloud OpenRouter
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=your-key-here

# Auto-detect (tries OpenRouter first, falls back to mock)
AI_PROVIDER=
```

Restart the Express server after changing `AI_PROVIDER`.

## Running Without Internet

One of the key benefits of Ollama is fully offline operation:

1. Pull your model while online: `ollama pull gemma3`
2. Start Ollama: `ollama serve`
3. Start FastAPI: `python main.py`
4. Start Express server with `AI_PROVIDER=ollama`
5. Start the frontend

All AI queries will be processed locally with zero internet dependency.
