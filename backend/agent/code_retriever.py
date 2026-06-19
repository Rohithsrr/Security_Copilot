from backend.scanner.file_scanner import scan_apps


def retrieve_code(question):

    files = scan_apps()

    keywords = []

    q = question.lower()

    if "admin" in q:
        keywords.append("admin")

    if "analyst" in q:
        keywords.append("analyst")

    if "user" in q:
        keywords.append("user")

    if "rbac" in q:
        keywords.append("applyrbac")

    if "okta" in q:
        keywords.append("okta")

    if "entra" in q:
        keywords.append("msal")

    if "login" in q:
        keywords.append("login")

    if "session" in q:
        keywords.append("sessionstorage")

    results = []

    for file in files:

        lines = file["content"].splitlines()

        for line_no, line in enumerate(
            lines,
            start=1
        ):

            for keyword in keywords:

                if keyword in line.lower():

                    results.append({
                        "file": file["file"],
                        "line": line_no,
                        "code": line.strip()
                    })

    return results[:30]