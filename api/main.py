import os
import sys
import asyncio
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

sys.path.append(str(Path(__file__).resolve().parents[1]))

from backend.agent.agent_engine import ask_agent
from backend.agent.project_state import has_state_changed, get_project_state, save_state
from backend.agent.project_analyzer import analyze_project_async
from backend.agent.json_analyzer import generate_json_knowledge_async

APPS_DIR = "apps"
MARKDOWN_FILE = "backend/knowledge/project_knowledge.md"
JSON_FILE = "backend/knowledge/project_knowledge.json"

IS_UPDATING = False

async def run_sync_concurrently():
    """
    Runs both Markdown and JSON LLM regenerations at the same time in parallel.
    Saves massive execution times on live servers.
    """
    global IS_UPDATING
    IS_UPDATING = True
    print("⚡ Starting Parallel Knowledge Base Update...")
    try:
        # Run both tasks concurrently
        markdown_task = analyze_project_async()
        json_task = generate_json_knowledge_async()
        
        markdown_report, json_report = await asyncio.gather(markdown_task, json_task)

        # Atomic markdown file swap
        temp_md = f"{MARKDOWN_FILE}.tmp"
        with open(temp_md, "w", encoding="utf-8") as f:
            f.write(markdown_report)
        os.replace(temp_md, MARKDOWN_FILE)

        # Atomic json file swap
        temp_json = f"{JSON_FILE}.tmp"
        with open(temp_json, "w", encoding="utf-8") as f:
            f.write(json_report)
        os.replace(temp_json, JSON_FILE)

        # Cache new state
        new_state = get_project_state(APPS_DIR)
        save_state(new_state)
        print("✅ Parallel synchronization complete.\n")
    except Exception as e:
        print(f"❌ Error during parallel refresh: {e}\n")
    finally:
        IS_UPDATING = False

async def folder_watcher_daemon():
    """Background loop watcher that triggers non-blocking parallel syncing."""
    print("🚀 Background Knowledge Base Watcher Daemon Active.")
    while True:
        try:
            # Check for additions/deletions every 5 seconds without blocking user traffic
            if has_state_changed(APPS_DIR) and not IS_UPDATING:
                print("\n🚨 Workspace alterations detected! Auto-refreshing parallel maps...")
                asyncio.create_task(run_sync_concurrently())
        except Exception as e:
            print(f"Watcher background failure: {e}")
        await asyncio.sleep(5)


# --- FastAPI Implementation ---

app = FastAPI()

@app.on_event("startup")
async def startup_event():
    # Check on startup. If out of sync, trigger non-blocking task so server starts instantly
    if has_state_changed(APPS_DIR):
        asyncio.create_task(run_sync_concurrently())
    else:
        print("✅ Knowledge base is initially up to date.\n")
    asyncio.create_task(folder_watcher_daemon())

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

class Question(BaseModel):
    question: str

@app.get("/")
def root():
    return {"status": "running", "is_updating": IS_UPDATING}

@app.post("/ask")
def ask(data: Question):
    # This remains clean and lightning fast because the background loops don't touch it
    result = ask_agent(data.question)
    result["is_updating"] = IS_UPDATING
    return result