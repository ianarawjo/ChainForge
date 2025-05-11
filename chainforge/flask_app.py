import json, os, sys, asyncio, time, shutil, uuid, hashlib, tempfile, zipfile
from dataclasses import dataclass
from enum import Enum
from typing import List, Literal
from statistics import mean, median, stdev
from datetime import datetime
from flask import Flask, request, jsonify, render_template, send_from_directory, send_file, after_this_request
from flask_cors import CORS
from chainforge.providers import ProviderRegistry
from chainforge.security.password_utils import ensure_password
from chainforge.security.secure_save import load_json_file, save_json_file
import requests as py_requests
from platformdirs import user_data_dir

# RAG-specific imports
from markitdown import MarkItDown


""" =================
    SETUP AND GLOBALS
    =================
"""

# Setup Flask app to serve static version of React front-end
HOSTNAME = "localhost"
PORT = 8000
# SESSION_TOKEN = secrets.token_hex(32)
BUILD_DIR = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'react-server', 'build')
STATIC_DIR = os.path.join(BUILD_DIR, 'static')
app = Flask(__name__, static_folder=STATIC_DIR, template_folder=BUILD_DIR)

# Set up CORS for specific routes
cors = CORS(app, resources={r"/*": {"origins": "*"}})

# The cache and examples files base directories
FLOWS_DIR = user_data_dir("chainforge")  # platform-agnostic local storage that persists outside the package install location
SETTINGS_FILENAME = "settings.json"
# CACHE_DIR = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'cache')
EXAMPLES_DIR = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'examples')
MEDIA_DIR = os.path.join(FLOWS_DIR, 'media')

# Cryptography
SECURE_MODE: Literal['off', 'settings', 'all'] = 'off'  # The mode of encryption to use for files
FLOWS_DIR_PWD = None  # The password to use for encryption/decryption

class MetricType(Enum):
    KeyValue = 0
    KeyValue_Numeric = 1
    KeyValue_Categorical = 2
    KeyValue_Mixed = 3
    Numeric = 4
    Categorical = 5
    Mixed = 6
    Unknown = 7
    Empty = 8


""" ==============
    UTIL FUNCTIONS
    ==============
"""

HIJACKED_PRINT_LOG_FILE = None
ORIGINAL_PRINT_METHOD = None
def HIJACK_PYTHON_PRINT() -> None:
    # Hijacks Python's print function, so that we can log 
    # the outputs when the evaluator is run:
    import builtins
    import tempfile
    global HIJACKED_PRINT_LOG_FILE, ORIGINAL_PRINT_METHOD

    # Create a temporary file for logging and keep it open
    HIJACKED_PRINT_LOG_FILE = tempfile.NamedTemporaryFile(mode='a+', delete=False)

    # Create a wrapper over the original print method, and save the original print
    ORIGINAL_PRINT_METHOD = print
    def hijacked_print(*args, **kwargs):
        if 'file' in kwargs:
            # We don't want to override any library that's using print to a file.
            ORIGINAL_PRINT_METHOD(*args, **kwargs)
        else:
            ORIGINAL_PRINT_METHOD(*args, **kwargs, file=HIJACKED_PRINT_LOG_FILE)
    
    # Replace the original print function with the custom print function
    builtins.print = hijacked_print

def REVERT_PYTHON_PRINT() -> List[str]:
    # Reverts back to original Python print method 
    # NOTE: Call this after hijack, and make sure you've caught all exceptions!
    import builtins
    global ORIGINAL_PRINT_METHOD, HIJACKED_PRINT_LOG_FILE
    
    logs = []
    if HIJACKED_PRINT_LOG_FILE is not None:
        # Read the log file 
        HIJACKED_PRINT_LOG_FILE.seek(0)
        logs = HIJACKED_PRINT_LOG_FILE.read().split('\n')

    if ORIGINAL_PRINT_METHOD is not None:
        builtins.print = ORIGINAL_PRINT_METHOD

    HIJACKED_PRINT_LOG_FILE.close()
    HIJACKED_PRINT_LOG_FILE = None

    if len(logs) == 1 and len(logs[0].strip()) == 0:
        logs = []
    return logs

@dataclass
class ResponseInfo:
    """Stores info about a single LLM response. Passed to evaluator functions."""
    text: str  # The text of the LLM response
    prompt: str  # The text of the prompt using to query the LLM
    var: dict  # A dictionary of arguments that filled in the prompt template used to generate the final prompt
    meta: dict  # A dictionary of metadata ('metavars') that is 'carried alongside' data used to generate the prompt
    llm: str  # The name of the LLM queried (the nickname in ChainForge)

    def __str__(self):
        return self.text
    
    def asMarkdownAST(self):
        import mistune
        md_ast_parser = mistune.create_markdown(renderer='ast')
        return md_ast_parser(self.text)

def check_typeof_vals(arr: list) -> MetricType:
    if len(arr) == 0: return MetricType.Empty

    def typeof_set(types: set) -> MetricType:
        if len(types) == 0: return MetricType.Empty
        if len(types) == 1 and next(iter(types)) == dict:
            return MetricType.KeyValue
        elif all((t in (int, float) for t in types)):
            # Numeric metrics only
            return MetricType.Numeric
        elif all((t in (str, bool) for t in types)):
            # Categorical metrics only ('bool' is True/False, counts as categorical)
            return MetricType.Categorical
        elif all((t in (int, float, bool, str) for t in types)):
            # Mix of numeric and categorical types
            return MetricType.Mixed
        else:
            # Mix of types beyond basic ones
            return MetricType.Unknown
    
    def typeof_dict_vals(d):
        dict_val_type = typeof_set(set((type(v) for v in d.values())))
        if dict_val_type == MetricType.Numeric: 
            return MetricType.KeyValue_Numeric
        elif dict_val_type == MetricType.Categorical: 
            return MetricType.KeyValue_Categorical
        else: 
            return MetricType.KeyValue_Mixed

    # Checks type of all values in 'arr' and returns the type
    val_type = typeof_set(set((type(v) for v in arr)))
    if val_type == MetricType.KeyValue:
        # This is a 'KeyValue' pair type. We need to find the more specific type of the values in the dict.
        # First, we check that all dicts have the exact same keys
        for i in range(len(arr)-1):
            d, e = arr[i], arr[i+1]
            if set(d.keys()) != set(e.keys()):
                raise Exception('The keys and size of dicts for evaluation results must be consistent across evaluations.')
        
        # Then, we check the consistency of the type of dict values:
        first_dict_val_type = typeof_dict_vals(arr[0])
        for d in arr[1:]:
            if first_dict_val_type != typeof_dict_vals(d):
                raise Exception('Types of values in dicts for evaluation results must be consistent across responses.')
        # If we're here, all checks passed, and we return the more specific KeyValue type:
        return first_dict_val_type
    else:
        return val_type

