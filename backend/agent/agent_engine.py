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
You are an expert CyberSecurity AI Agent.

CURRENT PLAN:

{agent_plan}

PROJECT KNOWLEDGE:

{project_knowledge}

STRUCTURED KNOWLEDGE:

{json.dumps(structured_knowledge, indent=2)}

USER MEMORY:

{json.dumps(user_memory, indent=2)}

CONVERSATION HISTORY:

{json.dumps(conversation_history, indent=2)}

RETRIEVED SOURCE CODE:

{json.dumps(retrieved_code, indent=2)}

QUESTION:

{question}

Instructions:

- Answer the user question directly and with the appropriate level of structure.
- Answer naturally and directly in complete sentences based on the user question.
- Use headings, tables, and bullet points only when the user explicitly asks for a review, comparison, security analysis, or risk assessment.
- Do not force a report template for every answer.
- For direct or simple questions, answer succinctly in human-readable prose without unnecessary sections.
- If the user explicitly asks for an executive summary, security findings, or risk comparison, then include those sections clearly.
- When the user asks for a table comparison, include a table.
- Avoid adding extra headings or sections that are not relevant to the question.

If the user asks:

"review project"

Generate a structured report using headings and the requested analysis sections. Otherwise, prefer a conversational, human-readable response.
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