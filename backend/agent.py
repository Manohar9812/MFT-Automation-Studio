"""LangGraph agent for MFT Automation Studio.

Design goals:
  * <3s responses -> at most ONE LLM call per turn.
  * Never invent artifacts. The LLM only (a) picks an approved interface and
    (b) extracts values for approved fields. Generation happens in the frontend
    template engine.

Graph:
    START
      -> recommend   (only when no interface chosen yet; RAG + 1 LLM call)
      -> extract     (when interface chosen; 1 LLM call to pull field values)
      -> validate    (deterministic: compute missing required fields)
      -> respond     (deterministic: craft the reply / next question)
    END
"""
import json
from functools import lru_cache
from typing import Dict, List, Optional, TypedDict

from langchain_openai import AzureChatOpenAI
from langgraph.graph import END, START, StateGraph

import catalog
import config


@lru_cache(maxsize=1)
def get_llm() -> AzureChatOpenAI:
    return AzureChatOpenAI(
        azure_endpoint=config.OPENAI_ENDPOINT,
        api_key=config.OPENAI_API_KEY,
        azure_deployment=config.OPENAI_DEPLOYMENT,
        api_version=config.OPENAI_VERSION,
        temperature=0,
        max_retries=1,
        timeout=20,
        model_kwargs={"response_format": {"type": "json_object"}},
    )


def _parse_json(text: str) -> dict:
    try:
        return json.loads(text)
    except Exception:
        start, end = text.find("{"), text.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(text[start:end + 1])
            except Exception:
                pass
    return {}


class AgentState(TypedDict, total=False):
    user_text: str
    history: List[dict]
    interface_id: Optional[str]
    collected: Dict[str, str]
    candidates: List[dict]
    reasoning: str
    missing: List[dict]
    ready: bool
    response: str


# --------------------------------------------------------------------- nodes
def node_recommend(state: AgentState) -> AgentState:
    """RAG retrieve + classify into an approved interface."""
    query = state["user_text"]
    candidates = catalog.retrieve(query, top_k=5)
    state["candidates"] = candidates

    llm = get_llm()
    compact = catalog.compact_catalog()
    sys = (
        "You are an IBM Sterling Integrator integration architect. "
        "Pick the single best matching interface for the user's requirement "
        "ONLY from the provided catalog. Never invent an interface id. "
        "Also extract any field values the user already mentioned, mapping them "
        "to the required field keys of the chosen interface. "
        "Respond as JSON: {\"interface_id\": str, \"confidence\": 0..1, "
        "\"reasoning\": str, \"fields\": {key: value}}."
    )
    chosen_fields_hint = {i["id"]: [f["key"] for f in i.get("required", [])]
                          for i in catalog.interfaces()}
    user = json.dumps({
        "requirement": query,
        "catalog": compact,
        "rag_candidates": candidates,
        "field_keys_per_interface": chosen_fields_hint,
    })
    out = _parse_json(llm.invoke(
        [("system", sys), ("human", user)]).content)

    iface_id = out.get("interface_id")
    if not catalog.get_interface(iface_id):
        iface_id = candidates[0]["id"] if candidates else None
    state["interface_id"] = iface_id
    state["reasoning"] = out.get("reasoning", "")
    collected = dict(state.get("collected") or {})
    for k, v in (out.get("fields") or {}).items():
        if v not in (None, "", []):
            collected[k] = v
    state["collected"] = collected
    return state


def node_extract(state: AgentState) -> AgentState:
    """Pull field values from the latest user message for the chosen interface."""
    iface = catalog.get_interface(state["interface_id"])
    if not iface:
        return state
    llm = get_llm()
    sys = (
        "Extract configuration values from the user's message for an IBM "
        "Sterling Integrator interface. Only use the provided field keys. "
        "If the user did not provide a value for a field, omit it. "
        "Respond as JSON: {\"fields\": {key: value}}."
    )
    user = json.dumps({
        "interface": iface["title"],
        "fields": iface.get("required", []),
        "already_collected": state.get("collected", {}),
        "message": state["user_text"],
    })
    out = _parse_json(llm.invoke(
        [("system", sys), ("human", user)]).content)
    collected = dict(state.get("collected") or {})
    for k, v in (out.get("fields") or {}).items():
        if v not in (None, "", []):
            collected[k] = v
    state["collected"] = collected
    return state


def node_validate(state: AgentState) -> AgentState:
    iface_id = state.get("interface_id")
    collected = state.get("collected", {})
    missing = catalog.missing_fields(iface_id, collected) if iface_id else []
    state["missing"] = missing
    state["ready"] = bool(iface_id) and len(missing) == 0
    return state


