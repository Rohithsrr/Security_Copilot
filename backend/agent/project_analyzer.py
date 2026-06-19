from backend.agent.openrouter_client import create_chat_completion, _extract_response_text
from backend.scanner.file_scanner import build_project_context


def analyze_project():

    project_context = build_project_context()

    prompt = f"""
You are a senior Security Architect.

Analyze the following project source code.

Create a detailed knowledge base containing:

# Applications
# Authentication
# Authorization
# RBAC Roles
# Protected Resources
# Security Risks
# Authentication Flow
# Authorization Flow
# Architecture Summary
# Security Recommendations

Project Source Code:

{project_context}

Return a detailed markdown report.
"""

    response = create_chat_completion(
        messages=[{"role": "user", "content": prompt}],
        model="openai/gpt-oss-120b:free",
        max_tokens=1200,
    )

    return _extract_response_text(response)