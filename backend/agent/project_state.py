import os
import json
import hashlib

STATE_FILE = "backend/knowledge/project_state.json"

def calculate_file_hash(filepath):
    """Calculates the MD5 hash of a file's content to ensure accurate tracking on ephemeral file systems."""
    hasher = hashlib.md5()
    try:
        with open(filepath, "rb") as f:
            buf = f.read()
            hasher.update(buf)
        return hasher.hexdigest()
    except Exception:
        return ""

def get_project_state(apps_dir):
    """Scans the applications directory and returns a dictionary of file names and content hashes."""
    state = {}
    if not os.path.exists(apps_dir):
        return state

    for file_name in os.listdir(apps_dir):
        path = os.path.join(apps_dir, file_name)
        if os.path.isfile(path):
            state[file_name] = calculate_file_hash(path)

    return state

def save_state(state):
    """Saves the current project state hash mapping to the JSON file."""
    os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)

def load_state():
    """Loads the previously saved project state hash mapping."""
    if not os.path.exists(STATE_FILE):
        return {}
    with open(STATE_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def has_state_changed(apps_dir):
    """Compares the current disk state against the saved state using content hashes."""
    current_state = get_project_state(apps_dir)
    saved_state = load_state()
    
    # If no saved state exists on a fresh container boot, seed it instead of triggering a loop
    if not saved_state and current_state:
        save_state(current_state)
        return False
        
    return current_state != saved_state