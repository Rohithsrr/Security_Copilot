# sync_knowledge.py
import os
import time
from backend.scanner.project_state import has_state_changed, get_project_state, save_state
from backend.agent.project_analyzer import analyze_project
from backend.agent.json_analyzer import generate_json_knowledge

# Define the path where your frontend application HTML files live
APPS_DIR = "apps"  # Update this path to match your actual frontend files directory
MARKDOWN_FILE = "backend/knowledge/project_knowledge.md"
JSON_FILE = "backend/knowledge/project_knowledge.json"

def check_and_refresh():
    """
    Checks if any files have been added, removed, or modified.
    If changes are detected, regenerates the Markdown and JSON knowledge bases automatically.
    """
    print("Checking project files for updates...")
    
    if has_state_changed(APPS_DIR):
        print("🚨 New application or structural change detected! Auto-refreshing knowledge base...")
        
        try:
            # 1. Generate updated Markdown Knowledge Base
            print("Generating project_knowledge.md via LLM...")
            markdown_report = analyze_project()
            os.makedirs(os.path.dirname(MARKDOWN_FILE), exist_ok=True)
            with open(MARKDOWN_FILE, "w", encoding="utf-8") as f:
                f.write(markdown_report)
            print("Successfully updated project_knowledge.md")

            # 2. Generate updated JSON Knowledge Base
            print("Generating project_knowledge.json via LLM...")
            json_report = generate_json_knowledge()
            with open(JSON_FILE, "w", encoding="utf-8") as f:
                f.write(json_report)
            print("Successfully updated project_knowledge.json")
            
            # 3. Save new state to prevent infinite loops
            new_state = get_project_state(APPS_DIR)
            save_state(new_state)
            print("✅ Knowledge base synchronization complete.")
            
        except Exception as e:
            print(f"❌ Error during auto-refresh: {e}")
    else:
        print("Static state confirmed. No changes detected.")

if __name__ == "__main__":
    # Ensure directories exist
    os.makedirs(APPS_DIR, exist_ok=True)
    
    print(f"Starting Knowledge Base Sync Daemon watching: {APPS_DIR}")
    # Continuous background polling loop (Interval: Every 10 seconds)
    while True:
        check_and_refresh()
        time.sleep(10)