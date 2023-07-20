import json, os, asyncio, sys, traceback
from dataclasses import dataclass
from enum import Enum
from typing import List
from statistics import mean, median, stdev
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from chainforge.promptengine.utils import LLM, call_dalai
import requests as py_requests

""" =================
    SETUP AND GLOBALS
    =================
"""

# Setup Flask app to serve static version of React front-end
HOSTNAME = "localhost"
PORT = 8000
BUILD_DIR = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'react-server', 'build')
STATIC_DIR = os.path.join(BUILD_DIR, 'static')
app = Flask(__name__, static_folder=STATIC_DIR, template_folder=BUILD_DIR)

# Set up CORS for specific routes
cors = CORS(app, resources={r"/*": {"origins": "*"}})

# The cache and examples files base directories
CACHE_DIR = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'cache')
EXAMPLES_DIR = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'examples')

LLM_NAME_MAP = {} 
for model in LLM:
    LLM_NAME_MAP[model.value] = model

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

def run_over_responses(eval_func, responses: list, scope: str) -> list:
    for resp_obj in responses:
        res = resp_obj['responses']
        if scope == 'response':
            # Run evaluator func over every individual response text
            evals = [eval_func(
                        ResponseInfo(
                            text=r,
                            prompt=resp_obj['prompt'],
                            var=resp_obj['vars'],
                            meta=resp_obj['metavars'] if 'metavars' in resp_obj else {},
                            llm=resp_obj['llm'])
                    ) for r in res]

            # Check the type of evaluation results
            # NOTE: We assume this is consistent across all evaluations, but it may not be.
            eval_res_type = check_typeof_vals(evals)

            if eval_res_type == MetricType.Numeric:
                # Store items with summary of mean, median, etc
                resp_obj['eval_res'] = {
                    'mean': mean(evals),
                    'median': median(evals),
                    'stdev': stdev(evals) if len(evals) > 1 else 0,
                    'range': (min(evals), max(evals)),
                    'items': evals,
                    'dtype': eval_res_type.name,
                }
            elif eval_res_type in (MetricType.Unknown, MetricType.Empty):
                raise Exception('Unsupported types found in evaluation results. Only supported types for metrics are: int, float, bool, str.')
            else:
                # Categorical, KeyValue, etc, we just store the items:
                resp_obj['eval_res'] = { 
                    'items': evals,
                    'dtype': eval_res_type.name,
                }
        else:  
            # Run evaluator func over the entire response batch
            ev = eval_func([
                    ResponseInfo(text=r,
                                 prompt=resp_obj['prompt'],
                                 var=resp_obj['vars'],
                                 llm=resp_obj['llm'])
                for r in res])
            ev_type = check_typeof_vals([ev])
            if ev_type == MetricType.Numeric:
                resp_obj['eval_res'] = {
                    'mean': ev,
                    'median': ev,
                    'stdev': 0,
                    'range': (ev, ev),
                    'items': [ev],
                    'type': ev_type.name,
                }
            else:
                resp_obj['eval_res'] = { 
                    'items': [ev],
                    'type': ev_type.name,
                }
    return responses


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
        over all the `StandardizedLLMResponse` objects passed in from the front-end. 

        POST'd data should be in the form: 
        {
            'id': # a unique ID to refer to this information. Used when cache'ing responses. 
            'code': str,  # the body of the lambda function to evaluate, in form: lambda responses: <body>
            'responses': List[StandardizedLLMResponse]  # the responses to run on.
            'scope': 'response' | 'batch'  # the scope of responses to run on --a single response, or all across each batch. 
                                           # If batch, evaluator has access to 'responses'. Only matters if n > 1 for each prompt.
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

    # add the path to any scripts to the path:
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

    # Create the evaluator function
    # DANGER DANGER! 
    try:
        exec(data['code'], globals())

        # Double-check that there is an 'evaluate' method in our namespace. 
        # This will throw a NameError if not: 
        evaluate  # noqa
    except Exception as e:
        return jsonify({'error': f'Could not compile evaluator code. Error message:\n{str(e)}'})
    
    evald_responses = []
    logs = []
    try:
        HIJACK_PYTHON_PRINT()
        evald_responses = run_over_responses(evaluate, responses, scope=data['scope'])  # noqa
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
            name: <str>  # The name of the eval to grab (without .cforge extension)
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
    import requests
    _url = f"https://raw.githubusercontent.com/ianarawjo/ChainForge/main/chainforge/oaievals/{evalname}.cforge"
    response = requests.get(_url)

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
        'ANTHROPIC_API_KEY': 'Anthropic', 
        'PALM_API_KEY': 'Google', 
        'HUGGINGFACE_API_KEY': 'HuggingFace',
        'AZURE_OPENAI_KEY': 'Azure_OpenAI', 
        'AZURE_OPENAI_ENDPOINT': 'Azure_OpenAI_Endpoint'
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
            url: <str>  # the url to fetch from
            headers: <dict>  # a JSON object of the headers
            body: <dict>  # the request payload, as JSON
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
        return jsonify({'error': 'API request to Anthropic failed'})


@app.route('/app/callDalai', methods=['POST'])
async def callDalai():
    """
        Fetch response from a Dalai-hosted model (Alpaca or Llama).
        Requires Python backend since depends on custom library code to extract response.

        POST'd data should be a dict of keyword arguments to provide the call_dalai method.
    """
    # Verify post'd data
    data = request.get_json()
    if not set(data.keys()).issuperset({'prompt', 'model', 'server', 'n', 'temperature'}):
        return jsonify({'error': 'POST data is improper format.'})

    data['model'] = LLM_NAME_MAP[data['model']]

    try:
        query, response = await call_dalai(**data)
    except Exception as e:
        return jsonify({'error': str(e)})

    ret = jsonify({'query': query, 'response': response})
    ret.headers.add('Access-Control-Allow-Origin', '*')
    return ret


def run_server(host="", port=8000, cmd_args=None):
    global HOSTNAME, PORT
    HOSTNAME = host
    PORT = port    
    app.run(host=host, port=port)

if __name__ == '__main__':
    print("Run app.py instead.")