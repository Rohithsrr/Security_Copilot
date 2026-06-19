import os
import json

STATE_FILE = "backend/knowledge/project_state.json"

def get_project_state(apps_dir):
    """Scans the applications directory and returns a dictionary of file names and modification times."""
    state = {}
    if not os.path.exists(apps_dir):
        return state

    for file_name in os.listdir(apps_dir):
        path = os.path.join(apps_dir, file_name)
        if os.path.isfile(path):
            state[file_name] = os.path.getmtime(path)

    return state

def save_state(state):
    """Saves the current project state to the JSON file."""
    os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)

def load_state():
    """Loads the previously saved project state."""
    if not os.path.exists(STATE_FILE):
        return {}
    with open(STATE_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def has_state_changed(apps_dir):
    """Compares the current disk state against the saved state to check for modifications or additions."""
    current_state = get_project_state(apps_dir)
    saved_state = load_state()
    return current_state != saved_state