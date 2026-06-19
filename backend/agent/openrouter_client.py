import os
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


def _get_openrouter_client():
    api_key = os.getenv("OPENROUTER_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "OPENROUTER_API_KEY or GEMINI_API_KEY environment variable is required"
        )
    return OpenAI(base_url="https://openrouter.ai/api/v1", api_key=api_key)


def create_chat_completion(messages, model, max_tokens=1200, temperature=0.0, **kwargs):
    return client.chat.completions.create(
        messages=messages,
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
        **kwargs,
    )


def _extract_response_text(response):
    if not getattr(response, "choices", None):
        return ""

    choice = response.choices[0]
    message = getattr(choice, "message", None)
    if message is None:
        return ""

    content = getattr(message, "content", None)
    if isinstance(content, str):
        return content

    if content is None:
        return ""

    if isinstance(content, list):
        texts = []
        for item in content:
            item_type = getattr(item, "type", None) if not isinstance(item, dict) else item.get("type")
            if item_type == "text":
                text = getattr(item, "text", None) if not isinstance(item, dict) else item.get("text")
                if text:
                    texts.append(text)
        return "".join(texts).strip()

    return str(content)


client = _get_openrouter_client()
