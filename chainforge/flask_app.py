import json, os, asyncio, sys, traceback
from dataclasses import dataclass
from enum import Enum
from typing import Union, List
from statistics import mean, median, stdev
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from chainforge.promptengine.query import PromptLLM, PromptLLMDummy, LLMResponseException
from chainforge.promptengine.template import PromptTemplate, PromptPermutationGenerator
from chainforge.promptengine.utils import LLM, is_valid_filepath, get_files_at_dir, create_dir_if_not_exists, set_api_keys


""" =================
    SETUP AND GLOBALS
    =================
"""

# Setup Flask app to serve static version of React front-end
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

def to_standard_format(r: dict) -> list:
    resp_obj = {
        'vars': r['info'],
        'metavars': r['metavars'] if 'metavars' in r else {},
        'llm': r['llm'],
        'prompt': r['prompt'],
        'responses': r['responses'],
        'tokens': r['raw_response']['usage'] if 'usage' in r['raw_response'] else {},
    }
    if 'eval_res' in r:
        resp_obj['eval_res'] = r['eval_res']
    return resp_obj

def get_filenames_for_id(cache_id: str, include_basefile=True) -> List[str]:
    # Load the base cache file
    base_file = f"{cache_id}.json"
    data = load_cache_json(base_file)
    if isinstance(data, dict) and 'cache_files' in data:
        return list(data['cache_files'].keys()) + ([base_file] if include_basefile else [])
    else:
        return [base_file]

def remove_cached_responses(cache_id: str):
    cache_files = get_filenames_for_id(cache_id)
    for filename in cache_files:
        os.remove(os.path.join(CACHE_DIR, filename))

def load_cache_json(filename: str) -> dict:
    """
        Loads the cache JSON file at filepath. 
        'Soft fails' if the file does not exist (returns empty object).
    """
    filepath = os.path.join(CACHE_DIR, filename)
    if os.path.exists(filepath):
        with open(filepath, encoding="utf-8") as f:
            data = json.load(f)
    else:
        data = {}
    return data

def load_cache_responses(filename: str) -> List[dict]:
    data = load_cache_json(filename)
    if isinstance(data, dict) and 'responses_last_run' in data:
        return data['responses_last_run']
    elif isinstance(data, list):
        return data
    else:
        raise Exception(f"Could not find cache file for id {filename}")

def gen_unique_cache_filename(cache_id, prev_filenames: List[str]) -> str:
    idx = 0
    for f in prev_filenames:
        idx = max(int(f.split('.')[-2].split('_')[-1])+1, idx)
    return f"{cache_id}_{idx}.json"

def extract_llm_nickname(llm_spec):
    if isinstance(llm_spec, dict) and 'name' in llm_spec: 
        return llm_spec['name']
    else:
        return llm_spec

def extract_llm_name(llm_spec):
    if isinstance(llm_spec, dict): 
        return llm_spec['model']
    else:
        return llm_spec

def extract_llm_key(llm_spec):
    if isinstance(llm_spec, dict) and 'key' in llm_spec:
        return llm_spec['key']
    else:
        return llm_spec

def extract_llm_params(llm_spec):
    if isinstance(llm_spec, dict) and 'settings' in llm_spec:
        return llm_spec['settings']
    else:
        return {}

def matching_settings(cache_llm_spec: dict, llm_spec: dict):
    """
        Given a cache'd response object, and an LLM name and set of parameters (settings to use), 
        determines whether the response query used the same parameters.
    """
    if extract_llm_name(cache_llm_spec) != extract_llm_name(llm_spec):
        return False
    if isinstance(llm_spec, dict) and isinstance(cache_llm_spec, dict):
        llm_params = extract_llm_params(llm_spec)
        cache_llm_params = extract_llm_params(cache_llm_spec)
        for param, val in llm_params.items():
            if param in cache_llm_params and cache_llm_params[param] != val:
                return False
    return True

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

