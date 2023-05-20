"""
    A list of all model APIs natively supported by ChainForge. 
"""
from enum import Enum

class LLM(str, Enum):
    """ OpenAI Chat """
    ChatGPT = "gpt-3.5-turbo"
    GPT4 = "gpt-4"

    """ Dalai-served models """
    Alpaca7B = "alpaca.7B"

    """ Anthropic """
    # Our largest model, ideal for a wide range of more complex tasks. Using this model name 
    # will automatically switch you to newer versions of claude-v1 as they are released.
    Claude_v1 = "claude-v1"

    # An earlier version of claude-v1
    Claude_v1_0 = "claude-v1.0"

    # An improved version of claude-v1. It is slightly improved at general helpfulness, 
    # instruction following, coding, and other tasks. It is also considerably better with 
    # non-English languages. This model also has the ability to role play (in harmless ways) 
    # more consistently, and it defaults to writing somewhat longer and more thorough responses.
    Claude_v1_2 = "claude-v1.2"

    # A significantly improved version of claude-v1. Compared to claude-v1.2, it's more robust 
    # against red-team inputs, better at precise instruction-following, better at code, and better 
    # and non-English dialogue and writing.
    Claude_v1_3 = "claude-v1.3"

    # A smaller model with far lower latency, sampling at roughly 40 words/sec! Its output quality 
    # is somewhat lower than claude-v1 models, particularly for complex tasks. However, it is much 
    # less expensive and blazing fast. We believe that this model provides more than adequate performance 
    # on a range of tasks including text classification, summarization, and lightweight chat applications, 
    # as well as search result summarization. Using this model name will automatically switch you to newer 
    # versions of claude-instant-v1 as they are released.
    Claude_v1_instant = "claude-instant-v1"

    """ Google models """
    PaLM2 = "text-bison-001"  # it's really models/text-bison-001, but that's confusing