
import os
import json
import re
from pprint import pprint
from datetime import datetime
import hashlib

import weave
from weave import EvaluationLogger

def sanitize_name(name):
    """Sanitize a name to be valid for Weave (alphanumeric and underscores only)"""
    # Replace hyphens and other invalid chars with underscores
    sanitized = re.sub(r'[^a-zA-Z0-9_]', '_', name)
    # Ensure it starts with a letter or underscore
    if sanitized and not sanitized[0].isalpha() and sanitized[0] != '_':
        sanitized = 'model_' + sanitized
    return sanitized

def inspect_cforge(path):
    with open(path, 'r') as f:
        data = json.load(f)
    print("Top-level keys:", list(data.keys()))
    print("\n--- flow ---")
    flow = data.get('flow', {})
    print("flow keys:", list(flow.keys()))
    if 'nodes' in flow:
        print(f"\nNumber of nodes: {len(flow['nodes'])}")
        for i, node in enumerate(flow['nodes']):
            print(f"\nNode {i}:")
            print("  id:", node.get('id'))
            print("  type:", node.get('type'))
            print("  keys:", list(node.keys()))
            if 'data' in node:
                print("    data keys:", list(node['data'].keys()))
                if 'fields' in node['data']:
                    fields = node['data']['fields']
                    print(f"    Type of fields: {type(fields)}")
                    if isinstance(fields, list):
                        print(f"    Number of fields: {len(fields)}")
                        if fields:
                            print("    Example field:")
                            pprint(fields[0])
                        else:
                            print("    No fields data available")
                    elif isinstance(fields, dict):
                        print(f"    Number of fields (dict keys): {len(fields)}")
                        keys = list(fields.keys())
                        if keys:
                            print(f"    Example key: {keys[0]}")
                            print(f"    Example value:")
                            pprint(fields[keys[0]])
                        else:
                            print("    No fields data available (dict)")
                    else:
                        print(f"    fields is of type {type(fields)} and not indexable")
                elif 'rows' in node['data']:
                    rows = node['data']['rows']
                    print(f"    Type of rows: {type(rows)}")
                    if isinstance(rows, list):
                        print(f"    Number of rows: {len(rows)}")
                        if rows:
                            print("    Example row:")
                            pprint(rows[0])
                        else:
                            print("    No rows data available")
                    elif isinstance(rows, dict):
                        print(f"    Number of rows (dict keys): {len(rows)}")
                        keys = list(rows.keys())
                        if keys:
                            print(f"    Example key: {keys[0]}")
                            print(f"    Example value:")
                            pprint(rows[keys[0]])
                        else:
                            print("    No rows data available (dict)")
                    else:
                        print(f"    rows is of type {type(rows)} and not indexable")
    print("\n--- cache ---")
    cache = data.get('cache', {})
    print("cache keys:", list(cache.keys()))
    
    # Show evaluation results
    for k in cache.keys():
        if k.endswith('.json') and ('simpleEval' in k or 'llmeval' in k or 'evalNode' in k):
            print(f"\n{k}:")
            if isinstance(cache[k], list) and cache[k]:
                print("  Number of eval results:", len(cache[k]))
                print("  Example eval result:")
                pprint(cache[k][0])
                
                # Show score structure
                if 'eval_res' in cache[k][0]:
                    eval_res = cache[k][0]['eval_res']
                    if 'items' in eval_res:
                        scores = eval_res['items']
                        print(f"  Scores per evaluation: {len(scores)}")
                        print(f"  Score types: {eval_res.get('dtype', 'unknown')}")
                        print(f"  Example scores: {scores}")
            elif isinstance(cache[k], dict):
                print("  Cache data:")
                pprint(cache[k])
    
    print("\nDone.")

