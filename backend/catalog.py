"""Template catalog + retrieval.

Two retrieval modes:
  * Azure AI Search (if AZURE_SEARCH_* configured) — semantic search over indexed docs.
  * Local retriever (default) — fast keyword/overlap scoring over catalog.json.

The catalog is the single source of truth for what the AI is allowed to
recommend. The LLM never invents interfaces or fields outside this list.
"""
import json
import os
import re
from functools import lru_cache
from typing import Dict, List, Optional

import config

_CATALOG_PATH = os.path.join(os.path.dirname(__file__), "catalog.json")


@lru_cache(maxsize=1)
def load_catalog() -> dict:
    with open(_CATALOG_PATH, "r", encoding="utf-8") as fh:
        return json.load(fh)


def interfaces() -> List[dict]:
    return load_catalog()["interfaces"]


def get_interface(iface_id: str) -> Optional[dict]:
    for i in interfaces():
        if i["id"] == iface_id:
            return i
    return None


def compact_catalog() -> List[dict]:
    """Small, token-cheap view used for classification prompts (<3s)."""
    return [
        {
            "id": i["id"],
            "title": i["title"],
            "category": i["category"],
            "description": i["description"],
            "keywords": i.get("keywords", []),
        }
        for i in interfaces()
    ]


_WORD = re.compile(r"[a-z0-9]+")


def _tokens(text: str) -> List[str]:
    return _WORD.findall((text or "").lower())


def local_search(query: str, top_k: int = 4) -> List[dict]:
    """Lightweight keyword-overlap retriever. Returns scored interface hits."""
    q = set(_tokens(query))
    scored = []
    for i in interfaces():
        hay = " ".join([
            i["title"], i["description"], i["category"],
            " ".join(i.get("keywords", [])),
        ])
        toks = _tokens(hay)
        bag = set(toks)
        overlap = len(q & bag)
        # Boost exact keyword phrase and EDI code matches.
        boost = 0
        ql = query.lower()
        for kw in i.get("keywords", []):
            if kw.lower() in ql:
                boost += 3
        for code in re.findall(r"\b\d{3}\b", ql):
            if code in i["title"] or code in " ".join(i.get("keywords", [])):
                boost += 5
        score = overlap + boost
        if score:
            scored.append({"id": i["id"], "title": i["title"],
                           "score": score, "description": i["description"]})
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:top_k]


def azure_search(query: str, top_k: int = 4) -> List[dict]:
    """Optional Azure AI Search retrieval. Falls back to local on any error."""
    try:
        from azure.core.credentials import AzureKeyCredential
        from azure.search.documents import SearchClient

        client = SearchClient(
            endpoint=config.SEARCH_ENDPOINT,
            index_name=config.SEARCH_INDEX,
            credential=AzureKeyCredential(config.SEARCH_KEY),
        )
        results = client.search(search_text=query, top=top_k)
        hits = []
        for r in results:
            hits.append({
                "id": r.get("id"),
                "title": r.get("title"),
                "score": r.get("@search.score", 0),
                "description": r.get("description", ""),
            })
        return hits or local_search(query, top_k)
    except Exception:
        return local_search(query, top_k)


def retrieve(query: str, top_k: int = 4) -> List[dict]:
    if config.USE_AZURE_SEARCH:
        return azure_search(query, top_k)
    return local_search(query, top_k)


def missing_fields(iface_id: str, collected: Dict[str, str]) -> List[dict]:
    iface = get_interface(iface_id)
    if not iface:
        return []
    out = []
    for f in iface.get("required", []):
        val = collected.get(f["key"])
        if val is None or str(val).strip() == "":
            out.append(f)
    return out
