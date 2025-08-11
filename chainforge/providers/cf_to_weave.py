
import os
import json
import re
from pprint import pprint
from datetime import datetime
import hashlib
import base64
from io import BytesIO

import weave
from weave import EvaluationLogger
from PIL import Image

def sanitize_name(name):
    """Sanitize a name to be valid for Weave (alphanumeric and underscores only)"""
    # Replace hyphens and other invalid chars with underscores
    sanitized = re.sub(r'[^a-zA-Z0-9_]', '_', name)
    # Ensure it starts with a letter or underscore
    if sanitized and not sanitized[0].isalpha() and sanitized[0] != '_':
        sanitized = 'model_' + sanitized
    return sanitized

def resolve_string_references(data_item, string_cache, media_cache=None):
    """Recursively resolves integer references in data_item using the string_cache and converts image objects to PIL Images."""
    if isinstance(data_item, int):
        # Try to fetch the string from __s using index, otherwise return the integer itself
        try:
            return string_cache[data_item]
        except (IndexError, TypeError):
            return data_item
    elif isinstance(data_item, dict):
        # Check if this is an image object
        if data_item.get("t") == "img" and "d" in data_item and media_cache:
            image_cache_id = data_item["d"]
            if image_cache_id in media_cache:
                # Extract base64 data from data URI
                base64_data = media_cache[image_cache_id]
                if base64_data.startswith("data:image"):
                    # Remove the data URI prefix (e.g., "data:image/jpeg;base64,")
                    header, encoded = base64_data.split(',', 1)
                    # Decode base64 to bytes
                    image_bytes = base64.b64decode(encoded)
                    # Create PIL Image from bytes
                    pil_image = Image.open(BytesIO(image_bytes))
                    return pil_image
                else:
                    # If not a data URI, return the original data
                    return base64_data
            else:
                # If image not found in cache, return the original object
                return data_item
        else:
            # Regular dictionary processing
            return {k: resolve_string_references(v, string_cache, media_cache) for k, v in data_item.items()}
    elif isinstance(data_item, list):
        return [resolve_string_references(elem, string_cache, media_cache) for elem in data_item]
    else:
        return data_item

def log_to_weave(data, cforge_filename="test1"):
    """Log the .cforge file data to Weave using EvaluationLogger"""
    cache = data.get('cache', {})
    string_cache = cache.get('__s', []) # Get the string cache
    media_cache = cache.get('__media', {}).get('cache', {}) # Get the media cache
    
    # Use regex to find all evaluation keys in cache
    eval_keys = [key for key in cache.keys() if re.search(r'Eval', key, re.IGNORECASE) and key.endswith('.json')]
    
    if not eval_keys:
        raise Exception("The cforge flow cannot be exported to weave because there are no evaluation nodes found.")

    print(f"Found {len(eval_keys)} evaluation keys: {eval_keys}")

    # Loop through each evaluation key
    for eval_key in eval_keys:
        eval_results = cache.get(eval_key, [])

        if not eval_results:
            raise Exception("No evaluation results found in cache. Please run the evaluators.")

        # Determine model and dataset names dynamically from the first evaluation result
        first_eval_result = eval_results[0]
        llm_info = first_eval_result.get('llm', {})
        
        # Handle case where llm_info can be either a string or dict
        if isinstance(llm_info, str):
            raw_model_name = llm_info
        elif isinstance(llm_info, dict):
            raw_model_name = llm_info.get('name', 'unknown_model')
        else:
            raw_model_name = 'unknown_model'
            
        model_name = sanitize_name(raw_model_name)  # Sanitize the model name
        dataset_name = f"chainforge_{cforge_filename}"
        
        raw_eval_logger_name = eval_key.replace('.json', '')
        eval_logger_name = sanitize_name(raw_eval_logger_name)  # Sanitize the eval logger name

        print(f"Processing evaluation: {eval_logger_name}")
        print(f"Model name: {raw_model_name} -> {model_name}")
        print(f"Eval Logger name: {raw_eval_logger_name} -> {eval_logger_name}")

        # Initialize EvaluationLogger
        eval_logger = EvaluationLogger(
            model=model_name,
            dataset=dataset_name,
            name=eval_logger_name
        )

        # Iterate through evaluation results and log each prediction
        for eval_result in eval_results:
            raw_inputs = eval_result.get('vars', {})
            raw_outputs = eval_result.get('responses', [''])[0] # Take the first response
            score = eval_result.get('eval_res', {}).get('items', [None])[0] # Take the first score
            
            # Resolve string references for inputs and outputs, now including media cache
            resolved_inputs = resolve_string_references(raw_inputs, string_cache, media_cache)
            # Ensure inputs is explicitly a dictionary
            if isinstance(resolved_inputs, dict):
                inputs = resolved_inputs
            else:
                # This case should ideally not happen if 'vars' is always a dict
                print(f"Warning: Resolved inputs for {eval_key} is not a dictionary. Converting to empty dict.")
                inputs = {}

            outputs = resolve_string_references(raw_outputs, string_cache, media_cache)

            # Log the prediction input and output
            pred_logger = eval_logger.log_prediction(
                inputs=inputs,
                output=outputs
            )

            # Log the score if available
            if score is not None:
                pred_logger.log_score(
                    scorer=eval_logger_name, 
                    score=score
                )
            
            pred_logger.finish()

        # Log a summary for the evaluation run
        eval_logger.log_summary({
            "total_evaluations": len(eval_results),
            "evaluation_type": eval_logger_name
        })

        print(f"Successfully logged {len(eval_results)} evaluations for '{eval_logger_name}' to Weave")

def export_to_weave(data, project_name, api_key=""):
    try:
        # Set wandb api key
        os.environ['WANDB_API_KEY'] = api_key
        # Initialize Weave
        weave.init(project_name)
        log_to_weave(data)

        return {"success": True, "message": "Successfully exported to W&B Weave"}
    except Exception as e:
        return {"success": False, "message": f"Error exporting to W&B Weave: {str(e)}"} 