def run_over_responses(process_func, responses: list, scope: str, process_type: str) -> list:
    for resp_obj in responses:
        res = resp_obj['responses']
        if scope == 'response':
            # Run process func over every individual response text
            proc = [process_func(
                        ResponseInfo(
                            text=r,
                            prompt=resp_obj['prompt'],
                            var=resp_obj['vars'],
                            meta=resp_obj['metavars'] if 'metavars' in resp_obj else {},
                            llm=resp_obj['llm'])
                    ) for r in res]

            if process_type == 'processor':
                # Response text was just transformed, not evaluated
                resp_obj['responses'] = proc
            else: 
                # Responses were evaluated/scored
                # Check the type of evaluation results
                # NOTE: We assume this is consistent across all evaluations, but it may not be.
                eval_res_type = check_typeof_vals(proc)

                if eval_res_type == MetricType.Numeric:
                    # Store items with summary of mean, median, etc
                    resp_obj['eval_res'] = {
                        'mean': mean(proc),
                        'median': median(proc),
                        'stdev': stdev(proc) if len(proc) > 1 else 0,
                        'range': (min(proc), max(proc)),
                        'items': proc,
                        'dtype': eval_res_type.name,
                    }
                elif eval_res_type in (MetricType.Unknown, MetricType.Empty):
                    raise Exception('Unsupported types found in evaluation results. Only supported types for metrics are: int, float, bool, str.')
                else:
                    # Categorical, KeyValue, etc, we just store the items:
                    resp_obj['eval_res'] = { 
                        'items': proc,
                        'dtype': eval_res_type.name,
                    }
        else:  
            # Run process func over the entire response batch
            proc = process_func([
                    ResponseInfo(text=r,
                                 prompt=resp_obj['prompt'],
                                 var=resp_obj['vars'],
                                 llm=resp_obj['llm'])
                   for r in res])
            
            if process_type == 'processor':
                # Response text was just transformed, not evaluated
                resp_obj['responses'] = proc
            else: 
                # Responses were evaluated/scored
                ev_type = check_typeof_vals([proc])
                if ev_type == MetricType.Numeric:
                    resp_obj['eval_res'] = {
                        'mean': proc,
                        'median': proc,
                        'stdev': 0,
                        'range': (proc, proc),
                        'items': [proc],
                        'type': ev_type.name,
                    }
                else:
                    resp_obj['eval_res'] = { 
                        'items': [proc],
                        'type': ev_type.name,
                    }
    return responses

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

def exclude_key(d, key_to_exclude):
        return {k: v for k, v in d.items() if k != key_to_exclude}


""" ===================
    FLASK SERVER ROUTES
    ===================
"""

# Serve React app (static; no hot reloading)
@app.route("/")
def index():
    # Get the index.html HTML code
    html_str = render_template("index.html")
    
    # Inject global JS variables __CF_HOSTNAME and __CF_PORT at the top so that the application knows 
    # that it's running from a Flask server, and what the hostname and port of that server is:
    html_str = html_str[:60] + f'<script>window.__CF_HOSTNAME="{HOSTNAME}"; window.__CF_PORT={PORT};</script>' + html_str[60:]

    return html_str

@app.route('/app/executepy', methods=['POST'])
def executepy():
    """
        Executes a Python function sent from JavaScript,
        over all the `LLMResponse` objects passed in from the front-end. 

        POST'd data should be in the form: 
        {
            'id': # a unique ID to refer to this information. Used when cache'ing responses. 
            'code': str,  # the body of the lambda function to evaluate, in form: lambda responses: <body>
            'responses': List[LLMResponse]  # the responses to run on.
            'scope': 'response' | 'batch'  # the scope of responses to run on --a single response, or all across each batch. 
                                           # If batch, evaluator has access to 'responses'. Only matters if n > 1 for each prompt.
            'process_type': 'evaluator' | 'processor'  # the type of processing to perform. Evaluators only 'score'/annotate responses. Processors change responses (e.g. text).
            'script_paths': unspecified | List[str]  # the paths to scripts to be added to the path before the lambda function is evaluated
        }

        NOTE: This should only be run on your server on code you trust.
              There is no sandboxing; no safety. We assume you are the creator of the code.
    """
    data = request.get_json()

    # Check that all required info is here:
    if not set(data.keys()).issuperset({'id', 'code', 'responses', 'scope'}):
        return jsonify({'error': 'POST data is improper format.'})
    if not isinstance(data['id'], str) or len(data['id']) == 0:
        return jsonify({'error': 'POST data id is improper format (length 0 or not a string).'})
    if data['scope'] not in ('response', 'batch'):
        return jsonify({'error': "POST data scope is unknown. Must be either 'response' or 'batch'."})

    # Check format of responses:
    responses = data['responses']
    if (isinstance(responses, str) or not isinstance(responses, list)) or (len(responses) > 0 and any([not isinstance(r, dict) for r in responses])):
        return jsonify({'error': 'POST data responses is improper format.'})

    # Add the path to any scripts to the path:
    try:
        if 'script_paths' in data:
            for script_path in data['script_paths']:
                # get the folder of the script_path:
                script_folder = os.path.dirname(script_path)
                # check that the script_folder is valid, and it contains __init__.py
                if not os.path.exists(script_folder):
                    print(script_folder, 'is not a valid script path.')
                    continue

                # add it to the path:
                sys.path.append(script_folder)
                print(f'added {script_folder} to sys.path')
    except Exception as e:
        return jsonify({'error': f'Could not add script path to sys.path. Error message:\n{str(e)}'})

    # Get processor type, if any
    process_type = data['process_type'] if 'process_type' in data else 'evaluator'

    # Create the evaluator function
    # DANGER DANGER! 
    try:
        exec(data['code'], globals())

        # Double-check that there is an 'evaluate' method in our namespace. 
        # This will throw a NameError if not: 
        if process_type == 'evaluator':
            evaluate  # noqa
        else:
            process  # noqa
    except Exception as e:
        return jsonify({'error': f'Could not compile evaluator code. Error message:\n{str(e)}'})
    
    evald_responses = []
    logs = []
    try:
        HIJACK_PYTHON_PRINT()
        evald_responses = run_over_responses(evaluate if process_type == 'evaluator' else process, responses, scope=data['scope'], process_type=process_type)  # noqa
        logs = REVERT_PYTHON_PRINT()
    except Exception as e:
        logs = REVERT_PYTHON_PRINT()
        return jsonify({'error': f'Error encountered while trying to run "evaluate" method:\n{str(e)}', 'logs': logs})

    ret = jsonify({'responses': evald_responses, 'logs': logs})
    ret.headers.add('Access-Control-Allow-Origin', '*')
    return ret


