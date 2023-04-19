from typing import Dict, Tuple, List, Union
from enum import Enum
import openai
import json, os

""" Supported LLM coding assistants """
class LLM(Enum):
    ChatGPT = 0

def call_chatgpt(prompt: str, n: int = 1, temperature: float = 1.0) -> Tuple[Dict, Dict]:
    query = {
        "model": "gpt-3.5-turbo",
        "messages": [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt},
        ],
        "n": n,
        "temperature": temperature,
    }
    response = openai.ChatCompletion.create(**query)
    return query, response

def _extract_chatgpt_responses(response: dict) -> List[dict]:
    """
        Extracts the text part of a response JSON from ChatGPT. If there are more
        than 1 response (e.g., asking the LLM to generate multiple responses), 
        this produces a list of all returned responses.
    """
    choices = response["response"]["choices"]
    return [
        c["message"]["content"]
        for i, c in enumerate(choices)
    ]

def extract_responses(response: dict, llm: LLM) -> List[dict]:
    """
        Given a LLM and a response object from its API, extract the
        text response(s) part of the response object.
    """
    if llm is LLM.ChatGPT or llm == LLM.ChatGPT.name:
        return _extract_chatgpt_responses(response)
    else:
        raise ValueError(f"LLM {llm} is unsupported.")

def is_valid_filepath(filepath: str) -> bool:
    try:
        with open(filepath, 'r'):
            pass
    except IOError:
        try:
            # Create the file if it doesn't exist, and write an empty json string to it
            with open(filepath, 'w+') as f:
                f.write("{}")
                pass
        except IOError:
            return False
    return True

def is_valid_json(json_dict: dict) -> bool:
    if isinstance(json_dict, dict):
        try:
            json.dumps(json_dict)
            return True
        except:
            pass
    return False

def get_files_at_dir(path: str) -> list:
    f = []
    for (dirpath, dirnames, filenames) in os.walk(path):
        f = filenames
        break
    return f