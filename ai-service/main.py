"""
Digital Khata — Local AI Service (FastAPI + Ollama)

This service acts as a bridge between the Express server and Ollama.
It provides a unified API for chat completions and health checks.

Architecture: React → Express → FastAPI (this service) → Ollama → Local LLM
"""

import os
import sys
import logging
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("digital-khata-ai")

app = FastAPI(
    title="Digital Khata AI Service",
    description="Local AI service bridging Express and Ollama",
    version="1.0.0",
)

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
DEFAULT_MODEL = os.getenv("OLLAMA_MODEL", "gemma3")
REQUEST_TIMEOUT = float(os.getenv("OLLAMA_TIMEOUT", "30"))


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    model: Optional[str] = None
    max_tokens: Optional[int] = 1000
    temperature: Optional[float] = 0.7


class ChatResponse(BaseModel):
    response: str
    usage: Optional[dict] = None


class HealthResponse(BaseModel):
    status: str
    ollama_status: str
    model: str
    models: list[str]
    error: Optional[str] = None


@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Check Ollama connectivity and available models."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            if response.status_code != 200:
                return HealthResponse(
                    status="degraded",
                    ollama_status="error",
                    model=DEFAULT_MODEL,
                    models=[],
                    error=f"Ollama returned {response.status_code}",
                )

            data = response.json()
            models = [m["name"] for m in data.get("models", [])]

            return HealthResponse(
                status="ok",
                ollama_status="connected",
                model=DEFAULT_MODEL,
                models=models,
            )
    except httpx.ConnectError:
        return HealthResponse(
            status="degraded",
            ollama_status="disconnected",
            model=DEFAULT_MODEL,
            models=[],
            error="Cannot connect to Ollama. Is it running?",
        )
    except Exception as e:
        return HealthResponse(
            status="degraded",
            ollama_status="error",
            model=DEFAULT_MODEL,
            models=[],
            error=str(e),
        )


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Forward chat request to Ollama and return the response.

    Converts from OpenAI-compatible message format to Ollama's API format.
    """
    model = request.model or DEFAULT_MODEL

    ollama_messages = [
        {"role": msg.role, "content": msg.content}
        for msg in request.messages
    ]

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            response = await client.post(
                f"{OLLAMA_BASE_URL}/api/chat",
                json={
                    "model": model,
                    "messages": ollama_messages,
                    "stream": False,
                    "options": {
                        "num_predict": request.max_tokens,
                        "temperature": request.temperature,
                    },
                },
            )

            if response.status_code != 200:
                logger.error(
                    "Ollama error: status=%d body=%s",
                    response.status_code,
                    response.text[:500],
                )
                raise HTTPException(
                    status_code=502,
                    detail=f"Ollama returned {response.status_code}",
                )

            data = response.json()
            content = data.get("message", {}).get("content", "")

            if not content:
                raise HTTPException(status_code=502, detail="Ollama returned empty response")

            usage = None
            if "prompt_eval_count" in data and "eval_count" in data:
                usage = {
                    "prompt_tokens": data["prompt_eval_count"],
                    "completion_tokens": data["eval_count"],
                    "total_tokens": data["prompt_eval_count"] + data["eval_count"],
                }

            logger.info(
                "Chat completed: model=%s tokens=%s",
                model,
                usage.get("total_tokens", "?") if usage else "?",
            )

            return ChatResponse(response=content, usage=usage)

    except httpx.ConnectError:
        logger.error("Cannot connect to Ollama at %s", OLLAMA_BASE_URL)
        raise HTTPException(
            status_code=503,
            detail="Ollama is not running. Start it with: ollama serve",
        )
    except httpx.TimeoutException:
        logger.error("Ollama request timed out after %ss", REQUEST_TIMEOUT)
        raise HTTPException(status_code=504, detail="Ollama request timed out")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error in chat endpoint")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
async def root():
    return {
        "service": "Digital Khata AI Service",
        "version": "1.0.0",
        "ollama_url": OLLAMA_BASE_URL,
        "default_model": DEFAULT_MODEL,
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("AI_SERVICE_PORT", "8000"))
    host = os.getenv("AI_SERVICE_HOST", "0.0.0.0")

    logger.info("Starting Digital Khata AI Service on %s:%d", host, port)
    logger.info("Ollama URL: %s", OLLAMA_BASE_URL)
    logger.info("Default model: %s", DEFAULT_MODEL)

    uvicorn.run(app, host=host, port=port, log_level="info")