@app.route('/app/fetchExampleFlow', methods=['POST'])
def fetchExampleFlow():
    """
        Fetches the example flow data, given its filename. The filename should be the 
        name of a file in the examples/ folder of the package. 

        Used for loading examples in the Example Flow modal.

        POST'd data should be in form:
        { 
            name: <str>  # The filename (without .cforge extension)
        }
    """
    # Verify post'd data
    data = request.get_json()
    if 'name' not in data:
        return jsonify({'error': 'Missing "name" parameter to fetchExampleFlow.'})

    # Verify 'examples' directory exists:
    if not os.path.isdir(EXAMPLES_DIR):
        dirpath = os.path.dirname(os.path.realpath(__file__))
        return jsonify({'error': f'Could not find an examples/ directory at path {dirpath}'})

    # Check if the file is there:
    filepath = os.path.join(EXAMPLES_DIR, data['name'] + '.cforge')
    if not os.path.isfile(filepath):
        return jsonify({'error': f"Could not find an example flow named {data['name']}"})

    # Load the file and return its data:
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            filedata = json.load(f)
    except Exception as e:
        return jsonify({'error': f"Error parsing example flow at {filepath}: {str(e)}"})
    
    ret = jsonify({'data': filedata})
    ret.headers.add('Access-Control-Allow-Origin', '*')
    return ret


@app.route('/app/fetchOpenAIEval', methods=['POST'])
def fetchOpenAIEval():
    """
        Fetches a preconverted OpenAI eval as a .cforge JSON file.

        First detects if the eval is already in the cache. If the eval is already downloaded, 
        it will be stored in examples/ folder of the package under a new oaievals directory. 
        If it's not in the cache, it will download it from the ChainForge webserver.

        POST'd data should be in form:
        { 
            'name': <str>  # The name of the eval to grab (without .cforge extension)
        }
    """
    # Verify post'd data
    data = request.get_json()
    if 'name' not in data:
        return jsonify({'error': 'Missing "name" parameter to fetchOpenAIEval.'})
    evalname = data['name']

    # Verify 'examples' directory exists:
    if not os.path.isdir(EXAMPLES_DIR):
        dirpath = os.path.dirname(os.path.realpath(__file__))
        return jsonify({'error': f'Could not find an examples/ directory at path {dirpath}'})

    # Check if an oaievals subdirectory exists; if so, check for the file; if not create it:
    oaievals_cache_dir = os.path.join(EXAMPLES_DIR, "oaievals")
    if os.path.isdir(oaievals_cache_dir):
        filepath = os.path.join(oaievals_cache_dir, evalname + '.cforge')
        if os.path.isfile(filepath):
            # File was already downloaded. Load it from cache:
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    filedata = json.load(f)
            except Exception as e:
                return jsonify({'error': f"Error parsing OpenAI evals flow at {filepath}: {str(e)}"})
            ret = jsonify({'data': filedata})
            ret.headers.add('Access-Control-Allow-Origin', '*')
            return ret
        # File was not downloaded
    else:
        # Directory does not exist yet; create it
        try:
            os.mkdir(oaievals_cache_dir)
        except Exception as e:
            return jsonify({'error': f"Error creating a new directory 'oaievals' at filepath {oaievals_cache_dir}: {str(e)}"})

    # Download the preconverted OpenAI eval from the GitHub main branch for ChainForge
    _url = f"https://raw.githubusercontent.com/ianarawjo/ChainForge/main/chainforge/oaievals/{evalname}.cforge"
    response = py_requests.get(_url)

    # Check if the request was successful (status code 200)
    if response.status_code == 200:
        # Parse the response as JSON
        filedata = response.json()

        # Store to the cache:
        with open(os.path.join(oaievals_cache_dir, evalname + '.cforge'), 'w', encoding='utf8') as f:
            json.dump(filedata, f)
    else:
        print("Error:", response.status_code)
        return jsonify({'error': f"Error downloading OpenAI evals flow from {_url}: status code {response.status_code}"})

    ret = jsonify({'data': filedata})
    ret.headers.add('Access-Control-Allow-Origin', '*')
    return ret


@app.route('/app/fetchEnvironAPIKeys', methods=['POST'])
def fetchEnvironAPIKeys():
    keymap = {
        'OPENAI_API_KEY': 'OpenAI', 
        'OPENAI_BASE_URL': 'OpenAI_BaseURL',
        'ANTHROPIC_API_KEY': 'Anthropic', 
        'PALM_API_KEY': 'Google', 
        'HUGGINGFACE_API_KEY': 'HuggingFace',
        'AZURE_OPENAI_KEY': 'Azure_OpenAI', 
        'AZURE_OPENAI_ENDPOINT': 'Azure_OpenAI_Endpoint',
        'ALEPH_ALPHA_API_KEY': 'AlephAlpha',
        'AWS_ACCESS_KEY_ID': 'AWS_Access_Key_ID',
        'AWS_SECRET_ACCESS_KEY': 'AWS_Secret_Access_Key',
        'AWS_REGION': 'AWS_Region', 
        'AWS_SESSION_TOKEN': 'AWS_Session_Token',
        'TOGETHER_API_KEY': 'Together',
        'DEEPSEEK_API_KEY': 'DeepSeek',
    }
    d = { alias: os.environ.get(key) for key, alias in keymap.items() }
    ret = jsonify(d)
    ret.headers.add('Access-Control-Allow-Origin', '*')
    return ret


