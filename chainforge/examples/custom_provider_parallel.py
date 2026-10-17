"""Optional web evidence provider. See parallel-search.md for setup and usage."""

from chainforge.providers import provider


@provider(name="Parallel Web Search", emoji="🔎", rate_limit="sequential")
class ParallelWebSearch:
    """Return web search excerpts and source URLs, rather than an LLM answer."""

    def __init__(self):
        import uuid

        # Reuse one identifier across searches until this script is reloaded.
        self.session_id = str(uuid.uuid4())
        self.timeout_seconds = 60

    def __call__(self, prompt: str, chat_history=None, images=None, **kwargs) -> str:
        import asyncio

        if not isinstance(prompt, str) or not prompt.strip():
            raise ValueError("Enter a non-empty web search query.")
        if chat_history or images:
            raise ValueError("Parallel Web Search accepts text queries only; use a Prompt node without chat history or images.")

        try:
            return asyncio.run(asyncio.wait_for(self._search(prompt), self.timeout_seconds))
        except asyncio.TimeoutError:
            raise TimeoutError(
                f"Parallel web search timed out after {self.timeout_seconds} seconds."
            ) from None

    async def _search(self, prompt: str) -> str:
        from datetime import timedelta

        import httpx
        from mcp import ClientSession
        from mcp.client.streamable_http import streamable_http_client

        async with httpx.AsyncClient(
            headers={
                "User-Agent": "ChainForge-Parallel-Example/1.0 (https://github.com/ianarawjo/ChainForge)"
            },
            timeout=self.timeout_seconds,
        ) as client:
            async with streamable_http_client(
                "https://search.parallel.ai/mcp", http_client=client
            ) as (read, write, _):
                async with ClientSession(
                    read, write,
                    read_timeout_seconds=timedelta(seconds=self.timeout_seconds),
                ) as session:
                    await session.initialize()
                    result = await session.call_tool("web_search", arguments={
                        "objective": prompt,
                        "search_queries": [prompt],
                        "session_id": self.session_id,
                    })

        text = "\n\n".join(
            block.text for block in result.content if block.type == "text"
        )
        if result.isError:
            raise RuntimeError(f"Parallel web search failed: {text}")
        if not text.strip():
            raise RuntimeError("Parallel web search returned no text.")
        return text
