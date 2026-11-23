"""FastAPI server exposing the MFT Automation Studio AI agent.

Endpoints:
  GET  /api/health          -> liveness + config status
  GET  /api/catalog         -> approved interfaces (for the UI)
  POST /api/chat            -> one agent turn (recommend / collect / validate)
"""
import time
from typing import Dict, List, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import agent
import catalog
import config

app = FastAPI(title="MFT Automation Studio AI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    interface_id: Optional[str] = None
    collected: Optional[Dict[str, str]] = None


class ChatResponse(BaseModel):
    message: str
    interface_id: Optional[str]
    collected: Dict[str, str]
    missing: List[dict]
    candidates: List[dict]
    reasoning: str
    ready: bool
    elapsed_ms: int


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "deployment": config.OPENAI_DEPLOYMENT,
        "endpoint_set": bool(config.OPENAI_ENDPOINT),
        "azure_search": config.USE_AZURE_SEARCH,
        "interfaces": len(catalog.interfaces()),
    }


@app.get("/api/catalog")
def get_catalog():
    return {"interfaces": catalog.interfaces()}


@app.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    t0 = time.time()
    try:
        state = agent.run_turn(req.message, req.interface_id, req.collected or {})
    except Exception as exc:  # graceful degradation — never 500 the UI
        return ChatResponse(
            message=(
                "The AI service hit an error (" + str(exc)[:160] + "). "
                "You can still pick a template manually from the Home page."),
            interface_id=req.interface_id,
            collected=req.collected or {},
            missing=[],
            candidates=[],
            reasoning="",
            ready=False,
            elapsed_ms=int((time.time() - t0) * 1000),
        )
    return ChatResponse(
        message=state.get("response", ""),
        interface_id=state.get("interface_id"),
        collected=state.get("collected", {}),
        missing=state.get("missing", []),
        candidates=state.get("candidates", []),
        reasoning=state.get("reasoning", ""),
        ready=state.get("ready", False),
        elapsed_ms=int((time.time() - t0) * 1000),
    )


# --------------------------------------------------------------------- v2 API
class ClassifyRequest(BaseModel):
    message: str
    collected: Optional[Dict[str, str]] = None


class ClassifyResponse(BaseModel):
    interface_id: Optional[str]
    reasoning: str
    candidates: List[dict]
    elapsed_ms: int


class Field(BaseModel):
    key: str
    label: Optional[str] = ""
    example: Optional[str] = ""
    yn: Optional[bool] = False


class ExtractRequest(BaseModel):
    message: str
    fields: List[Field]
    collected: Optional[Dict[str, str]] = None


class ExtractResponse(BaseModel):
    fields: Dict[str, str]
    elapsed_ms: int


@app.post("/api/classify", response_model=ClassifyResponse)
def classify(req: ClassifyRequest):
    t0 = time.time()
    try:
        out = agent.classify_only(req.message, req.collected or {})
    except Exception as exc:
        return ClassifyResponse(interface_id=None, reasoning="error: " + str(exc)[:160],
                                candidates=[], elapsed_ms=int((time.time() - t0) * 1000))
    return ClassifyResponse(
        interface_id=out.get("interface_id"),
        reasoning=out.get("reasoning", ""),
        candidates=out.get("candidates", []),
        elapsed_ms=int((time.time() - t0) * 1000),
    )


@app.post("/api/extract", response_model=ExtractResponse)
def extract(req: ExtractRequest):
    t0 = time.time()
    try:
        fields = [f.model_dump() for f in req.fields]
        vals = agent.extract_schema(req.message, fields, req.collected or {})
    except Exception as exc:
        return ExtractResponse(fields={}, elapsed_ms=int((time.time() - t0) * 1000))
    return ExtractResponse(fields=vals, elapsed_ms=int((time.time() - t0) * 1000))


# ---------------------------------------------------- Copilot conversational API
class AgentRequest(BaseModel):
    message: str
    interface_id: Optional[str] = None
    history: Optional[List[dict]] = None


class AgentResponse(BaseModel):
    message: str
    action: str               # none | start_build | recommend
    interface_id: Optional[str]
    intent: str
    reasoning: str
    elapsed_ms: int


@app.post("/api/agent", response_model=AgentResponse)
def agent_turn(req: AgentRequest):
    t0 = time.time()
    try:
        st = agent.converse(req.message, req.interface_id, req.history or [])
    except Exception as exc:
        return AgentResponse(
            message=("I hit an error (" + str(exc)[:160] + "). You can still "
                     "pick a template from the Home page or ask me to list them."),
            action="none", interface_id=req.interface_id, intent="chat",
            reasoning="", elapsed_ms=int((time.time() - t0) * 1000))
    return AgentResponse(
        message=st.get("message", ""),
        action=st.get("action", "none"),
        interface_id=st.get("recommend_id") or req.interface_id,
        intent=st.get("intent", "chat"),
        reasoning=st.get("reasoning", ""),
        elapsed_ms=int((time.time() - t0) * 1000),
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8100, reload=False)