def extract_model_info_from_llm_spec(llm_spec):
    """Extract comprehensive model information from LLM spec"""
    if isinstance(llm_spec, str):
        return {
            'model_name': llm_spec,
            'provider': 'unknown',
            'settings': {},
            'form_data': {},
            'progress': {},
            'key': None
        }
    elif isinstance(llm_spec, dict):
        return {
            'model_name': llm_spec.get('name', 'unknown'),
            'model_id': llm_spec.get('model', 'unknown'),
            'provider': llm_spec.get('base_model', 'unknown'),
            'settings': llm_spec.get('settings', {}),
            'form_data': llm_spec.get('formData', {}),
            'progress': llm_spec.get('progress', {}),
            'key': llm_spec.get('key', None),
            'emoji': llm_spec.get('emoji', ''),
            'temp': llm_spec.get('temp', None)
        }
    else:
        return {
            'model_name': 'unknown',
            'provider': 'unknown',
            'settings': {},
            'form_data': {},
            'progress': {},
            'key': None
        }

def extract_predictions_from_fields(fields):
    """Extract predictions from fields, handling different field structures"""
    predictions = []
    
    for field in fields:
        # Extract input variables (the variables that filled the prompt template)
        fill_history = field.get('fill_history', {})
        inputs = {}
        for key, value in fill_history.items():
            if key != '__pt':  # Skip prompt template
                inputs[key] = value
        
        # Extract output (metavars or text)
        metavars = field.get('metavars', {})
        text = field.get('text', '')
        
        # Create output dict, excluding internal metavars
        output = {}
        for key, value in metavars.items():
            if not key.startswith('__') and key != 'LLM_0':
                output[key] = value
        
        # If no metavars, use the text response
        if not output and text:
            output = {"response": text}
        
        # Get comprehensive LLM info
        llm_info = extract_model_info_from_llm_spec(field.get('llm', {}))
        
        # Get prompt template if available
        prompt_template = fill_history.get('__pt', '')
        
        predictions.append({
            'inputs': inputs,
            'output': output,
            'llm_info': llm_info,
            'uid': field.get('uid'),
            'text': text,
            'prompt_template': prompt_template,
            'metavars': metavars
        })
    
    return predictions

def analyze_cache_structure(cache):
    """Analyze the cache to understand what evaluations exist, grouped by system prompt"""
    evaluations = {}
    
    for cache_key, cache_data in cache.items():
        if not cache_key.endswith('.json'):
            continue
            
        # Skip media and other non-evaluation cache entries
        if cache_key in ['__media', '__s']:
            continue
            
        # Handle evaluation cache entries
        if isinstance(cache_data, list) and cache_data:
            # This is a list of evaluation results
            base_eval_type = cache_key.replace('.json', '')
            
            # Group by system prompt to create separate evaluations
            system_prompt_groups = {}
            
            for eval_result in cache_data:
                # Extract system prompt from the evaluation
                system_msg = None
                
                # First check if system_msg is in vars (like =system_msg)
                if 'vars' in eval_result:
                    for key, value in eval_result['vars'].items():
                        if key == '=system_msg' or key == 'system_msg':
                            system_msg = value
                            break
                
                # If not found in vars, check LLM settings
                if not system_msg and 'llm' in eval_result and isinstance(eval_result['llm'], dict):
                    settings = eval_result['llm'].get('settings', {})
                    system_msg = settings.get('system_msg', '')
                
                # If still not found, check fill_history
                if not system_msg and 'fill_history' in eval_result:
                    fill_history = eval_result['fill_history']
                    for key, value in fill_history.items():
                        if key == '=system_msg' or key == 'system_msg':
                            system_msg = value
                            break
                
                if not system_msg:
                    system_msg = 'default'
                
                # Create unique evaluation key based on eval type and system prompt
                # Use a hash of the system prompt to avoid overly long keys
                system_hash = hashlib.md5(system_msg.encode()).hexdigest()[:8]
                eval_key = f"{base_eval_type}_{system_hash}"
                
                if eval_key not in system_prompt_groups:
                    system_prompt_groups[eval_key] = []
                
                system_prompt_groups[eval_key].append(eval_result)
            
            # Create separate evaluations for each system prompt group
            for eval_key, eval_results in system_prompt_groups.items():
                # Extract system prompt from first result using same logic
                first_result = eval_results[0]
                system_msg = None
                
                # First check if system_msg is in vars (like =system_msg)
                if 'vars' in first_result:
                    for key, value in first_result['vars'].items():
                        if key == '=system_msg' or key == 'system_msg':
                            system_msg = value
                            break
                
                # If not found in vars, check LLM settings
                if not system_msg and 'llm' in first_result and isinstance(first_result['llm'], dict):
                    settings = first_result['llm'].get('settings', {})
                    system_msg = settings.get('system_msg', '')
                
                # If still not found, check fill_history
                if not system_msg and 'fill_history' in first_result:
                    fill_history = first_result['fill_history']
                    for key, value in fill_history.items():
                        if key == '=system_msg' or key == 'system_msg':
                            system_msg = value
                            break
                
                if not system_msg:
                    system_msg = 'default'
                
                evaluations[eval_key] = {
                    'type': 'list',
                    'count': len(eval_results),
                    'data': eval_results,
                    'example': eval_results[0] if eval_results else None,
                    'base_eval_type': base_eval_type,
                    'system_msg': system_msg
                }
                
        elif isinstance(cache_data, dict):
            # This might be a single evaluation or metadata
            eval_type = cache_key.replace('.json', '')
            evaluations[eval_type] = {
                'type': 'dict',
                'data': cache_data
            }
    
    return evaluations

