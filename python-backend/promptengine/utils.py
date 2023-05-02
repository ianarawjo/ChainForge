from typing import Dict, Tuple, List, Union
from enum import Enum
import openai
import json, os, time

DALAI_MODEL = None
DALAI_RESPONSE = None

openai.api_key = os.environ.get("OPENAI_API_KEY")



""" Supported LLM coding assistants """
class LLM(Enum):
    ChatGPT = 0
    Alpaca7B = 1
    GPT4 = 2

def call_chatgpt(prompt: str, model: LLM, n: int = 1, temperature: float = 1.0, system_msg: Union[str, None]=None) -> Tuple[Dict, Dict]:
    """
        Calls GPT3.5 via OpenAI's API. 
        Returns raw query and response JSON dicts. 
    """
    model_map = { LLM.ChatGPT: 'gpt-3.5-turbo', LLM.GPT4: 'gpt-4' }
    if model not in model_map:
        raise Exception(f"Could not find OpenAI chat model {model}")
    model = model_map[model]
    system_msg = "You are a helpful assistant." if system_msg is None else system_msg
    query = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_msg},
            {"role": "user", "content": prompt},
        ],
        "n": n,
        "temperature": temperature,
    }
    response = openai.ChatCompletion.create(**query)
    return query, response

def call_dalai(llm_name: str, port: int, prompt: str, n: int = 1, temperature: float = 0.5, **params) -> Tuple[Dict, Dict]:
    """
        Calls a Dalai server running LLMs Alpaca, Llama, etc locally.
        Returns the raw query and response JSON dicts. 

        Parameters:
            - llm_name: The LLM's name as known by Dalai; e.g., 'alpaca.7b'
            - port: The port of the local server where Dalai is running. Usually 3000.
            - prompt: The prompt to pass to the LLM.
            - n: How many times to query. If n > 1, this will continue to query the LLM 'n' times and collect all responses.
            - temperature: The temperature to query at
            - params: Any other Dalai-specific params to pass. For more info, see https://cocktailpeanut.github.io/dalai/#/?id=syntax-1 

        TODO: Currently, this uses a modified dalaipy library for simplicity; however, in the future we might remove this dependency. 
    """
    # Import and load upon first run
    global DALAI_MODEL, DALAI_RESPONSE
    server = 'http://localhost:'+str(port)
    if DALAI_MODEL is None:
        from promptengine.dalaipy import Dalai
        DALAI_MODEL = Dalai(server)
    elif DALAI_MODEL.server != server:  # if the port has changed, we need to create a new model
        DALAI_MODEL = Dalai(server)
    
    # Make sure server is connected
    DALAI_MODEL.connect()

    # Create settings dict to pass to Dalai as args
    def_params = {'n_predict':128, 'repeat_last_n':64, 'repeat_penalty':1.3, 'seed':-1, 'threads':4, 'top_k':40, 'top_p':0.9}
    for key in params:
        if key in def_params:
            def_params[key] = params[key]
        else:
            print(f"Attempted to pass unsupported param '{key}' to Dalai. Ignoring.")
    
    # Create full query to Dalai
    query = {
        'prompt': prompt,
        'model': llm_name,
        'id': str(round(time.time()*1000)),
        'temp': temperature,
        **def_params
    }

    # Create spot to put response and a callback that sets it
    DALAI_RESPONSE = None
    def on_finish(r):
        global DALAI_RESPONSE
        DALAI_RESPONSE = r
    
    print(f"Calling Dalai model '{query['model']}' with prompt '{query['prompt']}' (n={n}). Please be patient...")

    # Repeat call n times
    responses = []
    while len(responses) < n:

        # Call the Dalai model 
        req = DALAI_MODEL.generate_request(**query)
        sent_req_success = DALAI_MODEL.generate(req, on_finish=on_finish)

        if not sent_req_success:
            print("Something went wrong pinging the Dalai server. Returning None.")
            return None, None

        # Blocking --wait for request to complete: 
        while DALAI_RESPONSE is None:
            time.sleep(0.01)

        response = DALAI_RESPONSE['response']
        if response[-5:] == '<end>':  # strip ending <end> tag, if present
            response = response[:-5]
        if response.index('\r\n') > -1:  # strip off the prompt, which is included in the result up to \r\n:
            response = response[(response.index('\r\n')+2):]
        DALAI_RESPONSE = None

        responses.append(response)
        print(f'Response {len(responses)} of {n}:\n', response)

    # Disconnect from the server
    DALAI_MODEL.disconnect()

    return query, responses

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

def extract_responses(response: Union[list, dict], llm: LLM) -> List[dict]:
    """
        Given a LLM and a response object from its API, extract the
        text response(s) part of the response object.
    """
    if llm is LLM.ChatGPT or llm == LLM.ChatGPT.name or llm is LLM.GPT4 or llm == LLM.GPT4.name:
        return _extract_chatgpt_responses(response)
    elif llm is LLM.Alpaca7B or llm == LLM.Alpaca7B.name:
        return response["response"]
    else:
        raise ValueError(f"LLM {llm} is unsupported.")

def create_dir_if_not_exists(path: str) -> None:
    if not os.path.exists(path):
        os.makedirs(path)

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