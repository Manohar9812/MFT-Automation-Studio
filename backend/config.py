"""Configuration loaded from environment (.env)."""
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))


def _get(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


# Azure OpenAI (chat)
OPENAI_API_KEY = _get("API_OPENAI_API_KEY")
OPENAI_DEPLOYMENT = _get("API_OPENAI_DEPLOYMENT", "gpt-4o-mini")
OPENAI_ENDPOINT = _get("API_OPENAI_ENDPOINT")
OPENAI_VERSION = _get("API_OPENAI_VERSION", "2025-01-01-preview")

# Azure AI Search (optional RAG backend)
SEARCH_ENDPOINT = _get("AZURE_SEARCH_ENDPOINT")
SEARCH_KEY = _get("AZURE_SEARCH_KEY")
SEARCH_INDEX = _get("AZURE_SEARCH_INDEX", "mft-templates")

# LangSmith
LANGCHAIN_TRACING_V2 = _get("LANGCHAIN_TRACING_V2", "false")
if LANGCHAIN_TRACING_V2.lower() == "true":
    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    os.environ["LANGCHAIN_API_KEY"] = _get("LANGCHAIN_API_KEY")
    os.environ["LANGCHAIN_PROJECT"] = _get("LANGCHAIN_PROJECT", "mft-automation-studio")

# Server
CORS_ORIGINS = [o.strip() for o in _get(
    "CORS_ORIGINS", "http://localhost:8080,http://127.0.0.1:8080").split(",") if o.strip()]

USE_AZURE_SEARCH = bool(SEARCH_ENDPOINT and SEARCH_KEY)
