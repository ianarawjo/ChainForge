import json, os, asyncio, sys, argparse, threading, traceback
from dataclasses import dataclass
from enum import Enum
from statistics import mean, median, stdev
from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO
from chainforge.promptengine.query import PromptLLM, PromptLLMDummy
from chainforge.promptengine.template import PromptTemplate, PromptPermutationGenerator
from chainforge.promptengine.utils import LLM, extract_responses, is_valid_filepath, get_files_at_dir, create_dir_if_not_exists, set_api_keys

# Setup Flask app to serve static version of React front-end
BUILD_DIR = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'react-server', 'build')
STATIC_DIR = os.path.join(BUILD_DIR, 'static')
app = Flask(__name__, static_folder=STATIC_DIR, template_folder=BUILD_DIR)

# Set up CORS for specific routes
cors = CORS(app, resources={r"/*": {"origins": "*"}})

# The cache base directory
CACHE_DIR = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'cache')

# Serve React app (static; no hot reloading)
@app.route("/")
def index():
    return render_template("index.html")

LLM_NAME_MAP = {} 
for model in LLM:
    LLM_NAME_MAP[model.value] = model

@dataclass
class ResponseInfo:
    """Stores info about a single response. Passed to evaluator functions."""
    text: str
    prompt: str
    var: dict
    llm: str

    def __str__(self):
        return self.text

def to_standard_format(r: dict) -> list:
    llm = r['llm']
    resp_obj = {
        'vars': r['info'],
        'llm': llm,
        'prompt': r['prompt'],
        'responses': r['responses'],
        'tokens': r['raw_response']['usage'] if 'usage' in r['raw_response'] else {},
    }
    if 'eval_res' in r:
        resp_obj['eval_res'] = r['eval_res']
    return resp_obj

def get_filenames_with_id(filenames: list, id: str) -> list:
    return [
        c for c in filenames
        if c.split('.')[0] == id or ('-' in c and c[:c.rfind('-')] == id)
    ]

def remove_cached_responses(cache_id: str):
    all_cache_files = get_files_at_dir(CACHE_DIR)
    cache_files = get_filenames_with_id(all_cache_files, cache_id)
    for filename in cache_files:
        os.remove(os.path.join(CACHE_DIR, filename))

def load_cache_json(filepath: str) -> dict:
    with open(filepath, encoding="utf-8") as f:
        responses = json.load(f)
    return responses

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
            ev = eval_func(res)
            ev_type = typeof_set(set((type(ev),)))
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

def load_all_cached_responses(cache_ids):
    # Create a cache dir if it doesn't exist:
    create_dir_if_not_exists(CACHE_DIR)

    if not isinstance(cache_ids, list):
        cache_ids = [cache_ids]
    
    # Load all responses with the given ID:
    all_cache_files = get_files_at_dir(CACHE_DIR)
    responses = []
    for cache_id in cache_ids:
        cache_files = [fname for fname in get_filenames_with_id(all_cache_files, cache_id) if fname != f"{cache_id}.json"]
        if len(cache_files) == 0:
            continue

        for filename in cache_files:
            res = load_cache_json(os.path.join(CACHE_DIR, filename))
            if isinstance(res, dict):
                # Convert to standard response format
                res = [
                    to_standard_format({'prompt': prompt, **res_obj})
                    for prompt, res_obj in res.items()
                ]
            responses.extend(res)
    
    return responses