@app.route('/app/makeFetchCall', methods=['POST'])
def makeFetchCall():
    """
        Use in place of JavaScript's 'fetch' (with POST method), in cases where
        cross-origin policy blocks responses from client-side fetches. 

        POST'd data should be in form:
        {
            'url': <str>  # the url to fetch from
            'headers': <dict>  # a JSON object of the headers
            'body': <dict>  # the request payload, as JSON
        }
    """
    # Verify post'd data
    data = request.get_json()
    if not set(data.keys()).issuperset({'url', 'headers', 'body'}):
        return jsonify({'error': 'POST data is improper format.'})

    url = data['url']
    headers = data['headers']
    body = data['body']

    response = py_requests.post(url, headers=headers, json=body)

    if response.status_code == 200:
        ret = jsonify({'response': response.json()})
        ret.headers.add('Access-Control-Allow-Origin', '*')
        return ret
    else:
        err_msg = "API request failed"
        ret = response.json()
        if "error" in ret and "message" in ret["error"]:
            err_msg += ": " + ret["error"]["message"]
        return jsonify({'error': err_msg})


@app.route('/app/initCustomProvider', methods=['POST'])
def initCustomProvider():
    """
        Initalizes custom model provider(s) defined in a Python script,
        and returns specs for the front-end UI provider dropdown and the providers' settings window. 

        POST'd data should be in form:
        {
            'code': <str>  # the Python script to save + execute,
        }
    """
    # Verify post'd data
    data = request.get_json()
    if 'code' not in data:
        return jsonify({'error': 'POST data is improper format.'})

    # Sanity check that the code actually registers a provider
    if '@provider' not in data['code']:
        return jsonify({'error': """Did not detect a @provider decorator. Custom provider scripts should register at least one @provider. 
                                    Do `from chainforge.providers import provider` and decorate your provider completion function with @provider."""})

    # Establish the custom provider script cache directory
    provider_scripts_dir = os.path.join(FLOWS_DIR, "provider_scripts")
    if not os.path.isdir(provider_scripts_dir):
        # Create the directory
        try:
            os.makedirs(provider_scripts_dir, exist_ok=True)
        except Exception as e:
            return jsonify({'error': f"Error creating a new directory 'provider_scripts' at filepath {provider_scripts_dir}: {str(e)}"})

    # For keeping track of what script registered providers came from
    script_id = str(round(time.time()*1000))
    ProviderRegistry.set_curr_script_id(script_id)
    ProviderRegistry.watch_next_registered()

    # Attempt to run the Python script, in context
    try:
        exec(data['code'], globals(), None)

        # This should have registered one or more new CustomModelProviders.
    except Exception as e:
        return jsonify({'error': f'Error while executing custom provider code:\n{str(e)}'})

    # Check whether anything was updated, and what
    new_registries = ProviderRegistry.last_registered()
    if len(new_registries) == 0:  # Determine whether there's at least one custom provider.
        return jsonify({'error': 'Did not detect any custom providers added to the registry. Make sure you are registering your provider with @provider correctly.'})

    # At least one provider was registered; detect if it had a past script id and remove those file(s) from the cache
    if any((v is not None for v in new_registries.values())):
        # For every registered provider that was overwritten, remove the cache'd script(s) associated with it:
        past_script_ids = [v for v in new_registries.values() if v is not None]
        for sid in past_script_ids:
            past_script_path = os.path.join(provider_scripts_dir, f"{sid}.py")
            try:
                if os.path.isfile(past_script_path):
                    os.remove(past_script_path)
            except Exception as e:
                return jsonify({'error': f"Error removing cache'd custom provider script at filepath {past_script_path}: {str(e)}"})

    # Get the names and specs of all currently registered CustomModelProviders,
    # and pass that info to the front-end (excluding the func):
    registered_providers = [exclude_key(d, 'func') for d in ProviderRegistry.get_all()]

    # Copy the passed Python script to a local file in the package directory
    try:
        with open(os.path.join(provider_scripts_dir, f"{script_id}.py"), 'w') as f:
            f.write(data['code'])
    except Exception as e:
        return jsonify({'error': f"Error saving script 'provider_scripts' at filepath {provider_scripts_dir}: {str(e)}"})

    # Return all loaded providers
    return jsonify({'providers': registered_providers})


@app.route('/app/loadCachedCustomProviders', methods=['POST'])
def loadCachedCustomProviders():
    """
        Initalizes all custom model provider(s) in the local provider_scripts directory.
    """
    provider_scripts_dir = os.path.join(FLOWS_DIR, "provider_scripts")
    if not os.path.isdir(provider_scripts_dir):
        # No providers to load.
        return jsonify({'providers': []})

    try:
        for file_name in os.listdir(provider_scripts_dir):
            file_path = os.path.join(provider_scripts_dir, file_name)
            if os.path.isfile(file_path) and os.path.splitext(file_path)[1] == '.py':
                # For keeping track of what script registered providers came from
                ProviderRegistry.set_curr_script_id(os.path.splitext(file_name)[0])  

                # Read the Python script
                with open(file_path, 'r') as f:
                    code = f.read()
                
                # Try to execute it in the global context
                try:
                    exec(code, globals(), None)
                except Exception as code_exc:
                    # Remove the script file associated w the failed execution
                    os.remove(file_path)
                    raise code_exc
    except Exception as e:
        return jsonify({'error': f'Error while loading custom providers from cache: \n{str(e)}'})

    # Get the names and specs of all currently registered CustomModelProviders,
    # and pass that info to the front-end (excluding the func):
    registered_providers = [exclude_key(d, 'func') for d in ProviderRegistry.get_all()]

    return jsonify({'providers': registered_providers})


@app.route('/app/removeCustomProvider', methods=['POST'])
def removeCustomProvider():
    """
        Initalizes custom model provider(s) defined in a Python script,
        and returns specs for the front-end UI provider dropdown and the providers' settings window. 

        POST'd data should be in form:
        {
            'name': <str>  # a name that refers to the registered custom provider in the `ProviderRegistry`
        }
    """
    # Verify post'd data
    data = request.get_json()
    name = data.get('name')
    if name is None:
        return jsonify({'error': 'POST data is improper format.'})
    
    if not ProviderRegistry.has(name):
        return jsonify({'error': f'Could not find a custom provider named "{name}"'})
    
    # Get the script id associated with the provider we're about to remove
    script_id = ProviderRegistry.get(name).get('script_id')

    # Remove the custom provider from the registry
    ProviderRegistry.remove(name)

    # Attempt to delete associated script from cache
    if script_id:
        script_path = os.path.join(FLOWS_DIR, "provider_scripts", f"{script_id}.py")
        if os.path.isfile(script_path):
            os.remove(script_path)

    return jsonify({'success': True})


