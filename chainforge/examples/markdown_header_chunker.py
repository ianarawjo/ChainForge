import re
from chainforge.providers import provider
from typing import List

@provider(
    name="Markdown Header Chunker",
    emoji="📝",
    models=[],                # no LLM models needed
    rate_limit="sequential",  # chunkers run sequentially
    settings_schema={},       # no extra settings
    category="chunker"
)
def MarkdownHeaderChunker(
    text: str
) -> List[str]:
    """
    Splits the input Markdown text into sections at each heading (e.g. #, ##, ###).

    Args:
      text: the full markdown document to chunk.

    Returns:
      A list of non-empty section strings, each starting with its heading.
    """
    # normalize line endings
    text = text.replace("\r\n", "\n")

    # split at any Markdown heading (1–6 #), keeping the heading in the chunk
    # (?m) → multiline; (?=^#{1,6}\s+) → zero-width lookahead for a heading
    sections = re.split(r'(?m)(?=^#{1,6}\s+)', text)

    # strip out any empty strings
    return [sec.strip() for sec in sections if sec.strip()]
