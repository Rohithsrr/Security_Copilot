import json
import os

CONVERSATION_FILE = (
    "backend/memory/conversation_history.json"
)


def load_history():

    if not os.path.exists(
        CONVERSATION_FILE
    ):
        return []

    try:

        with open(
            CONVERSATION_FILE,
            "r",
            encoding="utf-8"
        ) as f:

            return json.load(f)

    except Exception:

        return []


def save_history(history):

    with open(
        CONVERSATION_FILE,
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            history,
            f,
            indent=2
        )


def add_exchange(
    question,
    answer
):

    history = load_history()

    history.append({
        "question": question,
        "answer": answer
    })

    history = history[-10:]

    save_history(history)


def get_recent_history():

    return load_history()