@app.route('/app/countQueriesRequired', methods=['POST'])
def countQueries():
    """
        Returns how many queries we need to make, given the passed prompt and vars.

        POST'd data should be in the form: 
        {
            'prompt': str  # the prompt template, with any {{}} vars
            'vars': dict  # a dict of the template variables to fill the prompt template with, by name. For each var, can be single values or a list; in the latter, all permutations are passed. (Pass empty dict if no vars.)
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
        # Load all cache'd responses with the given id:
        cached_resps = load_all_cached_responses(data['id'])
    else:
        cached_resps = []
    
    missing_queries = {}
    num_responses_req = {}
    def add_to_missing_queries(llm, prompt, num):
        if llm not in missing_queries:
            missing_queries[llm] = {}
        missing_queries[llm][prompt] = num
    def add_to_num_responses_req(llm, num):
        if llm not in num_responses_req:
            num_responses_req[llm] = 0
        num_responses_req[llm] += num
    
    # Iterate through all prompt permutations and check if how many responses there are in the cache with that prompt
    for prompt in all_prompt_permutations:
        prompt = str(prompt)
        matching_resps = [r for r in cached_resps if r['prompt'] == prompt]
        for llm in data['llms']:
            add_to_num_responses_req(llm, n)
            match_per_llm = [r for r in matching_resps if r['llm'] == llm]
            if len(match_per_llm) == 0:
                add_to_missing_queries(llm, prompt, n)
            elif len(match_per_llm) == 1:
                # Check how many were stored; if not enough, add how many missing queries:
                num_resps = len(match_per_llm[0]['responses'])
                if n > len(match_per_llm[0]['responses']):
                    add_to_missing_queries(llm, prompt, n - num_resps)
            else:
                raise Exception(f"More than one response found for the same prompt ({prompt}) and LLM ({llm})")

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
        with open(os.path.join(CACHE_DIR, f"_temp_{data['id']}.txt"), 'w') as f:
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
            'llm': str | list  # a string or list of strings specifying the LLM(s) to query
            'params': dict  # an optional dict of any other params to set when querying the LLMs, like 'temperature', 'n' (num of responses per prompt), etc.
            'prompt': str  # the prompt template, with any {{}} vars
            'vars': dict  # a dict of the template variables to fill the prompt template with, by name. For each var, can be single values or a list; in the latter, all permutations are passed. (Pass empty dict if no vars.)
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

    for llm_str in data['llm']:
        if llm_str not in LLM_NAME_MAP:
            return jsonify({'error': f"LLM named '{llm_str}' is not supported."})
    
    if 'api_keys' in data:
        set_api_keys(data['api_keys'])

    if 'no_cache' in data and data['no_cache'] is True:
        remove_cached_responses(data['id'])

    # Create a cache dir if it doesn't exist:
    create_dir_if_not_exists(CACHE_DIR)

    # Check that the filepath used to cache eval'd responses is valid:
    cache_filepath_last_run = os.path.join(CACHE_DIR, f"{data['id']}.json")
    if not is_valid_filepath(cache_filepath_last_run):
        return jsonify({'error': f'Invalid filepath: {cache_filepath_last_run}'})

    # For each LLM, generate and cache responses:
    responses = {}
    llms = data['llm']
    params = data['params'] if 'params' in data else {}
    tempfilepath = os.path.join(CACHE_DIR, f"_temp_{data['id']}.txt")
    if not is_valid_filepath(tempfilepath):
        return jsonify({'error': f'Invalid filepath: {tempfilepath}'})

    async def query(llm_str: str) -> list:
        llm = LLM_NAME_MAP[llm_str]

        # Check that storage path is valid:
        cache_filepath = os.path.join(CACHE_DIR, f"{data['id']}-{str(llm.name)}.json")
        if not is_valid_filepath(cache_filepath):
            return jsonify({'error': f'Invalid filepath: {cache_filepath}'})

        # Create an object to query the LLM, passing a file for cache'ing responses
        prompter = PromptLLM(data['prompt'], storageFile=cache_filepath)

        # Prompt the LLM with all permutations of the input prompt template:
        # NOTE: If the responses are already cache'd, this just loads them (no LLM is queried, saving $$$)
        resps = []
        num_resps = 0
        try:
            print(f'Querying {llm}...')
            async for response in prompter.gen_responses(properties=data['vars'], llm=llm, **params):
                resps.append(response)
                print(f"collected response from {llm.name}:", str(response))

                num_resps += len(response['responses'])

                # Save the number of responses collected to a temp file on disk
                with open(tempfilepath, 'r') as f:
                    txt = f.read().strip()
                
                cur_data = json.loads(txt) if len(txt) > 0 else {}
                cur_data[llm_str] = num_resps
                
                with open(tempfilepath, 'w') as f:
                    json.dump(cur_data, f)
        except Exception as e:
            print(f'error generating responses for {llm}:', e)
            print(traceback.format_exc())
            raise e
        
        return {'llm': llm, 'responses': resps}
            
    try:
        # Request responses simultaneously across LLMs
        tasks = [query(llm) for llm in llms]

        # Await the responses from all queried LLMs
        llm_results = await asyncio.gather(*tasks)
        for item in llm_results:
            responses[item['llm']] = item['responses']

    except Exception as e:
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
    with open(cache_filepath_last_run, "w") as f:
        json.dump(res, f)

    # Return all responses for all LLMs
    print('returning responses:', res)
    ret = jsonify({'responses': res})
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
        evaluate
    except Exception as e:
        return jsonify({'error': f'Could not compile evaluator code. Error message:\n{str(e)}'})

    # Load all responses with the given ID:
    all_cache_files = get_files_at_dir(CACHE_DIR)
    all_evald_responses = []
    for cache_id in data['responses']:
        fname = f"{cache_id}.json"
        if fname not in all_cache_files:
            return jsonify({'error': f'Did not find cache file for id {cache_id}'})

        # Load the raw responses from the cache
        responses = load_cache_json(os.path.join(CACHE_DIR, fname))
        if len(responses) == 0: continue

        # Run the evaluator over them: 
        # NOTE: 'evaluate' here was defined dynamically from 'exec' above. 
        try:
            evald_responses = run_over_responses(evaluate, responses, scope=data['scope'])
        except Exception as e:
            return jsonify({'error': f'Error encountered while trying to run "evaluate" method:\n{str(e)}'})

        # Perform any reduction operations:
        if 'reduce_vars' in data and len(data['reduce_vars']) > 0:
            evald_responses = reduce_responses(
                evald_responses,
                vars=data['reduce_vars']
            )

        all_evald_responses.extend(evald_responses)

    # Store the evaluated responses in a new cache json:
    with open(cache_filepath, "w") as f:
        json.dump(all_evald_responses, f)

    ret = jsonify({'responses': all_evald_responses})
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
        return jsonify({'result': False, 'error': f'Could not evaluate code. Error message:\n{str(e)}'})

    # DANGER DANGER! Running exec on code passed through front-end. Make sure it's trusted!
    try:
        exec(data['code'], globals())

        # Double-check that there is an 'evaluate' method in our namespace. 
        # This will throw a NameError if not: 
        evaluate
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
        
        res = load_cache_json(os.path.join(CACHE_DIR, fname))
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
    all_cache_files = get_files_at_dir(CACHE_DIR)
    export_data = {}
    for cache_id in data['ids']:
        cache_files = get_filenames_with_id(all_cache_files, cache_id)
        if len(cache_files) == 0:
            print(f"Warning: Could not find data for id '{cache_id}'. Skipping...")
            continue

        for filename in cache_files:
            export_data[filename] = load_cache_json(os.path.join(CACHE_DIR, filename))

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
        with open(cache_filepath, "w") as f:
            json.dump(data['files'][filename], f)
    
    print("Imported cache data and store to cache.")

    # Report success
    ret = jsonify({'result': True})
    ret.headers.add('Access-Control-Allow-Origin', '*')
    return ret


def run_server(host="", port=8000, cmd_args=None):
    if cmd_args is not None and cmd_args.dummy_responses:
        global PromptLLM
        PromptLLM = PromptLLMDummy
    
    app.run(host=host, port=port)

if __name__ == '__main__':
    print("Run app.py instead.")