@app.route('/app/callCustomProvider', methods=['POST'])
async def callCustomProvider():
    """
        Calls a custom model provider and returns the response.

        POST'd data should be in form:
        {
            'name': <str>  # the name of the provider in the `ProviderRegistry`
            'params': <dict>  # the params (prompt, model, etc) to pass to the provider function.
        }
    """
    # Verify post'd data
    data = request.get_json()
    if not set(data.keys()).issuperset({'name', 'params'}):
        return jsonify({'error': 'POST data is improper format.'})
    
    # Load the name of the provider
    name = data['name']
    params = data['params']

    # Double-check that the custom provider exists in the registry, and (if passed) a model with that name exists
    provider_spec = ProviderRegistry.get(name)
    if provider_spec is None:
        return jsonify({'error': f'Could not find provider named {name}. Perhaps you need to import a custom provider script?'})
    
    # Call + await the custom provider function, passing in the JSON payload as kwargs
    try:
        response = await make_sync_call_async(provider_spec.get('func'), **params)
    except Exception as e:
        return jsonify({'error': f'Error encountered while calling custom provider function: {str(e)}'})

    # Return the response
    return jsonify({'response': response})

""" 
    LOCALLY SAVED FLOWS
"""
@app.route('/api/flows', methods=['GET'])
def get_flows():
    """Return a list of all saved flows. If the directory does not exist, try to create it."""
    os.makedirs(FLOWS_DIR, exist_ok=True)  # Creates the directory if it doesn't exist
    flows = [
        {
            "name": f,
            "last_modified": datetime.fromtimestamp(os.path.getmtime(os.path.join(FLOWS_DIR, f))).isoformat()
        }
        for f in os.listdir(FLOWS_DIR) 
        if (f.endswith('.cforge') or f.endswith('.cforge.enc')) and "__autosave.cforge" not in f  # ignore the special autosave file
    ]

    # Sort the flow files by last modified date in descending order (most recent first)
    flows.sort(key=lambda x: x["last_modified"], reverse=True)

    return jsonify({
        "flow_dir": FLOWS_DIR,
        "flows": flows
    })

@app.route('/api/flows/<filename>', methods=['GET'])
def get_flow(filename):
    file_is_pwd_protected = request.args.get("pwd_protected", False)
    also_autosave = request.args.get('autosave', False)

    if file_is_pwd_protected == "true" and SECURE_MODE != "all":
        # The file is password protected, but the server is not in secure mode, we won't be able to load it
        return jsonify({"error": "This flow is password protected, but the server is not in secure mode 'all'. Run ChainForge with --secure set to all to load this flow."}), 403

    """Return the content of a specific flow"""
    if not filename.endswith('.cforge'):
        filename += '.cforge'
    try:
        filepath = os.path.join(FLOWS_DIR, filename)
        secure_mode = SECURE_MODE == "all"
        data, true_filepath = load_json_file(
            filepath_w_ext=filepath, 
            secure=secure_mode,
            password=FLOWS_DIR_PWD if secure_mode else None,
        )

        if data is None:
            raise FileNotFoundError(f"Could not load flow data from {filepath}.")

        # If we should also autosave, then attempt to override the autosave cache file:
        if also_autosave == "true" and filename != "__autosave.cforge":
            autosave_filepath = os.path.join(FLOWS_DIR, '__autosave.cforge')
            true_autosave_filepath = autosave_filepath + ('.enc' if true_filepath.endswith('.enc') else '')
            shutil.copy2(true_filepath, true_autosave_filepath)  # copy the file to __autosave

            # Remove the other __autosave file if it exists
            # :: Note: This is rather nuanced, but we need to do this if the user is loading both 
            # :: encrypted and unencrypted flows in the same session. 
            other_autosave_filepath = autosave_filepath + ('' if true_filepath.endswith('.enc') else '.enc')
            if os.path.isfile(other_autosave_filepath):
                os.remove(other_autosave_filepath)

        return jsonify(data)
    except FileNotFoundError:
        return jsonify({"error": "Flow not found"}), 404

@app.route('/api/flowExists/<filename>', methods=['GET'])
def get_flow_exists(filename):
    """Return the content of a specific flow"""
    if not filename.endswith('.cforge'):
        filename += '.cforge'
    try:
        is_file = os.path.isfile(os.path.join(FLOWS_DIR, filename)) or os.path.isfile(os.path.join(FLOWS_DIR, filename + ".enc"))
        return jsonify({"exists": is_file})
    except FileNotFoundError:
        return jsonify({"error": "Flow not found"}), 404

@app.route('/api/flows/<filename>', methods=['DELETE'])
def delete_flow(filename):
    """Delete a flow"""
    file_is_pwd_protected = request.args.get("pwd_protected", False)

    # Compose the extension to the file
    if file_is_pwd_protected != "true":
        if not filename.endswith('.cforge'):
            filename += '.cforge'
    else:
        if filename.endswith('.cforge'):
            filename += '.enc'
        else:
            filename += '.cforge.enc'
        
    try:
        # Delete the file
        if os.path.isfile(os.path.join(FLOWS_DIR, filename)):
            os.remove(os.path.join(FLOWS_DIR, filename))
        return jsonify({"message": f"Flow {filename} deleted successfully"})
    except FileNotFoundError:
        return jsonify({"error": "Flow not found"}), 404