def reduce_responses(responses: list, vars: list) -> list:
    if len(responses) == 0: return responses
    
    # Figure out what vars we still care about (the ones we aren't reducing over):
    # NOTE: We are assuming all responses have the same 'vars' keys. 
    all_vars = set(responses[0]['vars'])
    
    if not all_vars.issuperset(set(vars)):
        # There's a var in vars which isn't part of the response.
        raise Exception(f"Some vars in {set(vars)} are not in the responses.")
    
    # Get just the vars we want to keep around:
    include_vars = list(set(responses[0]['vars']) - set(vars))

    # Bucket responses by the remaining var values, where tuples of vars are keys to a dict: 
    # E.g. {(var1_val, var2_val): [responses] }
    bucketed_resp = {}
    for r in responses:
        tup_key = tuple([r['vars'][v] for v in include_vars])
        if tup_key in bucketed_resp:
            bucketed_resp[tup_key].append(r)
        else:
            bucketed_resp[tup_key] = [r]

    # Perform reduce op across all bucketed responses, collecting them into a single 'meta'-response:
    ret = []
    for tup_key, resps in bucketed_resp.items():
        flat_eval_res = [item for r in resps for item in r['eval_res']['items']]
        ret.append({
            'vars': {v: r['vars'][v] for r in resps for v in include_vars},
            'llm': resps[0]['llm'],
            'prompt': [r['prompt'] for r in resps],
            'responses': [r['responses'] for r in resps],
            'tokens': resps[0]['tokens'],
            'eval_res': {
                'mean': mean(flat_eval_res),
                'median': median(flat_eval_res),
                'stdev': stdev(flat_eval_res) if len(flat_eval_res) > 1 else 0,
                'range': (min(flat_eval_res), max(flat_eval_res)),
                'items': flat_eval_res
            }
        })
    
    return ret



""" ===================
    FLASK SERVER ROUTES
    ===================
"""

# Serve React app (static; no hot reloading)
@app.route("/")
def index():
    return render_template("index.html")

@app.route('/app/countQueriesRequired', methods=['POST'])
def countQueries():
    """
        Returns how many queries we need to make, given the passed prompt and vars.

        POST'd data should be in the form: 
        {
            'prompt': str  # the prompt template, with any {{}} vars
            'vars': dict  # a dict of the template variables to fill the prompt template with, by name. 
                          # For each var, can be single values or a list; in the latter, all permutations are passed. (Pass empty dict if no vars.)
            'llms': list  # the list of LLMs you will query
            'n': int  # how many responses expected per prompt
            'id': str (optional)  # a unique ID of the node with cache'd responses. If missing, assumes no cache will be used.
        }
    """
    data = request.get_json()
    if not set(data.keys()).issuperset({'prompt', 'vars', 'llms', 'n'}):
        return jsonify({'error': 'POST data is improper format.'})
    
    n = int(data['n'])

    try:
        gen_prompts = PromptPermutationGenerator(PromptTemplate(data['prompt']))
        all_prompt_permutations = list(gen_prompts(data['vars']))
    except Exception as e:
        return jsonify({'error': str(e)})
    
    if 'id' in data:
        cache_data = load_cache_json(f"{data['id']}.json")
        cache_file_lookup = cache_data['cache_files'] if 'cache_files' in cache_data else {}
    else:
        cache_file_lookup = {}
    
    missing_queries = {}
    num_responses_req = {}
    def add_to_missing_queries(llm_key, prompt, num):
        if llm_key not in missing_queries:
            missing_queries[llm_key] = {}
        missing_queries[llm_key][prompt] = num
    def add_to_num_responses_req(llm_key, num):
        if llm_key not in num_responses_req:
            num_responses_req[llm_key] = 0
        num_responses_req[llm_key] += num
    
    for llm_spec in data['llms']:
        llm_key = extract_llm_key(llm_spec)

        # Find the response cache file for the specific LLM, if any
        found_cache = False
        for cache_filename, cache_llm_spec in cache_file_lookup.items():
            if matching_settings(cache_llm_spec, llm_spec):
                found_cache = True

                # Load the cache file
                cache_llm_responses = load_cache_json(cache_filename)

                # Iterate through all prompt permutations and check if how many responses there are in the cache with that prompt
                for prompt in all_prompt_permutations:

                    prompt = str(prompt)
                    add_to_num_responses_req(llm_key, n)

                    if prompt in cache_llm_responses:
                        # Check how many were stored; if not enough, add how many missing queries:
                        num_resps = len(cache_llm_responses[prompt]['responses'])
                        if n > num_resps:
                            add_to_missing_queries(llm_key, prompt, n - num_resps)
                    else:
                        add_to_missing_queries(llm_key, prompt, n)
                
                break
        
        if not found_cache:
            for prompt in all_prompt_permutations:
                add_to_num_responses_req(llm_key, n)
                add_to_missing_queries(llm_key, str(prompt), n)

    ret = jsonify({'counts': missing_queries, 'total_num_responses': num_responses_req})
    ret.headers.add('Access-Control-Allow-Origin', '*')
    return ret

