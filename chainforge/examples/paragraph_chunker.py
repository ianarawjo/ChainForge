import re
from chainforge.providers import provider
from typing import List

@provider(
    name="Paragraph Chunker",
    emoji="¶",
    models=[],                # no LLM models needed
    rate_limit="sequential",  # chunkers run sequentially
    settings_schema={},        # no extra settings
    category="chunker" 
)
def ParagraphChunker(
    text: str
) -> List[str]:
    """
    Splits the input text into paragraphs at blank lines.

    Args:
      text: the full text to chunk.

    Returns:
      A list of non‑empty paragraph strings.
    """
    # normalize line endings
    text = text.replace("\r\n", "\n")
    # split on one-or-more blank lines
    paras = [p.strip() for p in re.split(r"\n\s*\n+", text) if p.strip()]
    return paras