@app.route('/api/flows/<filename>', methods=['PUT'])
def save_or_rename_flow(filename):
    """Save, rename, or duplicate a flow"""
    data = request.json
    secure_mode = SECURE_MODE == "all"

    if not filename.endswith('.cforge'):
        filename += '.cforge'

    if data.get('flow'):
        # Save flow (overwriting any existing flow file with the same name)
        flow_data = data.get('flow')
        also_autosave = data.get('alsoAutosave')
        
        try:
            filepath = os.path.join(FLOWS_DIR, filename)
            success = save_json_file(
                filepath_w_ext=filepath, 
                data=flow_data, 
                secure=secure_mode,
                password=FLOWS_DIR_PWD if secure_mode else None,
            )
            if not success:
                return jsonify({"error": "Failed to save flow."}), 500

            # If we should also autosave, then attempt to override the autosave cache file:
            if also_autosave:
                cur_filepath = filepath + ('.enc' if secure_mode else '')
                autosave_filepath = os.path.join(FLOWS_DIR, '__autosave.cforge' + ('.enc' if secure_mode else ''))
                shutil.copy2(cur_filepath, autosave_filepath)  # copy the file to __autosave

            return jsonify({"message": f"Flow '{filename}' saved!"})
        except FileNotFoundError:
            return jsonify({"error": f"Could not save flow '{filename}' to local filesystem. See terminal for more details."}), 404

    elif data.get('newName'):
        # Rename flow
        new_name = data.get('newName')
        old_path = os.path.join(FLOWS_DIR, filename) + ('.enc' if secure_mode else '')
        
        if not new_name.endswith('.cforge'):
            new_name += '.cforge'

        if secure_mode:
            new_name += '.enc'

        try:
            # Check for name clashes (if a flow already exists with the new name)
            if os.path.isfile(os.path.join(FLOWS_DIR, new_name)):
                raise Exception("A flow with that name already exists.")
            os.rename(old_path, os.path.join(FLOWS_DIR, new_name))
            return jsonify({"message": f"Flow renamed from {filename} to {new_name}"})
        except Exception as error:
            return jsonify({"error": str(error)}), 404
    
    elif data.get('duplicate'):
        # Duplicate flow
        try:
            old_path = os.path.join(FLOWS_DIR, filename) + ('.enc' if secure_mode else '')
            # Check for name clashes (if a flow already exists with the new name)
            copy_name = _get_unique_flow_name(filename, "Copy of ") 
            # Copy the file to the new (safe) path, and copy metadata too:
            shutil.copy2(old_path, os.path.join(FLOWS_DIR, f"{copy_name}.cforge" + ('.enc' if secure_mode else '')))
            # Return the new filename
            return jsonify({"copyName": copy_name})
        except Exception as error:
            return jsonify({"error": str(error)}), 404

def _get_unique_flow_name(filename: str, prefix: str = None) -> str: 
    secure_mode = SECURE_MODE == "all"

    if not filename.endswith('.cforge'):
        filename += '.cforge'

    base, ext = os.path.splitext(filename)
    if ext is None or len(ext) == 0: 
        ext = ".cforge"

    if secure_mode:
        ext += '.enc'

    unique_filename = base + ext
    if prefix is not None:
        unique_filename = prefix + unique_filename
    i = 1

    # Find the first non-clashing filename of the form <filename>(i).cforge where i=1,2,3 etc
    while os.path.isfile(os.path.join(FLOWS_DIR, unique_filename)):
        unique_filename = f"{base}({i}){ext}"
        if prefix is not None:
            unique_filename = prefix + unique_filename
        i += 1
    
    return unique_filename.replace(ext, "")

@app.route('/api/getUniqueFlowFilename', methods=['PUT'])
def get_unique_flow_name():
    """Return a non-name-clashing filename to store in the local disk."""
    data = request.json
    filename = data.get("name")
    
    try:
        new_name = _get_unique_flow_name(filename)
        return jsonify(new_name)
    except Exception as e:
        return jsonify({"error": str(e)}), 404


""" 
    PERSISTENT GLOBAL SETTINGS

    ChainForge global settings are stored in a JSON file in the local disk.
    This is used to persist settings across sessions.
    The settings file 'settings.json' is stored in the same directory as the user's flows.
"""
@app.route('/api/getConfig/<name>', methods=['GET'])
def get_settings(name):
    """Return the requested config"""
    filepath = os.path.join(FLOWS_DIR, f"{name}.json")
    secure_mode = SECURE_MODE == "all" or (SECURE_MODE == "settings" and name == "settings")
    settings, _ = load_json_file(
        filepath_w_ext=filepath, 
        secure=secure_mode,
        password=FLOWS_DIR_PWD if secure_mode else None,
    )
    if settings is None:
        settings = {}
    return jsonify(settings)