def node_respond(state: AgentState) -> AgentState:
    iface = catalog.get_interface(state.get("interface_id"))
    if not iface:
        state["response"] = (
            "I couldn't match that to an approved template. Could you describe "
            "the source and target (e.g. 'pull files from an SFTP server to the "
            "file system', or 'outbound EDI 810 invoice')?")
        return state

    missing = state.get("missing", [])
    if state.get("ready"):
        state["response"] = (
            f"\u2705 All set for **{iface['title']}**. "
            f"I have everything needed — click *Generate* to build the "
            f"approved artifacts, or review the values first.")
        return state

    nxt = missing[0]
    others = [m["key"] for m in missing[1:]]
    reason = state.get("reasoning")
    lead = (f"Recommended template: **{iface['title']}** \u2014 {reason}\n\n"
            if reason else "")
    more = (f"\n\n_Still needed after this: {', '.join(others)}_"
            if others else "")
    eg = f" (e.g. `{nxt['example']}`)" if nxt.get("example") else ""
    state["response"] = f"{lead}{nxt['question']}{eg}{more}"
    return state


# --------------------------------------------------------------------- graph
def _entry(state: AgentState) -> str:
    return "extract" if state.get("interface_id") else "recommend"


@lru_cache(maxsize=1)
def build_graph():
    g = StateGraph(AgentState)
    g.add_node("recommend", node_recommend)
    g.add_node("extract", node_extract)
    g.add_node("validate", node_validate)
    g.add_node("respond", node_respond)

    g.add_conditional_edges(START, _entry,
                            {"recommend": "recommend", "extract": "extract"})
    g.add_edge("recommend", "validate")
    g.add_edge("extract", "validate")
    g.add_edge("validate", "respond")
    g.add_edge("respond", END)
    return g.compile()


def run_turn(user_text: str, interface_id: Optional[str],
             collected: Optional[Dict[str, str]]) -> AgentState:
    graph = build_graph()
    state: AgentState = {
        "user_text": user_text,
        "interface_id": interface_id,
        "collected": collected or {},
    }
    return graph.invoke(state)


# =====================================================================
# Section-driven API (mirrors the wizard: classify -> collect each section)
# =====================================================================
def classify_only(user_text: str,
                  collected: Optional[Dict[str, str]] = None) -> dict:
    """Pick the single best approved interface + any obvious prefilled fields."""
    candidates = catalog.retrieve(user_text, top_k=5)
    llm = get_llm()
    compact = catalog.compact_catalog()
    sys = (
        "You are an IBM Sterling Integrator integration architect. "
        "Choose the single best matching interface for the user's requirement "
        "ONLY from the provided catalog. Never invent an interface id. "
        "Respond as JSON: {\"interface_id\": str, \"confidence\": 0..1, "
        "\"reasoning\": str (one short sentence)}."
    )
    user = json.dumps({
        "requirement": user_text,
        "catalog": compact,
        "rag_candidates": candidates,
    })
    out = _parse_json(llm.invoke([("system", sys), ("human", user)]).content)
    iface_id = out.get("interface_id")
    if not catalog.get_interface(iface_id):
        iface_id = candidates[0]["id"] if candidates else None
    return {
        "interface_id": iface_id,
        "reasoning": out.get("reasoning", ""),
        "confidence": out.get("confidence"),
        "candidates": candidates,
    }


def extract_schema(user_text: str, fields: List[dict],
                   already: Optional[Dict[str, str]] = None) -> Dict[str, str]:
    """Extract values for an explicit list of fields from a free-text message.

    fields: [{"key","label","example","yn"(bool)}]
    Returns only the keys the user actually provided.
    """
    if not fields:
        return {}
    llm = get_llm()
    sys = (
        "Extract configuration values from the user's message for one section "
        "of an IBM Sterling Integrator interface. Map natural language to the "
        "correct field key using the provided labels and examples. "
        "ONLY use the given field keys; never invent keys. "
        "If the user did not supply a value for a field, omit it. "
        "For Yes/No fields output exactly 'Yes' or 'No'. "
        "If the user says things like 'use defaults', 'skip', or 'next', return "
        "an empty object. Respond as JSON: {\"fields\": {key: value}}."
    )
    user = json.dumps({
        "fields": fields,
        "already_collected": already or {},
        "message": user_text,
    })
    out = _parse_json(llm.invoke([("system", sys), ("human", user)]).content)
    valid = {f["key"] for f in fields}
    result: Dict[str, str] = {}
    for k, v in (out.get("fields") or {}).items():
        if k in valid and v not in (None, "", []):
            result[k] = v
    return result


# =====================================================================
# Conversational Copilot-style agent (LangGraph intent router)
# =====================================================================
import knowledge  # noqa: E402


class ConvoState(TypedDict, total=False):
    user_text: str
    history: List[dict]
    phase: str                 # idle | building
    interface_id: Optional[str]
    # router outputs
    intent: str                # chat | list_templates | explain | build | cancel
    target_interface: Optional[str]
    # response
    message: str
    action: str                # none | start_build | recommend
    recommend_id: Optional[str]
    reasoning: str


