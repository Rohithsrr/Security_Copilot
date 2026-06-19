import json
import os

MEMORY_FILE = "backend/memory/user_memory.json"


def load_memory():

    if not os.path.exists(MEMORY_FILE):

        return {
            "notes": []
        }

    try:

        with open(
            MEMORY_FILE,
            "r",
            encoding="utf-8"
        ) as f:

            content = f.read().strip()

            if not content:

                return {
                    "notes": []
                }

            return json.loads(content)

    except Exception:

        return {
            "notes": []
        }


def save_memory(memory):

    os.makedirs(
        "backend/memory",
        exist_ok=True
    )

    with open(
        MEMORY_FILE,
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            memory,
            f,
            indent=2
        )


def add_note(note):

    memory = load_memory()

    memory["notes"].append(note)

    save_memory(memory)


def get_notes():

    memory = load_memory()

    return memory["notes"]