@app.route('/api/saveConfig/<name>', methods=['POST'])
def save_settings(name):
    """Save the current settings"""
    data = request.json

    # Check the type of data
    if not isinstance(data, dict):
        return jsonify({"error": "Settings must be a JSON object."}), 400

    try:
        filepath = os.path.join(FLOWS_DIR, f"{name}.json")
        secure_mode = SECURE_MODE == "all" or (SECURE_MODE == "settings" and name == "settings")
        success = save_json_file(
            filepath_w_ext=filepath, 
            data=data, 
            secure=secure_mode,
            password=FLOWS_DIR_PWD if secure_mode else None,
        )
        if not success:
            return jsonify({"error": "Failed to save settings."}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    return jsonify({"message": "Settings saved successfully!"})


"""
    Media File Storage and Retrieval
    (Images, PDFs, Videos, etc.)
"""
def compute_file_hash(file_stream):
    """Calculate SHA256 hash of a file-like object (does not reset pointer)."""
    hash_obj = hashlib.sha256()
    file_stream.seek(0)
    while chunk := file_stream.read(8192):
        hash_obj.update(chunk)
    file_stream.seek(0)  # Reset for reuse
    return hash_obj.hexdigest()

def gen_unique_media_filename(ext, existing_filenames):
    """Generate a new unique filename using UUID, retrying on rare clash."""
    while True:
        uid = str(uuid.uuid4()) + ext
        if uid not in existing_filenames:
            return uid

@app.route('/upload', methods=['POST'])
def upload():
    """Store a file to the backend and return a unique identifier (UID) for it."""
    file = request.files['file']
    ext = os.path.splitext(file.filename)[1].lower()

    # Compute hash of content to check for duplicates
    file_hash = compute_file_hash(file.stream)

    # Search for existing file by hash (filename format: hash + ext)
    for fname in os.listdir(MEDIA_DIR):
        if fname.startswith(file_hash):
            return jsonify(uid=fname)  # Already exists

    # Create new UID: hash + uuid + ext to prevent hash collision issues
    uid = f"{file_hash}-{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(MEDIA_DIR, uid)

    # Double-check: regenerate if clash (extremely unlikely)
    existing = set(os.listdir(MEDIA_DIR))
    while uid in existing:
        uid = f"{file_hash}-{uuid.uuid4().hex}{ext}"
        file_path = os.path.join(MEDIA_DIR, uid)

    file.save(file_path)
    return jsonify(uid=uid)

@app.route('/media/<uid>')
def get_media(uid):
    """Retrieve a file from the media directory using its UID."""
    return send_from_directory(MEDIA_DIR, uid, as_attachment=False)

@app.route('/mediaExists/<uid>')
def has_media(uid):
    """Check if a file exists in the media directory using its UID."""
    file_path = os.path.join(MEDIA_DIR, uid)
    if os.path.isfile(file_path):
        return jsonify({"exists": True})
    else:
        return jsonify({"exists": False}), 404

@app.route('/mediaToText/<uid>', methods=['GET'])
def media_to_text(uid):
    """
    Convert a media file to text using the appropriate method.
    For currently supported formats, see function body.
    """
    file_path = os.path.join(MEDIA_DIR, uid)
    if not os.path.isfile(file_path):
        return jsonify({"error": "File not found"}), 404

    try:
        ext = os.path.splitext(file_path)[1].lower()

        allowed_extensions = {".pdf", ".txt", ".docx", ".xlsx", ".xls", ".pptx"}
        if ext == '.txt':
            # Read text files directly
            with open(file_path, 'rb') as f:
                file_bytes = f.read()
            text = file_bytes.decode("utf-8", errors="ignore")
        elif ext in allowed_extensions:
            # We use markitdown for all other file types
            md = MarkItDown(enable_plugins=False)
            result = md.convert(file_path)
            text = result.text_content
        else:
            return jsonify({"error": f"Unsupported file type: {ext}. Allowed types: {', '.join(allowed_extensions)}"}), 400

        return jsonify(text=text), 200
    except Exception as e:
        print(f"An error occurred during file processing for {uid}: {e}", file=sys.stderr)
        # Optionally, log the full traceback here if needed for debugging
        # import traceback
        # traceback.print_exc()
        return jsonify({"error": f"Failed to process file {uid}. Internal server error."}), 500

@app.route('/api/exportFlowBundle', methods=['POST'])
def export_flow_bundle():
    """
    Export a flow and all its associated media files as a zip bundle.
    
    Expected JSON body:
    - flow: The flow as JSON data
    - flowName: (Optional) The name to use for the zip file
    
    Returns a zip file containing the flow.json and a media folder with all referenced files.
    """

    # Create a temporary file that will be deleted after the response is sent
    temp_zip = tempfile.NamedTemporaryFile(delete=False, suffix='.cfzip')
    temp_zip.close()
    
    try:
        # Get the request data
        try:
            data = request.get_json()
        except Exception as e:
            return jsonify({"error": f"Failed to parse JSON payload: {str(e)}"}), 400

        if not data or "flow" not in data:
            return jsonify({"error": "No flow data provided. Ensure the request body contains a 'flow' key."}), 400
        
        flow_data = data["flow"]
        flow_name = data.get("flowName", "flow_bundle")
        # Sanitize the flow name for use as a filename
        flow_name = "".join(c for c in flow_name if c.isalnum() or c in " _-").strip()
        if not flow_name:
            flow_name = "flow_bundle"
        
        # Extract media UIDs if they exist
        media_uids = []
        if "cache" in flow_data and "__media" in flow_data["cache"]:
            media_data = flow_data["cache"]["__media"]
            if isinstance(media_data, dict) and "uids" in media_data:
                media_uids = media_data["uids"]
        
        # Create a temporary directory for the bundle contents
        with tempfile.TemporaryDirectory() as temp_dir:
            # Create media subdirectory
            media_dir = os.path.join(temp_dir, "media")
            os.makedirs(media_dir, exist_ok=True)
            
            # Write the flow JSON to the temp directory
            flow_path = os.path.join(temp_dir, "flow.json")
            with open(flow_path, 'w', encoding='utf-8') as f:
                json.dump(flow_data, f)
            
            # Copy each referenced media file to the media subdirectory
            missing_files = []
            for uid in media_uids:
                src_file = os.path.join(MEDIA_DIR, uid)
                if os.path.exists(src_file):
                    dst_file = os.path.join(media_dir, uid)
                    shutil.copy2(src_file, dst_file)
                else:
                    missing_files.append(uid)
            
            if missing_files:
                print(f"Warning: {len(missing_files)} media files not found: {missing_files[:5]}...", file=sys.stderr)
            
            # Create the zip file
            with zipfile.ZipFile(temp_zip.name, 'w', zipfile.ZIP_DEFLATED) as zipf:
                # Walk through the temp directory and add all files
                for root, dirs, files in os.walk(temp_dir):
                    for file in files:
                        file_path = os.path.join(root, file)
                        # Get relative path for the zip structure
                        rel_path = os.path.relpath(file_path, temp_dir)
                        zipf.write(file_path, rel_path)
        
        # Set up file cleanup after the response is sent
        @after_this_request
        def cleanup(response):
            try:
                os.unlink(temp_zip.name)
            except Exception as e:
                print(f"Error cleaning up temp zip file: {str(e)}", file=sys.stderr)
            return response
        
        # Return the zip file as an attachment
        return send_file(
            temp_zip.name,
            as_attachment=True,
            download_name=f"{flow_name}.cfzip",
            mimetype="application/zip"
        )
            
    except Exception as e:
        # Make sure to clean up the temp file if there's an error
        try:
            os.unlink(temp_zip.name)
        except:
            pass
        
        print(f"Error exporting flow bundle: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Failed to export flow bundle: {str(e)}"}), 500