def _route(state: ConvoState) -> ConvoState:
    """One LLM call: classify intent + (if build) pick the interface."""
    llm = get_llm()
    sys = (
        "You are the routing brain of the MFT Automation Studio AI Assistant, "
        "an IBM Sterling Integrator integration copilot for SCE. "
        "Decide the user's intent from this exact set: "
        "'chat' (greeting, help, capability or how-to questions), "
        "'list_templates' (wants the list of available templates/interfaces), "
        "'explain' (asking what a specific template/interface is or needs), "
        "'build' (wants to create/generate an integration/process), "
        "'cancel' (wants to stop/start over). "
        "If intent is 'build' or 'explain', also choose the single best matching "
        "interface id ONLY from the catalog (never invent one). "
        "Respond as JSON: {\"intent\": str, \"interface_id\": str|null, "
        "\"reasoning\": str (one short sentence)}."
    )
    user = json.dumps({
        "message": state["user_text"],
        "currently_building": state.get("interface_id"),
        "catalog": catalog.compact_catalog(),
        "recent_history": (state.get("history") or [])[-4:],
    })
    out = _parse_json(llm.invoke([("system", sys), ("human", user)]).content)
    state["intent"] = out.get("intent", "chat")
    tgt = out.get("interface_id")
    state["target_interface"] = tgt if catalog.get_interface(tgt) else None
    state["reasoning"] = out.get("reasoning", "")
    return state


def _answer_chat(state: ConvoState) -> ConvoState:
    """Grounded free-form answer about the app / templates / how-to."""
    llm = get_llm()
    sys = (
        "You are the MFT Automation Studio AI Assistant, a friendly, precise "
        "IBM Sterling Integrator integration copilot for Southern California "
        "Edison. Answer ONLY using the provided knowledge base about this "
        "application and its approved templates. Be concise and use short "
        "markdown bullets when helpful. If the user seems ready to build, invite "
        "them to describe the integration. Never invent templates, fields, or "
        "Sterling artifacts that are not in the knowledge base. "
        "Respond as JSON: {\"message\": markdown string}."
    )
    user = json.dumps({
        "question": state["user_text"],
        "knowledge": knowledge.knowledge_blob(),
    })
    out = _parse_json(llm.invoke([("system", sys), ("human", user)]).content)
    state["message"] = out.get("message") or "How can I help with your integration?"
    state["action"] = "none"
    return state


def _list_templates(state: ConvoState) -> ConvoState:
    md = knowledge.templates_markdown()
    state["message"] = (
        "Here are all the approved templates you can generate:\n\n" + md +
        "\n\nTell me which one you need, or just describe your integration and "
        "I\u2019ll pick the right template and guide you section by section.")
    state["action"] = "none"
    return state


def _explain(state: ConvoState) -> ConvoState:
    iface = catalog.get_interface(state.get("target_interface"))
    if not iface:
        return _answer_chat(state)
    reqs = iface.get("required", [])
    blocks = iface.get("blocks", [])
    lines = [f"**{iface['title']}** (`{iface['id']}`) \u2014 {iface['description']}"]
    if blocks:
        lines.append("\n**Sections / blocks:** " + ", ".join(blocks))
    if reqs:
        lines.append("\n**Key details I\u2019ll ask for:**")
        for r in reqs:
            eg = f" (e.g. `{r['example']}`)" if r.get("example") else ""
            lines.append(f"- {r.get('question', r['key'])}{eg}")
    lines.append("\nSay *\u201cbuild this\u201d* and I\u2019ll start the step-by-step setup.")
    state["message"] = "\n".join(lines)
    state["action"] = "recommend"
    state["recommend_id"] = iface["id"]
    return state


def _start_build(state: ConvoState) -> ConvoState:
    iface = catalog.get_interface(state.get("target_interface"))
    if not iface:
        state["message"] = (
            "I couldn\u2019t match that to an approved template yet. Could you "
            "describe the **source and target** (e.g. *\u201cSFTP server to the "
            "file system\u201d* or *\u201coutbound EDI 810 invoice\u201d*)?")
        state["action"] = "none"
        return state
    state["message"] = (
        f"Great \u2014 let\u2019s build a **{iface['title']}** integration. "
        + (state.get("reasoning") or "") +
        "\n\nWe\u2019ll go section by section: the Business Process first, then "
        "each configuration block and notification. I\u2019ll ask for every "
        "field in each section.")
    state["action"] = "start_build"
    state["recommend_id"] = iface["id"]
    return state


def _dispatch(state: ConvoState) -> str:
    intent = state.get("intent", "chat")
    if intent == "list_templates":
        return "list"
    if intent == "explain":
        return "explain"
    if intent == "build":
        return "build"
    if intent == "cancel":
        return "chat"
    return "chat"


@lru_cache(maxsize=1)
def build_convo_graph():
    g = StateGraph(ConvoState)
    g.add_node("route", _route)
    g.add_node("chat", _answer_chat)
    g.add_node("list", _list_templates)
    g.add_node("explain", _explain)
    g.add_node("build", _start_build)
    g.add_edge(START, "route")
    g.add_conditional_edges("route", _dispatch, {
        "chat": "chat", "list": "list", "explain": "explain", "build": "build",
    })
    for n in ("chat", "list", "explain", "build"):
        g.add_edge(n, END)
    return g.compile()


def converse(user_text: str, interface_id: Optional[str],
             history: Optional[List[dict]]) -> ConvoState:
    graph = build_convo_graph()
    state: ConvoState = {
        "user_text": user_text,
        "interface_id": interface_id,
        "history": history or [],
    }
    return graph.invoke(state)


