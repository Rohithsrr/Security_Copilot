import json
import re
import asyncio
from backend.agent.openrouter_client import client, _extract_response_text
from backend.scanner.file_scanner import build_project_context

async def generate_json_knowledge_async():
    """Asynchronously generates the structured JSON knowledge base."""
    project_context = build_project_context()
    prompt = f"""
Analyze this project. Return ONLY valid JSON.
Format:
{{
  "applications": [], "authentication": [], "authorization": [], "roles": [], "risks": [], "recommendations": []
}}
Project Source Code:
{project_context}
"""
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None,
        lambda: client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="openai/gpt-oss-120b:free",
            max_tokens=1200,
            temperature=0.0
        )
    )
    text = _extract_response_text(response).strip()
    text = re.sub(r"^```json", "", text, flags=re.MULTILINE)
    text = re.sub(r"```$", "", text, flags=re.MULTILINE)

    try:
        parsed = json.loads(text)
        return json.dumps(parsed, indent=2)
    except Exception:
        fallback = {
            "applications": [], "authentication": [], "authorization": [],
            "roles": [], "risks": [], "recommendations": [], "error": "Invalid JSON mapping"
        }
        return json.dumps(fallback, indent=2)