@app.route('/api/importFlowBundle', methods=['POST'])
def import_flow_bundle():
    """
    Import a flow bundle (.cfzip file) that contains a flow.json and associated media files.
    
    Extracts the flow.json and copies all media files to the local MEDIA_DIR.
    
    Returns:
    - The flow JSON data
    - The name of the flow
    """
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
        
    if not file.filename.endswith('.cfzip') and not file.filename.endswith('.zip'):
        return jsonify({"error": "Invalid file format. Expected .cfzip or .zip file"}), 400
    
    # Create temporary directories for extraction
    temp_dir = tempfile.mkdtemp()
    try:
        # Extract the zip file
        zip_path = os.path.join(temp_dir, "bundle.zip")
        file.save(zip_path)
        
        extract_dir = os.path.join(temp_dir, "extracted")
        os.makedirs(extract_dir, exist_ok=True)
        
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(extract_dir)
        
        # Check if the expected structure exists
        flow_path = os.path.join(extract_dir, "flow.json")
        media_dir = os.path.join(extract_dir, "media")
        
        if not os.path.exists(flow_path):
            return jsonify({"error": "Invalid bundle format. Missing flow.json file"}), 400
            
        # Load the flow data
        with open(flow_path, 'r', encoding='utf-8') as f:
            flow_data = json.load(f)
            
        # Get base name for the flow (without extension)
        flow_name = os.path.splitext(os.path.basename(file.filename))[0]
            
        # Make sure the name doesn't clash with existing flows in FLOWS_DIR
        flow_name = _get_unique_flow_name(flow_name)
        
        # Import bundled media files to MEDIA_DIR if they exist
        if os.path.exists(media_dir) and os.path.isdir(media_dir):
            os.makedirs(MEDIA_DIR, exist_ok=True)
            
            # Copy all media files
            imported_media = []
            for media_file in os.listdir(media_dir):
                src_path = os.path.join(media_dir, media_file)
                dst_path = os.path.join(MEDIA_DIR, media_file)
                
                if os.path.isfile(src_path):
                    # Verify the media file's integrity
                    try:
                        verify_media_file_integrity(media_file)
                    except Exception as e:
                        print(f"Failed to verify media file integrity: {str(e)}. Skipping (this result in a corrupted flow import)...", file=sys.stderr)
                        continue

                    # Media file is valid, copy it to MEDIA_DIR
                    # Check if file already exists to avoid duplicates
                    if not os.path.exists(dst_path):
                        shutil.copy2(src_path, dst_path)
                    imported_media.append(media_file)
            
            print(f"Imported {len(imported_media)} media files from bundle.")
            
            # Update __media in flow data if needed
            if "cache" in flow_data and "__media" in flow_data["cache"]:
                # Ensure the UIDs in the flow match with what was imported
                media_data = flow_data["cache"]["__media"]
                if isinstance(media_data, dict) and "uids" in media_data:
                    # Verify all referenced UIDs were actually imported
                    missing_uids = [uid for uid in media_data["uids"] if uid not in imported_media]
                    if missing_uids:
                        print(f"Warning: {len(missing_uids)} referenced media files were not found in the bundle. Flow data may be corrupted.")
        
        # Save the flow to the FLOWS_DIR
        secure_mode = SECURE_MODE == "all"
        flow_path = os.path.join(FLOWS_DIR, f"{flow_name}.cforge")
        success = save_json_file(
            filepath_w_ext=flow_path,
            data=flow_data,
            secure=secure_mode,
            password=FLOWS_DIR_PWD if secure_mode else None,
        )
        
        if not success:
            return jsonify({"error": "Failed to save imported flow"}), 500
            
        return jsonify({
            "flow": flow_data,
            "flowName": flow_name,
        })
        
    except Exception as e:
        print(f"Error importing flow bundle: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Failed to import flow bundle: {str(e)}"}), 500
    finally:
        # Clean up temporary files
        try:
            shutil.rmtree(temp_dir)
        except:
            print(f"Warning: Failed to clean up temporary directory: {temp_dir}", file=sys.stderr)

def verify_media_file_integrity(uid):
    """
    Verifies if a media file's content hash matches the hash in its filename.
    Raises an error if the hash does not match. Passes if the file is valid.
    
    Args:
        uid (str): The unique identifier (filename) of the media file
        
    Returns:
        dict: Result containing 'valid' (boolean) and additional hash information
    """
    file_path = os.path.join(MEDIA_DIR, uid)
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File {file_path} does not exist.")
    
    # Extract hash from filename (everything before the first hyphen)
    if '-' in uid:
        expected_hash = uid.split('-')[0]
    else:
        raise ValueError(f"Invalid media file name format: {uid}. Expected format is <hash>-<uuid>.<ext>")
    
    # Compute actual hash of file content
    with open(file_path, 'rb') as f:
        actual_hash = compute_file_hash(f)
    
    if expected_hash != actual_hash:
        raise ValueError(f"Hash mismatch: expected {expected_hash}, got {actual_hash}")


@app.route('/api/proxyImage', methods=['GET'])
def proxy_image():
    """Proxy for fetching images to avoid CORS restrictions"""
    url = request.args.get('url')
    if not url:
        return jsonify({"error": "URL parameter is required"}), 400
    
    try:
        # Use Python requests to fetch the image
        response = py_requests.get(url, stream=True)

        if not response.ok:
            return jsonify({"error": f"Failed to fetch image: {response.status_code} {response.reason}"}), response.status_code
        
        # Check if content is an image
        content_type = response.headers.get('Content-Type', '')
        if not content_type.startswith('image/'):
            return jsonify({"error": "The URL does not point to an image"}), 400
    
        # Create a Flask response with the image content
        flask_response = app.response_class(
            response=response.raw,
            status=response.status_code,
            headers=dict(response.headers)
        )
        
        return flask_response
    
    except Exception as e:
        return jsonify({"error": f"Error fetching image: {str(e)}"}), 500

      
""" 
    SPIN UP SERVER
"""
def run_server(host="", port=8000, flows_dir=None, secure: Literal["off", "settings", "all"] = "off"):
    global HOSTNAME, PORT, FLOWS_DIR, MEDIA_DIR, SECURE_MODE, FLOWS_DIR_PWD
    HOSTNAME = host
    PORT = port
    SECURE_MODE = secure
    if flows_dir:
        # Set the flows directory to the specified path. 
        # and create it if it doesn't exist.
        FLOWS_DIR = flows_dir
        MEDIA_DIR = os.path.join(flows_dir, "media")
    
    # Make sure the directories for local storage exist
    os.makedirs(FLOWS_DIR, exist_ok=True)
    os.makedirs(MEDIA_DIR, exist_ok=True)

    # Get the user password, if `secure` is set to "settings" or "all".
    # :: Create a new password and salt if one doesn't exist, or uses the existing one.
    if secure != "off":
        password = ensure_password(
            hash_filepath=os.path.join(FLOWS_DIR, "salt.bin"), 
            create_new_msg="\nWelcome to ChainForge! We've noticed you are entering secure mode for the first time. Please enter a password to encrypt your flows and settings. Prepare to enter it again whenever you start ChainForge in secure mode.\n")
        if not password:
            print("❌ Password cannot be empty. Please provide a password.")
            exit(1)
        FLOWS_DIR_PWD = password

    app.run(host=host, port=port, debug=False)

if __name__ == '__main__':
    print("Run app.py instead.")