def plan(question):

    q = question.lower()

    if any(word in q for word in [
        "show code",
        "where",
        "implemented",
        "source code",
        "line"
    ]):
        return "code"

    if any(word in q for word in [
        "remember",
        "memory"
    ]):
        return "memory"

    if any(word in q for word in [
        "risk",
        "secure",
        "security",
        "vulnerability",
        "attack"
    ]):
        return "security"

    if any(word in q for word in [
        "role",
        "rbac",
        "admin",
        "analyst",
        "user",
        "permission"
    ]):
        return "rbac"

    if any(word in q for word in [
        "login",
        "authentication",
        "entra",
        "okta",
        "oidc"
    ]):
        return "authentication"

    return "general"