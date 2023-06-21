from typing import Dict, Tuple, List, Union, Optional
import json, os, time, asyncio
from string import Template

from chainforge.promptengine.models import LLM

DALAI_MODEL = None
DALAI_RESPONSE = None

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
GOOGLE_PALM_API_KEY = os.environ.get("PALM_API_KEY")
AZURE_OPENAI_KEY = os.environ.get("AZURE_OPENAI_KEY")
AZURE_OPENAI_ENDPOINT = os.environ.get("AZURE_OPENAI_ENDPOINT")

def set_api_keys(api_keys):
    """
        Sets the local API keys for the revelant LLM API(s).
        Currently only supports 'OpenAI', 'Anthropic'. 
    """
    global ANTHROPIC_API_KEY, GOOGLE_PALM_API_KEY, AZURE_OPENAI_KEY, AZURE_OPENAI_ENDPOINT
    def key_is_present(name):
        return name in api_keys and len(api_keys[name].strip()) > 0
    if key_is_present('OpenAI'):
        import openai
        openai.api_key = api_keys['OpenAI']
    if key_is_present('Anthropic'):
        ANTHROPIC_API_KEY = api_keys['Anthropic']
    if key_is_present('Google'):
        GOOGLE_PALM_API_KEY = api_keys['Google']
    if key_is_present('Azure_OpenAI'):
        AZURE_OPENAI_KEY = api_keys['Azure_OpenAI']
    if key_is_present('Azure_OpenAI_Endpoint'):
        AZURE_OPENAI_ENDPOINT = api_keys['Azure_OpenAI_Endpoint']
    # Soft fail for non-present keys

async def make_sync_call_async(sync_method, *args, **params):
    """
        Makes a blocking synchronous call asynchronous, so that it can be awaited.
        NOTE: This is necessary for LLM APIs that do not yet support async (e.g. Google PaLM).
    """
    loop = asyncio.get_running_loop()
    method = sync_method
    if len(params) > 0:
        def partial_sync_meth(*a):
            return sync_method(*a, **params)
        method = partial_sync_meth
    return await loop.run_in_executor(None, method, *args)

async def call_chatgpt(prompt: str, model: LLM, n: int = 1, temperature: float= 1.0, 
                       system_msg: Optional[str]=None,
                       **params) -> Tuple[Dict, Dict]:
    """
        Calls GPT3.5 via OpenAI's API. 
        Returns raw query and response JSON dicts. 

        NOTE: It is recommended to set an environment variable OPENAI_API_KEY with your OpenAI API key
    """
    import openai
    if not openai.api_key:
        openai.api_key = os.environ.get("OPENAI_API_KEY")

    model = model.value
    if 'stop' in params and (not isinstance(params['stop'], list) or len(params['stop']) == 0):
        del params['stop']  
    if 'functions' in params and (not isinstance(params['functions'], list) or len(params['functions']) == 0):
        del params['functions']
    if 'function_call' in params and (not isinstance(params['function_call'], str) or len(params['function_call'].strip()) == 0):
        del params['function_call']

    print(f"Querying OpenAI model '{model}' with prompt '{prompt}'...")
    system_msg = "You are a helpful assistant." if system_msg is None else system_msg

    query = {
        "model": model,
        "n": n,
        "temperature": temperature,
        **params,  # 'the rest' of the settings, passed from a front-end app
    }

    if 'davinci' in model:  # text completions model
        openai_call = openai.Completion.acreate
        query['prompt'] = prompt
    else:  # chat model
        openai_call = openai.ChatCompletion.acreate
        query['messages'] = [
            {"role": "system", "content": system_msg},
            {"role": "user", "content": prompt},
        ]
    
    try:
        response = await openai_call(**query)
    except Exception as e:
        if (isinstance(e, openai.error.AuthenticationError)):
            raise Exception("Could not authenticate to OpenAI. Double-check that your API key is set in Settings or in your local Python environment.")
        raise e
    
    return query, response