@app.route('/app/createProgressFile', methods=['POST'])
def createProgressFile():
    """
        Creates a temp txt file for storing progress of async LLM queries.

        POST'd data should be in the form: 
        {
            'id': str  # a unique ID that will be used when calling 'queryllm'
        }
    """
    data = request.get_json()

    if 'id' not in data or not isinstance(data['id'], str) or len(data['id']) == 0:
        return jsonify({'error': 'POST data id is improper format (length 0 or not a string).'})

    # Create a scratch file for keeping track of how many responses loaded
    try:
        with open(os.path.join(CACHE_DIR, f"_temp_{data['id']}.txt"), 'w', encoding='utf-8') as f:
            json.dump({}, f)
        ret = jsonify({'success': True})
    except Exception as e:
        ret = jsonify({'success': False, 'error': str(e)})
    
    ret.headers.add('Access-Control-Allow-Origin', '*')
    return ret

# @socketio.on('connect', namespace='/queryllm')
@app.route('/app/queryllm', methods=['POST'])
async def queryLLM():
    """
        Queries LLM(s) given a JSON spec.

        POST'd data should be in the form: 
        {
            'id': str  # a unique ID to refer to this information. Used when cache'ing responses. 
            'llm': str | list[str] | list[dict]  # a string, list of strings, or list of LLM spec dicts specifying the LLM(s) to query.
            'n': int  # the amount of generations for each prompt. All LLMs will be queried the same number of times 'n' per each prompt.
            'prompt': str  # the prompt template, with any {{}} vars
            'vars': dict  # a dict of the template variables to fill the prompt template with, by name. 
                          # For each var, can be single values or a list; in the latter, all permutations are passed. (Pass empty dict if no vars.)
            'api_keys': dict  # (optional) a dict of {api_name: api_key} pairs. Supported key names: OpenAI, Anthropic, Google
            'no_cache': bool (optional)  # delete any cache'd responses for 'id' (always call the LLM fresh)
        }
    """
    data = request.get_json()

    # Check that all required info is here:
    if not set(data.keys()).issuperset({'llm', 'prompt', 'vars', 'id'}):
        return jsonify({'error': 'POST data is improper format.'})
    elif not isinstance(data['id'], str) or len(data['id']) == 0:
        return jsonify({'error': 'POST data id is improper format (length 0 or not a string).'})
    
    # Verify LLM name(s) (string or list) and convert to enum(s):
    if not (isinstance(data['llm'], list) or isinstance(data['llm'], str)) or (isinstance(data['llm'], list) and len(data['llm']) == 0):
        return jsonify({'error': 'POST data llm is improper format (not string or list, or of length 0).'})
    if isinstance(data['llm'], str):
        data['llm'] = [ data['llm'] ]

    for llm_spec in data['llm']:
        if extract_llm_name(llm_spec) not in LLM_NAME_MAP:
            return jsonify({'error': f"LLM named '{extract_llm_name(llm_spec)}' is not supported."})
    
    if 'api_keys' in data:
        set_api_keys(data['api_keys'])

    if 'no_cache' in data and data['no_cache'] is True:
        remove_cached_responses(data['id'])

    # Create a cache dir if it doesn't exist:
    create_dir_if_not_exists(CACHE_DIR)

    # Check that the filepath used to cache responses is valid:
    cache_filepath_last_run = os.path.join(CACHE_DIR, f"{data['id']}.json")
    if not is_valid_filepath(cache_filepath_last_run):
        return jsonify({'error': f'Invalid filepath: {cache_filepath_last_run}'})
    
    # Get the filenames of any cache files for specific models + settings
    llms = data['llm']
    cache = load_cache_json(cache_filepath_last_run)
    llm_to_cache_filename = {}
    if isinstance(cache, dict) and 'cache_files' in cache:
        past_cachefiles = list(cache['cache_files'].keys())
        for llm_spec in llms:
            found_cache = False
            for filename, cache_llm_spec in cache['cache_files'].items():
                if matching_settings(cache_llm_spec, llm_spec):
                    llm_to_cache_filename[extract_llm_key(llm_spec)] = filename
                    found_cache = True
                    break
            if not found_cache:
                new_filename = gen_unique_cache_filename(data['id'], past_cachefiles)
                llm_to_cache_filename[extract_llm_key(llm_spec)] = new_filename
                cache['cache_files'][new_filename] = llm_spec
                past_cachefiles.append(new_filename)
    else:
        cache = { 'cache_files': {}, 'responses_last_run': [] }
        prev_filenames = []
        for llm_spec in llms:
            fname = gen_unique_cache_filename(data['id'], prev_filenames)
            llm_to_cache_filename[extract_llm_key(llm_spec)] = fname
            cache['cache_files'][fname] = llm_spec
            prev_filenames.append(fname)

    # Store the overall cache file for this id,
    # so we can remember where the individual cache files are stored:
    with open(cache_filepath_last_run, "w", encoding='utf-8') as f:
        json.dump(cache, f)

    # For each LLM, generate and cache responses:
    responses = {}
    all_errors = {}
    num_generations = data['n'] if 'n' in data else 1
    tempfilepath = os.path.join(CACHE_DIR, f"_temp_{data['id']}.txt")
    if not is_valid_filepath(tempfilepath):
        return jsonify({'error': f'Invalid filepath: {tempfilepath}'})

    async def query(llm_spec: Union[str, dict]) -> list:
        # Get LLM model name and any params
        llm_str = extract_llm_name(llm_spec)
        llm_nickname = extract_llm_nickname(llm_spec)
        llm_params = extract_llm_params(llm_spec)
        llm_key = extract_llm_key(llm_spec)

        # Get the appropriate LLM enum value associated with the model name
        llm = LLM_NAME_MAP[llm_str]

        # Check that storage path is valid:
        cache_filepath = os.path.join(CACHE_DIR, llm_to_cache_filename[llm_key])
        if not is_valid_filepath(cache_filepath):
            return jsonify({'error': f'Invalid filepath: {cache_filepath}'})

        # Create an object to query the LLM, passing a file for cache'ing responses
        prompter = PromptLLM(data['prompt'], storageFile=cache_filepath)

        # Prompt the LLM with all permutations of the input prompt template:
        # NOTE: If the responses are already cache'd, this just loads them (no LLM is queried, saving $$$)
        resps = []
        errors = []
        num_resps = 0
        num_errors = 0
        try:
            print(f'Querying {llm}...')

            # Yield responses for 'llm' for each prompt generated from the root template 'prompt' and template variables in 'properties':
            async for response in prompter.gen_responses(properties=data['vars'], llm=llm, n=num_generations, **llm_params):

                # Check for selective failure
                if isinstance(response, LLMResponseException):  # The request failed
                    print(f"error when fetching response from {llm.name}: {response}")
                    num_errors += 1
                    errors.append(str(response))
                else:  # The request succeeded
                    # The response name will be the name of the LLM. However,
                    # for the front-end it is more informative to store the user-provided nickname. 
                    response['llm'] = llm_nickname

                    num_resps += len(response['responses'])
                    resps.append(response)
                
                # Save the current progress to a temp file on disk
                with open(tempfilepath, 'r', encoding='utf-8') as f:
                    txt = f.read().strip()
                
                cur_data = json.loads(txt) if len(txt) > 0 else {}
                cur_data[llm_key] = {
                    'success': num_resps,
                    'error': num_errors
                }
                
                with open(tempfilepath, 'w', encoding='utf-8') as f:
                    json.dump(cur_data, f)
        except Exception as e:
            print(f'error generating responses for {llm}:', e)
            print(traceback.format_exc())
            raise e
        
        return {'llm_key': llm_key, 'responses': resps, 'errors': errors}
        
    try:
        # Request responses simultaneously across LLMs
        tasks = [query(llm_spec) for llm_spec in llms]

        # Await the responses from all queried LLMs
        llm_results = await asyncio.gather(*tasks)
        for item in llm_results:
            responses[item['llm_key']] = item['responses']
            if len(item['errors']) > 0:
                all_errors[item['llm_key']] = item['errors']

    except Exception as e:
        print('Error requesting responses:', e)
        print(traceback.format_exc())
        return jsonify({'error': str(e)})

    # Convert the responses into a more standardized format with less information
    res = [
        to_standard_format(r)
        for rs in responses.values()
        for r in rs
    ]

    # Remove the temp file used to stream progress updates:
    if os.path.exists(tempfilepath):
        os.remove(tempfilepath)
    
    # Save the responses *of this run* to the disk, for further recall:
    cache_filenames = {}
    for llm_spec in llms:
        filename = llm_to_cache_filename[extract_llm_key(llm_spec)]
        cache_filenames[filename] = llm_spec

    cache_data = {
        "cache_files": cache_filenames,
        "responses_last_run": res,
    }
    with open(cache_filepath_last_run, "w", encoding='utf-8') as f:
        json.dump(cache_data, f)

    # Return all responses for all LLMs
    print('returning responses:', res, 'errors:', all_errors)
    ret = jsonify({'responses': res, 'errors': all_errors})
    ret.headers.add('Access-Control-Allow-Origin', '*')
    return ret

