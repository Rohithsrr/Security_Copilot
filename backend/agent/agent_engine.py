import json

from backend.agent.openrouter_client import (
    client,
    _extract_response_text,
    create_chat_completion,
)
from backend.agent.planner import plan
from backend.agent.code_retriever import retrieve_code
from backend.memory.memory_manager import get_notes
from backend.memory.conversation_memory import (
    add_exchange,
    get_recent_history,
)
from openai import OpenAIError

MARKDOWN_FILE = "backend/knowledge/project_knowledge.md"
JSON_FILE = "backend/knowledge/project_knowledge.json"


def ask_agent(question):

    with open(
        MARKDOWN_FILE,
        "r",
        encoding="utf-8"
    ) as f:

        project_knowledge = f.read()

    with open(
        JSON_FILE,
        "r",
        encoding="utf-8"
    ) as f:

        structured_knowledge = json.load(f)

    user_memory = get_notes()

    conversation_history = (
        get_recent_history()
    )

    agent_plan = plan(question)

    retrieved_code = []

    if agent_plan == "code":

        retrieved_code = retrieve_code(
            question
        )

    prompt = f"""
You are an elite, specialized Cybersecurity Expert, Application Security Engineer, and Senior Security Architect. 
Your purpose is to evaluate application codebases, architectures, and identity models for vulnerabilities, structural flaws, and compliance risks across any application vertical.

CURRENT WORKSPACE PLAN:
{agent_plan}

INGESTED SOURCE REPORT KNOWLEDGE BASE (MARKDOWN):
{project_knowledge}

INGESTED SOURCE SCHEMA STRUCTURAL KNOWLEDGE (JSON):
{json.dumps(structured_knowledge, indent=2)}

USER PERSISTENT COGNITIVE MEMORY:
{json.dumps(user_memory, indent=2)}

CONVERSATION HISTORY TEMPORAL CONTEXT:
{json.dumps(conversation_history, indent=2)}

RELEVANT TARGET SOURCE CODE FRAGMENTS:
{json.dumps(retrieved_code, indent=2)}

USER SECURITY QUESTION:
{question}

Instructions:
- Answer the user question strictly through the lens of offensive/defensive cybersecurity engineering.
- Use explicit technical documentation standards (headings, tables, bulleted parameters, and annotated code snippets) when evaluating access models, authentication configurations, logic controls, or code vulnerabilities.
- Tailor your tone to be precise, advisory, and human-readable prose without rendering redundant sections for lightweight queries.
- When vulnerabilities are brought up, classify their technical root cause utilizing standardized industry references such as the OWASP Top 10 or specific CWE identifiers.
- Ensure that remediation examples focus on defensive architectural shifts (e.g., cryptographic validation, server-side parameter sanitization, token claims verification) rather than client-side cosmetics.

If the user explicitly triggers the query "review project", generate a full security audit report adhering to this structural layout:
# Executive Summary
# Authentication Review
# Authorization Review
# RBAC Review
# Top Risks
# Recommendations
# Final Security Score
"""

    try:
        response = create_chat_completion(
            messages=[{"role": "user", "content": prompt}],
            model="openai/gpt-oss-120b:free",
            max_tokens=1200,
        )
        answer = _extract_response_text(response)
    except OpenAIError as exc:
        answer = f"AI service error: {exc}"

    add_exchange(
        question,
        answer
    )

    return {
        "answer": answer,
        "plan": agent_plan
    }