async def call_azure_openai(prompt: str, model: LLM, n: int = 1, temperature: float= 1.0, 
                            deployment_name: str = 'gpt-35-turbo', 
                            model_type: str = "chat-completion", 
                            api_version: str = "2023-05-15", 
                            system_msg: Optional[str]=None, 
                            **params) -> Tuple[Dict, Dict]:
    """
        Calls an OpenAI chat model GPT3.5 or GPT4 via Microsoft Azure services.
        Returns raw query and response JSON dicts. 

        NOTE: It is recommended to set an environment variables AZURE_OPENAI_KEY and AZURE_OPENAI_ENDPOINT
    """
    global AZURE_OPENAI_KEY, AZURE_OPENAI_ENDPOINT
    if AZURE_OPENAI_KEY is None:
        raise Exception("Could not find an Azure OpenAPI Key to use. Double-check that your key is set in Settings or in your local Python environment.")
    if AZURE_OPENAI_ENDPOINT is None:
        raise Exception("Could not find an Azure OpenAI Endpoint to use. Double-check that your endpoint is set in Settings or in your local Python environment.")

    import openai
    openai.api_type = "azure"
    openai.api_version = api_version
    openai.api_key = AZURE_OPENAI_KEY
    openai.api_base = AZURE_OPENAI_ENDPOINT

    if 'stop' in params and not isinstance(params['stop'], list) or len(params['stop']) == 0:
        del params['stop']  
    if 'functions' in params and not isinstance(params['functions'], list) or len(params['functions']) == 0:
        del params['functions']
    if 'function_call' in params and not isinstance(params['function_call'], str) or len(params['function_call'].strip()) == 0:
        del params['function_call']

    print(f"Querying Azure OpenAI deployed model '{deployment_name}' at endpoint '{AZURE_OPENAI_ENDPOINT}' with prompt '{prompt}'...")
    system_msg = "You are a helpful assistant." if system_msg is None else system_msg
    
    query = {
        "engine": deployment_name,  # this differs from a basic OpenAI call
        "n": n,
        "temperature": temperature,
        **params,  # 'the rest' of the settings, passed from a front-end app
    }

    if model_type == 'text-completion':
        openai_call = openai.Completion.acreate
        query['prompt'] = prompt
    else:
        openai_call = openai.ChatCompletion.acreate
        query['messages'] = [
            {"role": "system", "content": system_msg},
            {"role": "user", "content": prompt},
        ]
    
    try:
        response = await openai_call(**query)
    except Exception as e:
        if (isinstance(e, openai.error.AuthenticationError)):
            raise Exception("Could not authenticate to OpenAI. Double-check that your API key is set in Settings or in your local Python environment.")
        raise e
    
    return query, response

async def call_anthropic(prompt: str, model: LLM, n: int = 1, temperature: float= 1.0,
                        max_tokens_to_sample=1024,
                        async_mode=False,
                        custom_prompt_wrapper: Optional[str]=None,
                        stop_sequences: Optional[List[str]]=["\n\nHuman:"],
                        **params) -> Tuple[Dict, Dict]:
    """
        Calls Anthropic API with the given model, passing in params.
        Returns raw query and response JSON dicts.

        Unique parameters:
            - custom_prompt_wrapper: Anthropic models expect prompts in form "\n\nHuman: ${prompt}\n\nAssistant". If you wish to 
                                     explore custom prompt wrappers that deviate, write a python Template that maps from 'prompt' to custom wrapper.
                                     If set to None, defaults to Anthropic's suggested prompt wrapper.
            - max_tokens_to_sample: A maximum number of tokens to generate before stopping.
            - stop_sequences: A list of strings upon which to stop generating. Defaults to ["\n\nHuman:"], the cue for the next turn in the dialog agent.
            - async_mode: Evaluation access to Claude limits calls to 1 at a time, meaning we can't take advantage of async.
                          If you want to send all 'n' requests at once, you can set async_mode to True.

        NOTE: It is recommended to set an environment variable ANTHROPIC_API_KEY with your Anthropic API key
    """
    if ANTHROPIC_API_KEY is None:
        raise Exception("Could not find an API key for Anthropic models. Double-check that your API key is set in Settings or in your local Python environment.")

    import anthropic
    client = anthropic.Client(ANTHROPIC_API_KEY)

    # Wrap the prompt in the provided template, or use the default Anthropic one
    if custom_prompt_wrapper is None or '${prompt}' not in custom_prompt_wrapper:
        custom_prompt_wrapper = anthropic.HUMAN_PROMPT + " ${prompt}" + anthropic.AI_PROMPT
    prompt_wrapper_template = Template(custom_prompt_wrapper)
    wrapped_prompt = prompt_wrapper_template.substitute(prompt=prompt)

    # Format query
    query = {
        'model': model.value,
        'prompt': wrapped_prompt,
        'max_tokens_to_sample': max_tokens_to_sample,
        'stop_sequences': stop_sequences,
        'temperature': temperature,
        **params
    }

    print(f"Calling Anthropic model '{model.value}' with prompt '{prompt}' (n={n}). Please be patient...")

    # Request responses using the passed async_mode
    responses = []
    if async_mode:
        # Gather n responses by firing off all API requests at once 
        tasks = [client.acompletion(**query) for _ in range(n)]
        responses = await asyncio.gather(*tasks)
    else:
        # Repeat call n times, waiting for each response to come in:
        while len(responses) < n:
            resp = await client.acompletion(**query)
            responses.append(resp)
            print(f'{model.value} response {len(responses)} of {n}:\n', resp)

    return query, responses

