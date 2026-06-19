import os
import json

BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.dirname(__file__)
    )
)

APPS_DIR = os.path.join(
    BASE_DIR,
    "apps"
)


def scan_apps():

    files_data = []

    for file_name in os.listdir(APPS_DIR):

        file_path = os.path.join(
            APPS_DIR,
            file_name
        )

        if os.path.isfile(file_path):

            try:

                with open(
                    file_path,
                    "r",
                    encoding="utf-8"
                ) as f:

                    content = f.read()

                files_data.append({
                    "file": file_name,
                    "path": file_path,
                    "size": len(content),
                    "content": content
                })

            except Exception as e:

                print(
                    f"Error reading {file_name}: {e}"
                )

    return files_data


def build_project_context():

    files = scan_apps()

    context = ""

    for file in files:

        context += (
            f"\n\n===== FILE: {file['file']} =====\n\n"
        )

        context += file["content"]

    return context


if __name__ == "__main__":

    print(
        json.dumps(
            scan_apps(),
            indent=2
        )
    )