def create_weave_dataset_metadata(eval_results, eval_type, prompt_nodes):
    """Create comprehensive dataset metadata for Weave"""
    if not eval_results:
        return {}
    
    # Get evaluation metadata from first result
    first_result = eval_results[0]
    
    # Extract evaluation configuration
    eval_config = {}
    if 'vars' in first_result:
        eval_config['input_variables'] = list(first_result['vars'].keys())
    
    # Get evaluation type and configuration
    if eval_type.startswith('simpleEval'):
        eval_config['evaluation_type'] = 'simple_evaluation'
        # Extract simple eval configuration from node data
        for node in prompt_nodes:
            if node.get('id') == eval_type:
                node_data = node.get('data', {})
                eval_config.update({
                    'operation': node_data.get('operation', 'unknown'),
                    'var_value': node_data.get('varValue', 'unknown'),
                    'var_value_type': node_data.get('varValueType', 'unknown'),
                    'text_value': node_data.get('textValue', 'unknown'),
                    'response_format': node_data.get('responseFormat', 'unknown')
                })
                break
    elif eval_type.startswith('llmeval'):
        eval_config['evaluation_type'] = 'llm_evaluation'
    else:
        eval_config['evaluation_type'] = 'custom_evaluation'
    
    return eval_config

def create_comprehensive_model_definition(model_info, eval_type, system_msg=None, metavars=None):
    """Create a comprehensive model definition for EvaluationLogger that includes all settings"""
    base_model_name = sanitize_name(model_info['model_name'])
    
    # Create a model definition that includes all the settings and metadata
    model_definition = {
        'name': base_model_name,
        'model_id': model_info.get('model_id', 'unknown'),
        'provider': model_info.get('provider', 'unknown'),
        'settings': model_info.get('settings', {}),
        'form_data': model_info.get('form_data', {}),
        'progress': model_info.get('progress', {}),
        'key': model_info.get('key'),
        'emoji': model_info.get('emoji', ''),
        'temp': model_info.get('temp'),
        'evaluation_type': eval_type,
        'system_prompt': system_msg,
        'metavars': metavars or {},
        'source': 'chainforge_import'
    }
    
    return model_definition

