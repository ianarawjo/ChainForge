from typing import List, Dict, Any, Union
from chainforge.providers import provider

@provider(
    name="Levenshtein Retriever",
    emoji="🔢",
    models=[],
    rate_limit="sequential",
    settings_schema={
        "settings": {
            "top_k": {
                "type": "integer",
                "title": "Top‑K",
                "default": 5,
                "minimum": 1
            }
        }
    },
    category="retriever"
)
def LevenshteinRetriever(
    chunks: List[Dict[str, Any]],
    queries: List[Union[str, Dict[str, Any]]],
    settings: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """
    For each query (which may be a str or a dict), compute Levenshtein
    distance against each chunk, returning the top‑K matches.
    """
    # Simple DP edit‑distance
    def lev(a: str, b: str) -> int:
        m, n = len(a), len(b)
        dp = [[0]*(n+1) for _ in range(m+1)]
        for i in range(m+1): dp[i][0] = i
        for j in range(n+1): dp[0][j] = j
        for i in range(1, m+1):
            for j in range(1, n+1):
                cost = 0 if a[i-1]==b[j-1] else 1
                dp[i][j] = min(
                    dp[i-1][j] + 1,
                    dp[i][j-1] + 1,
                    dp[i-1][j-1] + cost
                )
        return dp[m][n]

    top_k = settings.get("top_k", 5)
    results: List[Dict[str, Any]] = []

    for q in queries:
        # normalize query into a dict with a "text" field
        if isinstance(q, dict):
            prompt = q.get("text") or q.get("query") or ""
            query_obj = {**q, "text": prompt}
        else:
            prompt = str(q)
            query_obj = {"text": prompt}

        low = prompt.lower()
        # score each chunk
        scored: List[tuple] = []
        for chunk in chunks:
            text = chunk.get("text", "")
            dist = lev(low, text.lower())
            scored.append((chunk, dist))

        # pick top_k by smallest distance
        scored.sort(key=lambda x: x[1])
        top = scored[:top_k]

        # build retrieved_chunks
        retrieved = []
        for rank, (chunk, dist) in enumerate(top, start=1):
            max_len = max(len(prompt), len(chunk.get("text","")), 1)
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
