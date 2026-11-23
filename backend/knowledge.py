"""Knowledge base for the agent.

Grounds the LLM so it can answer Copilot-style questions about the whole
application: what it does, which templates exist, what sections/fields each
template needs, and how the build flow works. Nothing here is invented at
runtime by the model — it all derives from catalog.json + these facts.
"""
from typing import Dict, List

import catalog

APP_FACTS = """
MFT Automation Studio is an internal Southern California Edison (SCE) tool that
generates IBM Sterling Integrator (SI) artifacts: Business Process (BPML),
SI import XML, and XSLT configuration blocks (RULEID, PROCNAME, ROUTERULE,
SYSTEM, EDIPROCESS, ERRORMAIL, EDIMAIL, EXTRACT, PROC_NAME).

Core ideas:
- Users pick an interface (or describe it to the AI), fill a short form, and
  download a deployment-ready package.
- Artifacts are ALWAYS produced from approved templates, never invented by an LLM.
- Interfaces are grouped into "Generic transfers" and "EDI".
- EDI interfaces ALSO carry trading-partner ENVELOPE segments (ISA/IEA
  interchange, GS/GE functional group, ST/SE transaction set) read from the
  interface's EDI export XML. When building an EDI interface the assistant asks
  for every envelope value a developer must set in Sterling (Sender ID,
  Receiver ID, Control number, qualifiers, functional/version codes, map name,
  acknowledgement and validation flags) and regenerates the importable envelope
  XML alongside the route rules, XSLT config blocks and EDI process params.
- Tools in the app: Home (interface cards), AI Assistant (this chat),
  Templates (view/edit template text), Import XSLT block (reverse a pasted
  block into the form), Mailbox analysis, Run self-test, Access accounts.

The AI Assistant workflow is step-by-step like the form wizard:
1. Ask what process to generate.
2. Recommend the correct approved template (RAG + classification).
3. Walk each SECTION in order: Business Process first, then every config block
   (e.g. SFTP Get config, Error e-mail, Success e-mail, EDI process params),
   asking for ALL fields of that section.
4. Validate, then generate the artifacts.
"""


def interfaces_overview() -> List[dict]:
    out = []
    for i in catalog.interfaces():
        out.append({
            "id": i["id"],
            "title": i["title"],
            "category": i["category"],
            "description": i["description"],
            "blocks": i.get("blocks", []),
        })
    return out


def templates_markdown() -> str:
    """A compact, human-readable catalog listing grouped by category."""
    groups: Dict[str, List[dict]] = {}
    for i in catalog.interfaces():
        groups.setdefault(i["category"], []).append(i)
    lines = []
    for cat, items in groups.items():
        lines.append(f"**{cat}**")
        for i in items:
            lines.append(f"- **{i['title']}** (`{i['id']}`) — {i['description']}")
        lines.append("")
    return "\n".join(lines).strip()


def knowledge_blob() -> str:
    """Everything the LLM needs to answer app/template questions."""
    return APP_FACTS + "\n\nInterfaces:\n" + templates_markdown()
