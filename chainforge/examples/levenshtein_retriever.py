from typing import List, Dict, Any, Union
from chainforge.providers import provider

@provider(
    name="Levenshtein Retriever",
    emoji="🔢",
    models=[],
    rate_limit="sequential",
    settings_schema={
        "settings": {
            "top_k": {"type": "integer", "title": "Top K", "default": 5, "minimum": 1}
        },
        "ui": {
            "top_k": {"ui:widget": "range"},
        }
    },
    category="retriever"
)
def LevenshteinRetriever(
    chunks: List[Dict[str, Any]],
    queries: List[Union[str, Dict[str, Any]]],
    settings: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """Return top-K chunks per query using plain Levenshtein distance."""

    def lev(a: str, b: str) -> int:
        m, n = len(a), len(b)
        dp = [[0]*(n+1) for _ in range(m+1)]
        for i in range(m+1): dp[i][0] = i
        for j in range(n+1): dp[0][j] = j
        for i in range(1, m+1):
            ai = a[i-1]
            for j in range(1, n+1):
                cost = 0 if ai == b[j-1] else 1
                dp[i][j] = min(
                    dp[i-1][j] + 1,      # deletion
                    dp[i][j-1] + 1,      # insertion
                    dp[i-1][j-1] + cost  # substitution
                )
        return dp[m][n]

    # 1) Coerce & clamp Top-K
    try:
        top_k = int(settings.get("top_k", 5))
    except (TypeError, ValueError):
        top_k = 5
    if top_k < 1:
        top_k = 1

    results: List[Dict[str, Any]] = []

    for q in queries:
        # normalize to dict with a "text" field, preserving extra keys
        if isinstance(q, dict):
            prompt = q.get("text") or q.get("query") or ""
            query_obj = {**q, "text": prompt}
        else:
            prompt = str(q)
            query_obj = {"text": prompt}

        q_low = prompt.lower()

        # score each chunk
        scored: List[tuple] = []
        for chunk in chunks:
            text = chunk.get("text", "")
            dist = lev(q_low, text.lower())
            scored.append((chunk, dist))

        # 2) Stable sort: primary by distance, secondary by chunkId (optional)
        scored.sort(key=lambda x: (x[1], str(x[0].get("chunkId", ""))))
        top = scored[:top_k]

        retrieved = []
        for _, (chunk, dist) in enumerate(top, start=1):
            max_len = max(len(prompt), len(chunk.get("text", "")), 1)
            sim = 1 - dist / max_len
            retrieved.append({
                "text":         chunk.get("text", ""),
                "similarity":   sim,
                "docTitle":     chunk.get("docTitle", ""),
                "chunkId":      chunk.get("chunkId", ""),
                "chunkLibrary": chunk.get("chunkLibrary", "")
            })

        results.append({
            "query_object":     query_obj,
            "retrieved_chunks": retrieved
        })

    return results
