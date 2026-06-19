import os
import sys
import asyncio
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Ensure the root directory is in the python path so backend imports resolve cleanly
sys.path.append(str(Path(__file__).resolve().parents[1]))

from backend.agent.agent_engine import ask_agent
from backend.agent.project_state import has_state_changed, get_project_state, save_state
from backend.agent.project_analyzer import analyze_project
from backend.agent.json_analyzer import generate_json_knowledge

# Define paths relative to the root folder based on your workspace layout
APPS_DIR = "apps"
MARKDOWN_FILE = "backend/knowledge/project_knowledge.md"
JSON_FILE = "backend/knowledge/project_knowledge.json"

# Global state tracking flag
IS_UPDATING = False

def run_sync():
    """
    Executes the LLM knowledge base regeneration using atomic file operations.
    The banner stays active explicitly until the caching state maps are saved.
    """
    global IS_UPDATING
    IS_UPDATING = True
    try:
        # 1. Regenerate Markdown knowledge report atomically
        print("→ Running LLM analysis for project_knowledge.md...")
        markdown_report = analyze_project()
        
        temp_md = f"{MARKDOWN_FILE}.tmp"
        with open(temp_md, "w", encoding="utf-8") as f:
            f.write(markdown_report)
        os.replace(temp_md, MARKDOWN_FILE)  # Atomic swap!
        print("✓ Successfully updated project_knowledge.md")

        # 2. Regenerate JSON knowledge schema atomically
        print("→ Running LLM analysis for project_knowledge.json...")
        json_report = generate_json_knowledge()
        
        temp_json = f"{JSON_FILE}.tmp"
        with open(temp_json, "w", encoding="utf-8") as f:
            f.write(json_report)
        os.replace(temp_json, JSON_FILE)  # Atomic swap!
        print("✓ Successfully updated project_knowledge.json")
        
        # 3. Cache the new state map AFTER writing files completely
        new_state = get_project_state(APPS_DIR)
        save_state(new_state)
        print("✅ Knowledge base successfully synchronized.\n")
        
    except Exception as e:
        print(f"❌ Failed to auto-refresh knowledge base: {e}\n")
    finally:
        # Drop the flag here so frontend updates clear only after the success log prints!
        IS_UPDATING = False

async def folder_watcher_daemon():
    """
    Background worker loop that checks the folder every 5 seconds for deletions,
    modifications, or additions while the backend server remains running.
    """
    print("🚀 Background Knowledge Base Watcher Daemon Started.")
    while True:
        try:
            if has_state_changed(APPS_DIR) and not IS_UPDATING:
                print("\n🚨 Folder modification or deletion detected dynamically! Auto-refreshing...")
                # Shift synchronous LLM writes to a worker thread so async requests aren't blocked
                await asyncio.to_thread(run_sync)
        except Exception as e:
            print(f"Watcher error: {e}")
        
        await asyncio.sleep(5)


# --- FastAPI Application Setup ---

app = FastAPI()

@app.on_event("startup")
async def startup_event():
    print("\n🔍 Checking workspace application files on startup...")
    if has_state_changed(APPS_DIR):
        run_sync()
    else:
        print("✅ Knowledge base is initially up to date.\n")
    
    # Fire up the loop task to run concurrently alongside incoming API requests
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
    # Expose state details so the frontend can dynamically know when updates happen
    return {
        "status": "running",
        "is_updating": IS_UPDATING
    }


@app.post("/ask")
def ask(data: Question):
    result = ask_agent(data.question)
    # Pass exact status flag back with response payload metadata
    result["is_updating"] = IS_UPDATING
    return result