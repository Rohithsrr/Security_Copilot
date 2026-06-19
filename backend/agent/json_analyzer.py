import json
import re

from backend.agent.openrouter_client import create_chat_completion, _extract_response_text
from backend.scanner.file_scanner import build_project_context


def generate_json_knowledge():

    project_context = build_project_context()

    prompt = f"""
Analyze this project.

Return ONLY valid JSON.

Format:

{{
  "applications": [],
  "authentication": [],
  "authorization": [],
  "roles": [],
  "risks": [],
  "recommendations": []
}}

Project Source Code:

{project_context}
"""

    response = create_chat_completion(
        messages=[{"role": "user", "content": prompt}],
        model="openai/gpt-oss-120b:free",
        max_tokens=1200,
    )

    text = _extract_response_text(response).strip()

    text = re.sub(
        r"^```json",
        "",
        text,
        flags=re.MULTILINE
    )

    text = re.sub(
        r"```$",
        "",
        text,
        flags=re.MULTILINE
    )

    try:
        parsed = json.loads(text)

        return json.dumps(
            parsed,
            indent=2
        )

    except Exception:

        fallback = {
            "applications": [],
            "authentication": [],
            "authorization": [],
            "roles": [],
            "risks": [],
            "recommendations": [],
            "error": "OpenRouter returned invalid JSON"
        }

        return json.dumps(
            fallback,
            indent=2
        )