def log_to_weave(data):
    """Log the .cforge file data to Weave using EvaluationLogger"""
    
    # Analyze cache structure to understand evaluations
    cache = data.get('cache', {})
    evaluations = analyze_cache_structure(cache)
    
    print(f"Found {len(evaluations)} evaluation types in cache:")
    for eval_type, eval_info in evaluations.items():
        if eval_info['type'] == 'list':
            print(f"  {eval_type}: {eval_info['count']} evaluation results")
        else:
            print(f"  {eval_type}: dict data")
    
    # Find all nodes that can contain predictions and create a comprehensive UID mapping
    uid_to_prediction = {}
    
    flow = data.get('flow', {})
    for node in flow.get('nodes', []):
        node_type = node.get('type')
        node_data = node.get('data', {})
        
        # Handle different node types that can contain predictions
        if node_type == 'prompt':
            # Extract from prompt node fields
            fields = node_data.get('fields', [])
            if fields:
                predictions = extract_predictions_from_fields(fields)
                for pred in predictions:
                    uid_to_prediction[pred['uid']] = pred
        
        elif node_type in ['evaluator', 'evalNode', 'simpleval']:
            # Extract from evaluator node fields
            fields = node_data.get('fields', [])
            if fields:
                predictions = extract_predictions_from_fields(fields)
                for pred in predictions:
                    uid_to_prediction[pred['uid']] = pred
        
        elif node_type == 'table':
            # Extract from table rows if they contain predictions
            rows = node_data.get('rows', [])
            if rows and isinstance(rows, list):
                for i, row in enumerate(rows):
                    if '__uid' in row:
                        uid = row['__uid']
                        # Create a prediction from table row data
                        prediction = {
                            'inputs': {k: v for k, v in row.items() if not k.startswith('__')},
                            'output': {k: v for k, v in row.items() if not k.startswith('__')},
                            'llm_info': {'model_name': 'table_data', 'provider': 'table'},
                            'uid': uid,
                            'text': str(row),
                            'prompt_template': '',
                            'metavars': {k: v for k, v in row.items() if not k.startswith('__')}
                        }
                        uid_to_prediction[uid] = prediction
        
        # Also check cache for any additional prediction data
        cache_key = f"{node.get('id')}.json"
        if cache_key in cache:
            cache_data = cache[cache_key]
            if isinstance(cache_data, list):
                for item in cache_data:
                    if 'uid' in item:
                        uid = item['uid']
                        if uid not in uid_to_prediction:
                            # Create prediction from cache data
                            prediction = {
                                'inputs': item.get('vars', {}),
                                'output': {'response': item.get('responses', [''])[0] if item.get('responses') else ''},
                                'llm_info': extract_model_info_from_llm_spec(item.get('llm', {})),
                                'uid': uid,
                                'text': item.get('responses', [''])[0] if item.get('responses') else '',
                                'prompt_template': '',
                                'metavars': item.get('metavars', {})
                            }
                            uid_to_prediction[uid] = prediction
    
    print(f"Extracted {len(uid_to_prediction)} predictions from all nodes")
    
    # Debug: Show prediction sources
    prediction_sources = {}
    for uid, pred in uid_to_prediction.items():
        source = pred.get('llm_info', {}).get('model_name', 'unknown')
        if source not in prediction_sources:
            prediction_sources[source] = 0
        prediction_sources[source] += 1
    
    print("Prediction sources:")
    for source, count in prediction_sources.items():
        print(f"  {source}: {count} predictions")
    
    # Debug: Show evaluation UIDs that don't have predictions
    missing_uids = set()
    for eval_type, eval_info in evaluations.items():
        if eval_info['type'] == 'list':
            for eval_result in eval_info['data']:
                uid = eval_result.get('uid')
                if uid and uid not in uid_to_prediction:
                    missing_uids.add(uid)
    
    if missing_uids:
        print(f"\nWarning: {len(missing_uids)} evaluation UIDs don't have matching predictions")
        print("First 10 missing UIDs:", list(missing_uids)[:10])
    
    # Log each evaluation type as a separate dataset
    for eval_type, eval_info in evaluations.items():
        if eval_info['type'] != 'list':
            continue  # Skip non-list evaluations for now
        
        eval_results = eval_info['data']
        if not eval_results:
            continue
        
        # Get comprehensive model info from first evaluation result
        first_result = eval_results[0]
        model_info = extract_model_info_from_llm_spec(first_result.get('llm', {}))
        
        # Get system prompt from evaluation info
        system_msg = eval_info.get('system_msg', 'default')
        base_eval_type = eval_info.get('base_eval_type', eval_type)
        
        # Extract metavars from first result (they should be consistent across the evaluation)
        metavars = {}
        if 'metavars' in first_result:
            # Filter out internal metavars and LLM references
            for key, value in first_result['metavars'].items():
                if not key.startswith('__') and key != 'LLM_0':
                    metavars[key] = value
        
        # Also extract evaluation variables that should be part of the model definition
        eval_vars = {}
        if 'vars' in first_result:
            # Include evaluation variables in model definition
            eval_vars = first_result['vars'].copy()
        
        # Create comprehensive model definition that includes all settings
        model_definition = create_comprehensive_model_definition(model_info, base_eval_type, system_msg, metavars)
        # Add evaluation variables to model definition
        model_definition['evaluation_vars'] = eval_vars
        
        sanitized_model = model_definition['name']
        sanitized_eval_type = sanitize_name(eval_type)
        dataset_name = f"chainforge_{sanitized_eval_type}"
        
        print(f"Logging evaluation '{eval_type}' to Weave:")
        print(f"  Model: {sanitized_model} ({model_info['model_id']})")
        print(f"  Dataset: {dataset_name}")
        print(f"  Provider: {model_info['provider']}")
        print(f"  Model settings: {len(model_info.get('settings', {}))} settings")
        print(f"  System prompt: {system_msg[:100]}{'...' if len(system_msg) > 100 else ''}")
        if metavars:
            print(f"  Metavars: {list(metavars.keys())}")
        if eval_vars:
            print(f"  Evaluation vars: {list(eval_vars.keys())}")
        
        # Create dataset metadata
        dataset_metadata = create_weave_dataset_metadata(eval_results, base_eval_type, flow.get('nodes', []))
        
        # Initialize EvaluationLogger with comprehensive model definition
        eval_logger = EvaluationLogger(
            model=model_definition, 
            dataset=dataset_name,
            name=eval_type
        )
        
        # Log each evaluation result
        for eval_result in eval_results:
            uid = eval_result.get('uid')
            if not uid or uid not in uid_to_prediction:
                print(f"Warning: No prediction found for UID {uid}")
                continue
            
            prediction = uid_to_prediction[uid]
            
            # Create clean input dictionary without model-specific fields, metavars, or evaluation vars
            inputs = prediction['inputs'].copy()
            if prediction['prompt_template']:
                inputs['prompt_template'] = prediction['prompt_template']
            
            # Remove dynamic variables (those starting with =) to ensure consistent inputs across evaluations
            inputs = {k: v for k, v in inputs.items() if not k.startswith('=')}
            
            # Add evaluation-specific metadata (but not model settings, metavars, or evaluation vars)
            # inputs['evaluation_uid'] = uid
            # inputs['evaluation_type'] = eval_type
            # inputs['source'] = 'chainforge_import'
            
            # Log the prediction with clean inputs (no model settings, metavars, evaluation vars, or dynamic vars)
            pred_logger = eval_logger.log_prediction(
                inputs=inputs, 
                output=prediction['output']
            )
            
            # Log the evaluation score with detailed scorer information
            if 'eval_res' in eval_result:
                eval_res = eval_result['eval_res']
                if 'items' in eval_res and eval_res['items']:
                    # Log all scores for this evaluation
                    scores = eval_res['items']
                    for i, score in enumerate(scores):
                        pred_logger.log_score(
                            scorer=sanitized_eval_type.split('_')[0], 
                            score=score
                        )
                        print(f"    Logged score {i}: {score} (type: {eval_res.get('dtype', 'unknown')})")
            
            pred_logger.finish()
        
        # Log comprehensive summary for this evaluation
        eval_logger.log_summary({
            "total_evaluations": len(eval_results),
            "evaluation_config": dataset_metadata,
            "dataset_name": dataset_name
        })
    
    print("Successfully logged all evaluations to Weave!")

def export_to_weave(data, project_name, api_key=""):
    try:
        # Set wandb api key
        os.environ['WANDB_API_KEY'] = api_key
        # Initialize Weave
        weave.init(project_name)
        log_to_weave(data)

        return {"success": True, "message": "Successfully exported to Weights & Biases"}
    except Exception as e:
        return {"success": False, "message": f"Error exporting to Weights & Biases: {str(e)}"} 