@app.route('/app/execute', methods=['POST'])
def execute():
    """
        Executes a Python lambda function sent from JavaScript,
        over all cache'd responses with given id's.

        POST'd data should be in the form: 
        {
            'id': # a unique ID to refer to this information. Used when cache'ing responses. 
            'code': str,  # the body of the lambda function to evaluate, in form: lambda responses: <body>
            'responses': str | List[str]  # the responses to run on; a unique ID or list of unique IDs of cache'd data,
            'scope': 'response' | 'batch'  # the scope of responses to run on --a single response, or all across each batch. 
                                           # If batch, evaluator has access to 'responses'. Only matters if n > 1 for each prompt.
            'reduce_vars': unspecified | List[str]  # the 'vars' to average over (mean, median, stdev, range)
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
    
    # Check that the filepath used to cache eval'd responses is valid:
    cache_filepath = os.path.join(CACHE_DIR, f"{data['id']}.json")
    if not is_valid_filepath(cache_filepath):
        return jsonify({'error': f'Invalid filepath: {cache_filepath}'})
    
    # Check format of responses:
    if not (isinstance(data['responses'], str) or isinstance(data['responses'], list)):
        return jsonify({'error': 'POST data responses is improper format.'})
    elif isinstance(data['responses'], str):
        data['responses'] = [ data['responses'] ]
    
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

    # Load all responses with the given ID:
    all_cache_files = get_files_at_dir(CACHE_DIR)
    all_evald_responses = []
    all_logs = []
    for cache_id in data['responses']:
        fname = f"{cache_id}.json"
        if fname not in all_cache_files:
            return jsonify({'error': f'Did not find cache file for id {cache_id}', 'logs': all_logs})

        # Load the raw responses from the cache
        responses = load_cache_responses(fname)
        if len(responses) == 0: continue

        # Run the evaluator over them: 
        # NOTE: 'evaluate' here was defined dynamically from 'exec' above. 
        try:
            HIJACK_PYTHON_PRINT()
            evald_responses = run_over_responses(evaluate, responses, scope=data['scope'])  # noqa
            all_logs.extend(REVERT_PYTHON_PRINT())
        except Exception as e:
            all_logs.extend(REVERT_PYTHON_PRINT())
            return jsonify({'error': f'Error encountered while trying to run "evaluate" method:\n{str(e)}', 'logs': all_logs})

        # Perform any reduction operations:
        if 'reduce_vars' in data and len(data['reduce_vars']) > 0:
            evald_responses = reduce_responses(
                evald_responses,
                vars=data['reduce_vars']
            )

        all_evald_responses.extend(evald_responses)

    # Store the evaluated responses in a new cache json:
    with open(cache_filepath, "w", encoding='utf-8') as f:
        json.dump(all_evald_responses, f)

    ret = jsonify({'responses': all_evald_responses, 'logs': all_logs})
    ret.headers.add('Access-Control-Allow-Origin', '*')
    return ret

@app.route('/app/checkEvalFunc', methods=['POST'])
def checkEvalFunc():
    """
        Tries to compile a Python lambda function sent from JavaScript.
        Returns a dict with 'result':true if it compiles without raising an exception; 
        'result':false (and an 'error' property with a message) if not.

        POST'd data should be in form:
        {
            'code': str,  # the body of the lambda function to evaluate, in form: lambda responses: <body>
        }

        NOTE: This should only be run on your server on code you trust.
              There is no sandboxing; no safety. We assume you are the creator of the code.
    """
    data = request.get_json()
    if 'code' not in data:
        return jsonify({'result': False, 'error': 'Could not find "code" in message from front-end.'})

    # DANGER DANGER! Running exec on code passed through front-end. Make sure it's trusted!
    try:
        exec(data['code'], globals())

        # Double-check that there is an 'evaluate' method in our namespace. 
        # This will throw a NameError if not: 
        evaluate  # noqa
        return jsonify({'result': True})
    except Exception as e:
        return jsonify({'result': False, 'error': f'Could not compile evaluator code. Error message:\n{str(e)}'})

@app.route('/app/grabResponses', methods=['POST'])
def grabResponses():
    """
        Returns all responses with the specified id(s)

        POST'd data should be in the form: 
        {
            'responses': <the ids to grab>
        }
    """
    data = request.get_json()

    # Check format of responses:
    if not (isinstance(data['responses'], str) or isinstance(data['responses'], list)):
        return jsonify({'error': 'POST data responses is improper format.'})
    elif isinstance(data['responses'], str):
        data['responses'] = [ data['responses'] ]

    # Load all responses with the given ID:
    all_cache_files = get_files_at_dir(CACHE_DIR)
    responses = []
    for cache_id in data['responses']:
        fname = f"{cache_id}.json"
        if fname not in all_cache_files:
            return jsonify({'error': f'Did not find cache file for id {cache_id}'})
        
        res = load_cache_responses(fname)
        if isinstance(res, dict):
            # Convert to standard response format
            res = [
                to_standard_format({'prompt': prompt, **res_obj})
                for prompt, res_obj in res.items()
            ]
        responses.extend(res)

    ret = jsonify({'responses': responses})
    ret.headers.add('Access-Control-Allow-Origin', '*')
    return ret

@app.route('/app/exportCache', methods=['POST'])
def exportCache():
    """
        Exports the cache'd data relevant to the given node id(s).
        Returns a JSON dict in format { filename: <dict|list> }

        POST'd data should be in the form: 
        {
            'ids': <the ids of the nodes to export data for>
        }
    """
    # Verify post'd data
    data = request.get_json()
    if 'ids' not in data:
        return jsonify({'error': 'Missing ids parameter to exportData.'})
    elif not isinstance(data['ids'], list):
        return jsonify({'error': 'Ids parameter to exportData must be a list.'})

    # For each id, extract relevant cache file data
    export_data = {}
    for cache_id in data['ids']:
        cache_files = get_filenames_for_id(cache_id)
        if len(cache_files) == 0:
            print(f"Warning: Could not find data for id '{cache_id}'. Skipping...")
            continue

        for filename in cache_files:
            export_data[filename] = load_cache_json(filename)

    # Return cache'd file data
    ret = jsonify({'files': export_data})
    ret.headers.add('Access-Control-Allow-Origin', '*')
    return ret

@app.route('/app/importCache', methods=['POST'])
def importCache():
    """
        Imports the passed data relevant to specific node id(s), and saves on the backend cache.
        Used for importing data from an exported flow, so that the flow is self-contained.

        POST'd data should be in form:
        { 
            files: {
                filename: <dict|list>  (the name and contents of the cache file)
            }
        }
    """
    # Verify post'd data
    data = request.get_json()
    if 'files' not in data:
        return jsonify({'result': False, 'error': 'Missing files parameter to importData.'})
    elif not isinstance(data['files'], dict):
        typeof_files = data['files']
        return jsonify({'result': False, 'error': f'Files parameter in importData should be a dict, but is of type {typeof_files}.'})

    # Create a cache dir if it doesn't exist:
    create_dir_if_not_exists(CACHE_DIR)

    # Verify filenames, data, and access permissions to write to cache
    for filename in data['files']:
        # Verify filepath
        cache_filepath = os.path.join(CACHE_DIR, filename)
        if not is_valid_filepath(cache_filepath):
            return jsonify({'result': False, 'error': f'Invalid filepath: {cache_filepath}'})
        
        # Write data to cache file
        # NOTE: This will overwrite any existing cache files with the same filename (id).
        with open(cache_filepath, "w", encoding='utf-8') as f:
            json.dump(data['files'][filename], f)
    
    print("Imported cache data and store to cache.")

    # Report success
    ret = jsonify({'result': True})
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

def run_server(host="", port=8000, cmd_args=None):
    if cmd_args is not None and cmd_args.dummy_responses:
        global PromptLLM
        PromptLLM = PromptLLMDummy
    
    app.run(host=host, port=port)

if __name__ == '__main__':
    print("Run app.py instead.")