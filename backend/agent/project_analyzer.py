import asyncio
from backend.agent.openrouter_client import client, _extract_response_text
from backend.scanner.file_scanner import build_project_context

async def analyze_project_async():
    """Asynchronously generates the markdown report."""
    project_context = build_project_context()
    prompt = f"""
You are a senior Security Architect.
Analyze the following project source code and create a detailed knowledge base containing:
# Applications, # Authentication, # Authorization, # RBAC Roles, # Protected Resources, # Security Risks, # Authentication Flow, # Authorization Flow, # Architecture Summary, # Security Recommendations.
Project Source Code:
{project_context}
Return a detailed markdown report.
"""
    # Run the synchronous OpenRouter/OpenAI client call inside a non-blocking thread pool
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
    return _extract_response_text(response)