async def call_google_palm(prompt: str, model: LLM, n: int = 1, temperature: float= 0.7,
                           max_output_tokens=800,
                           async_mode=False,
                           **params) -> Tuple[Dict, Dict]:
    """
        Calls a Google PaLM model. 
        Returns raw query and response JSON dicts.
    """
    if GOOGLE_PALM_API_KEY is None:
        raise Exception("Could not find an API key for Google PaLM models. Double-check that your API key is set in Settings or in your local Python environment.")

    import google.generativeai as palm
    palm.configure(api_key=GOOGLE_PALM_API_KEY)

    is_chat_model = 'chat' in model.value

    query = {
        'model': f"models/{model.value}",
        'prompt': prompt,
        'candidate_count': n,
        'temperature': temperature,
        'max_output_tokens': max_output_tokens,
        **params,
    }

    # Remove erroneous parameters for text and chat models
    if 'top_k' in query and query['top_k'] <= 0:
        del query['top_k']
    if 'top_p' in query and query['top_p'] <= 0:
        del query['top_p']
    if is_chat_model and 'max_output_tokens' in query:
        del query['max_output_tokens']
    if is_chat_model and 'stop_sequences' in query:
        del query['stop_sequences']
    
    # Get the correct model's completions call
    palm_call = palm.chat if is_chat_model else palm.generate_text

    # Google PaLM's python API does not currently support async calls.
    # To make one, we need to wrap it in an asynchronous executor:
    completion = await make_sync_call_async(palm_call, **query)
    completion_dict = completion.to_dict()

    # Google PaLM, unlike other chat models, will output empty
    # responses for any response it deems unsafe (blocks). Although the text completions
    # API has a (relatively undocumented) 'safety_settings' parameter,
    # the current chat completions API provides users no control over the blocking.
    # We need to detect this and fill the response with the safety reasoning:
    if len(completion.filters) > 0:
        # Request was blocked. Output why in the response text, 
        # repairing the candidate dict to mock up 'n' responses
        block_error_msg = f'[[BLOCKED_REQUEST]] Request was blocked because it triggered safety filters: {str(completion.filters)}'
        completion_dict['candidates'] = [{'author': 1, 'content':block_error_msg}] * n

    # Weirdly, google ignores candidate_count if temperature is 0. 
    # We have to check for this and manually append the n-1 responses:
    if n > 1 and temperature == 0 and len(completion_dict['candidates']) == 1:
        copied_candidates = [completion_dict['candidates'][0]] * n
        completion_dict['candidates'] = copied_candidates

    return query, completion_dict

async def call_dalai(prompt: str, model: LLM, server: str="http://localhost:4000", n: int = 1, temperature: float = 0.5,  **params) -> Tuple[Dict, Dict]:
    """
        Calls a Dalai server running LLMs Alpaca, Llama, etc locally.
        Returns the raw query and response JSON dicts. 

        Parameters:
            - model: The LLM model, whose value is the name known byt Dalai; e.g. 'alpaca.7b'
            - port: The port of the local server where Dalai is running. By default 4000.
            - prompt: The prompt to pass to the LLM.
            - n: How many times to query. If n > 1, this will continue to query the LLM 'n' times and collect all responses.
            - temperature: The temperature to query at
            - params: Any other Dalai-specific params to pass. For more info, see below or https://cocktailpeanut.github.io/dalai/#/?id=syntax-1 

        TODO: Currently, this uses a modified dalaipy library for simplicity; however, in the future we might remove this dependency. 
    """
    # Import and load upon first run
    global DALAI_MODEL, DALAI_RESPONSE
    if not server or len(server.strip()) == 0:  # In case user passed a blank server name, revert to default on port 4000
        server = "http://localhost:4000"
    if DALAI_MODEL is None:
        from chainforge.promptengine.dalaipy import Dalai
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
        'model': model.value,
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
            await asyncio.sleep(0.01)

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

def _extract_openai_chat_choice_content(choice: dict) -> str:
    """
        Extracts the relevant portion of a OpenAI chat response.
        
        Note that chat choice objects can now include 'function_call' and a blank 'content' response.
        This method detects a 'function_call's presence, prepends [[FUNCTION]] and converts the function call into Python format. 
    """
    if choice['finish_reason'] == 'function_call' or choice["message"]["content"] is None or \
       ('function_call' in choice['message'] and len(choice['message']['function_call']) > 0):
        func = choice['message']['function_call']
        return '[[FUNCTION]] ' + func['name'] + str(func['arguments'])
    else:
        return choice["message"]["content"]

def _extract_chatgpt_responses(response: dict) -> List[str]:
    """
        Extracts the text part of a response JSON from ChatGPT. If there is more
        than 1 response (e.g., asking the LLM to generate multiple responses), 
        this produces a list of all returned responses.
    """
    choices = response["choices"]
    return [
        _extract_openai_chat_choice_content(c)
        for c in choices
    ]

def _extract_openai_completion_responses(response: dict) -> List[str]:
    """
        Extracts the text part of a response JSON from OpenAI completions models like Davinci. If there are more
        than 1 response (e.g., asking the LLM to generate multiple responses), 
        this produces a list of all returned responses.
    """
    choices = response["choices"]
    return [
        c["text"].strip()
        for c in choices
    ]

def _extract_openai_responses(response: dict) -> List[str]:
    """
        Deduces the format of an OpenAI model response (completion or chat)
        and extracts the response text using the appropriate method.
    """
    if len(response["choices"]) == 0: return []
    first_choice = response["choices"][0]
    if "message" in first_choice:
        return _extract_chatgpt_responses(response)
    else:
        return _extract_openai_completion_responses(response)

def _extract_palm_responses(completion) -> List[str]:
    """
        Extracts the text part of a 'Completion' object from Google PaLM2 `generate_text` or `chat`

        NOTE: The candidate object for `generate_text` has a key 'output' which contains the response,
        while the `chat` API uses a key 'content'. This checks for either.
    """
    return [
        c['output'] if 'output' in c else c['content']
        for c in completion['candidates']
    ]

def extract_responses(response: Union[list, dict], llm: Union[LLM, str]) -> List[str]:
    """
        Given a LLM and a response object from its API, extract the
        text response(s) part of the response object.
    """
    llm_str = llm.name if isinstance(llm, LLM) else llm
    if llm_str[:6] == 'OpenAI':
        if 'davinci' in llm_str.lower():
            return _extract_openai_completion_responses(response)
        else:
            return _extract_chatgpt_responses(response)
    elif llm_str[:5] == 'Azure':
        return _extract_openai_responses(response)
    elif llm_str[:5] == 'PaLM2':
        return _extract_palm_responses(response)
    elif llm_str[:5] == 'Dalai':
        return response
    elif llm_str[:6] == 'Claude':
        return [r["completion"] for r in response]
    else:
        raise ValueError(f"LLM {llm_str} is unsupported.")

def merge_response_objs(resp_obj_A: Union[dict, None], resp_obj_B: Union[dict, None]) -> dict:
    if resp_obj_B is None: 
        return resp_obj_A
    elif resp_obj_A is None:
        return resp_obj_B
    raw_resp_A = resp_obj_A["raw_response"]
    raw_resp_B = resp_obj_B["raw_response"]
    if not isinstance(raw_resp_A, list):
        raw_resp_A = [ raw_resp_A ]
    if not isinstance(raw_resp_B, list):
        raw_resp_B = [ raw_resp_B ]
    C = {
        "responses": resp_obj_A["responses"] + resp_obj_B["responses"],
        "raw_response": raw_resp_A + raw_resp_B,
    }
    return {
        **C,
        "prompt": resp_obj_B['prompt'],
        "query": resp_obj_B['query'],
        "llm": resp_obj_B['llm'],
        "info": resp_obj_B['info'],
        "metavars": resp_obj_B['metavars'],
    }

def create_dir_if_not_exists(path: str) -> None:
    if not os.path.exists(path):
        os.makedirs(path)

def is_valid_filepath(filepath: str) -> bool:
    try:
        with open(filepath, 'r', encoding='utf-8'):
            pass
    except IOError:
        try:
            # Create the file if it doesn't exist, and write an empty json string to it
            with open(filepath, 'w+', encoding='utf-8') as f:
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
        except Exception:
            pass
    return False

def get_files_at_dir(path: str) -> list:
    f = []
    for (dirpath, dirnames, filenames) in os.walk(path):
        f = filenames
        break
    return f