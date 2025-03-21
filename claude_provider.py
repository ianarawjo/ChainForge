from chainforge.providers import provider
from typing import Optional, Dict, List, Any
import os
import anthropic
import json
import re

# JSON schema for Claude model settings
CLAUDE_SETTINGS_SCHEMA = {
    "settings": {
        "temperature": {
            "type": "number",
            "title": "temperature",
            "description": "Controls the randomness and creativity of responses. Range from 0 to 1. Use temperatures close to 0 for analytical/multiple-choice tasks, and close to 1 for creative and generative tasks.",
            "default": 0.7,
            "minimum": 0,
            "maximum": 1.0,
            "multipleOf": 0.01,
        },
        "max_tokens_to_sample": {
            "type": "integer",
            "title": "max_tokens_to_sample",
            "description": "Maximum number of tokens to generate before stopping. Reduce this value if you want shorter responses. By default, ChainForge uses a value of 1024.",
            "default": 1024,
            "minimum": 1,
            "maximum": 4096,
        },
        "top_p": {
            "type": "number",
            "title": "top_p",
            "description": "For nucleus sampling, we compute the cumulative distribution over all options for each subsequent token in descending order and cut it off once it reaches the top_p specified. Default is -1, which disables it. Note that you should only adjust either temperature or top_p, not both.",
            "default": -1,
            "minimum": -1,
            "maximum": 1.0,
            "multipleOf": 0.001,
        },
        "top_k": {
            "type": "integer",
            "title": "top_k",
            "description": "Only sample from the top K options for each subsequent token. Used to remove 'long tail' low probability responses. Default is -1, which disables it.",
            "default": -1,
            "minimum": -1,
        },
        "thinking": {
            "type": "integer",
            "title": "thinking",
            "description": "Token budget for enabling extended thinking mode for Claude 3.7 Sonnet. Set to 0 to disable extended thinking. Setting to a value greater than 0 (recommended 16000+) enables extended thinking, allowing Claude to perform more in-depth reasoning before generating the final answer. Extended thinking increases response time but can improve quality for complex tasks.",
            "default": 0,
            "minimum": 0,
            "maximum": 32000,
        },
        "enable_cache": {
            "type": "boolean",
            "title": "enable_cache",
            "description": "Whether to enable prompt caching functionality. When enabled, you can use the --cache-- marker in your prompt to specify which parts should be cached. System prompts are cached by default. Caching can reduce processing time and cost, especially useful for prompts containing large amounts of context or background information.",
            "default": False,
        },
        "system_msg": {
            "type": "string",
            "title": "system_msg",
            "description": "Only supported in Claude 2.1+ models. System prompts are a way to provide context and instructions to Claude, such as specifying a particular goal or role.",
            "default": "",
        },
        "tools": {
            "type": "string",
            "title": "tools",
            "description": "Definitions of tools the model might use, as a list of JSON schemas. For more information, see Anthropic documentation: https://docs.anthropic.com/en/docs/build-with-claude/tool-use#example-api-response-with-a-tool-use-content-block",
            "default": "",
        },
        "tool_choice": {
            "type": "string",
            "title": "tool_choice",
            "description": "How the model should use the provided tools. The model can use a specific tool by its name, any available tool ('any'), or decide for itself whether to use tools ('auto').",
            "default": "",
        },
        "parallel_tool_calls": {
            "type": "boolean",
            "title": "parallel_tool_calls",
            "description": "Whether to enable parallel function calls during tool use. Default is true.",
            "enum": [True, False],
            "default": True,
        },
        "api_key": {
            "type": "string",
            "title": "api_key",
            "description": "Anthropic API key",
            "default": "",
        }
    },
    "ui": {
        "temperature": {
            "ui:help": "Default is 0.7",
            "ui:widget": "range"
        },
        "max_tokens_to_sample": {
            "ui:help": "Default is 1024",
        },
        "top_p": {
            "ui:help": "Default is -1 (none)",
            "ui:widget": "range"
        },
        "top_k": {
            "ui:help": "Default is -1 (none)",
        },
        "thinking": {
            "ui:help": "Default is 0 (disabled). Set to a value greater than 0 (recommended 1024+) to enable extended thinking mode. Only applicable to Claude 3.7 Sonnet.",
        },
        "enable_cache": {
            "ui:help": "Default is disabled. When enabled, you can use the --cache-- marker in your prompt to specify cached parts. Only supported for Claude 3.7 Sonnet, 3.5 Sonnet, 3.5 Haiku, 3 Haiku, and 3 Opus models.",
            "ui:widget": "radio"
        },
        "system_msg": {
            "ui:widget": "textarea",
        },
        "tools": {
            "ui:help": "Leave empty to not specify any tools. Note: JSON schemas cannot have trailing commas.",
            "ui:widget": "textarea",
        },
        "tool_choice": {
            "ui:help": "When no tools are present, 'none' is the default. If tools are present, 'auto' is the default.",
        },
        "parallel_tool_calls": {
            "ui:widget": "radio",
        },
        "api_key": {
            "ui:help": "Please enter your Anthropic API key",
            "ui:widget": "password"
        }
    }
}

# List of supported Claude models
CLAUDE_MODELS = [
    'claude-3-7-sonnet-latest',
    'claude-3-7-sonnet-20250219',
    'claude-3-5-sonnet-latest',
    'claude-3-5-sonnet-20240620',
    'claude-3-5-haiku-latest',
    'claude-3-opus-20240229',
    'claude-3-opus-latest',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
]

# List of models that support prompt caching
CACHE_SUPPORTED_MODELS = [
    'claude-3-7-sonnet-latest',
    'claude-3-7-sonnet-20250219',
    'claude-3-5-sonnet-latest',
    'claude-3-5-sonnet-20240620',
    'claude-3-5-haiku-latest',
    'claude-3-opus-20240229',
    'claude-3-opus-latest',
    'claude-3-haiku-20240307',
]

# Minimum cacheable tokens
MIN_CACHEABLE_TOKENS = {
    'claude-3-7-sonnet': 1024,
    'claude-3-5-sonnet': 1024,
    'claude-3-opus': 1024,
    'claude-3-5-haiku': 2048,
    'claude-3-haiku': 2048,
}

@provider(
    name="Custom-Claude",
    emoji="☀",
    models=CLAUDE_MODELS,
    rate_limit="sequential",
    settings_schema=CLAUDE_SETTINGS_SCHEMA
)
def claude_completion(
    prompt: str,
    model: str = 'claude-3-7-sonnet-latest',
    chat_history: Optional[List[Dict[str, str]]] = None,
    temperature: float = 0.7,
    max_tokens_to_sample: int = 1024,
    thinking: int = 0,
    enable_cache: bool = False,
    top_p: float = -1,
    top_k: int = -1,
    stop_sequences: Optional[List[str]] = None,
    system_msg: str = "",
    tools: Optional[List[Dict]] = None,
    tool_choice: Optional[Dict] = None,
    parallel_tool_calls: bool = True,
    api_key: str = "",
    **kwargs
) -> str:
    """
    Call the Claude model to generate text completion.
    
    Parameters:
        prompt: The prompt text
        model: The name of the Claude model to use
        chat_history: Chat history (optional)
        temperature: Temperature parameter to control output randomness
        max_tokens_to_sample: Maximum number of tokens to generate
        thinking: Token budget for extended thinking mode, set to 0 to disable
        enable_cache: Whether to enable prompt caching functionality
        top_p: Nucleus sampling parameter
        top_k: Only sample from the top K options for each subsequent token
        stop_sequences: List of stop sequences
        system_msg: System message (only applicable to Claude 2.1+)
        tools: Tools the model might use
        tool_choice: How the model should use the provided tools
        parallel_tool_calls: Whether to enable parallel function calls during tool use
        api_key: Anthropic API key
        **kwargs: Other parameters
    
    Returns:
        Generated text completion
    """
    # Use API key from environment variable if not provided
    if not api_key:
        api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        if not api_key:
            return "Error: No Anthropic API key provided. Please add an API key in settings or set the ANTHROPIC_API_KEY environment variable."
    
    # Set default stop sequences
    if stop_sequences is None:
        stop_sequences = ["\n\nHuman:"]
    
    try:
        # Initialize Anthropic client
        client = anthropic.Anthropic(api_key=api_key)
        
        # Prepare message list
        formatted_messages = []
        
        # Add system message (if any)
        system_content = None
        if system_msg:
            if enable_cache:
                system_content = [
                    {
                        "type": "text",
                        "text": system_msg,
                        "cache_control": {"type": "ephemeral"}
                    }
                ]
            else:
                system_content = system_msg
        
        # Add chat history (if any)
        if chat_history:
            for msg in chat_history:
                role = msg.get("role", "")
                content = msg.get("content", "")
                
                # Convert OpenAI format to Anthropic format
                if role == "user":
                    if isinstance(content, str):
                        formatted_messages.append({
                            "role": "user",
                            "content": [{"type": "text", "text": content}]
                        })
                    elif isinstance(content, list):
                        # Handle complex content structure
                        formatted_content = []
                        for item in content:
                            if isinstance(item, dict):
                                formatted_content.append(item)
                            else:
                                formatted_content.append({"type": "text", "text": str(item)})
                        formatted_messages.append({
                            "role": "user",
                            "content": formatted_content
                        })
                elif role == "assistant":
                    # Handle assistant messages
                    if isinstance(content, str):
                        formatted_messages.append({
                            "role": "assistant",
                            "content": content
                        })
                    elif isinstance(content, list):
                        # Handle complex content structure (may include thinking blocks)
                        assistant_content = []
                        for item in content:
                            if isinstance(item, dict):
                                assistant_content.append(item)
                        if assistant_content:
                            formatted_messages.append({
                                "role": "assistant",
                                "content": assistant_content
                            })
                        else:
                            formatted_messages.append({
                                "role": "assistant",
                                "content": str(content)
                            })
                elif role == "system" and not system_content:
                    # Use system message from chat history if not set
                    if enable_cache:
                        system_content = [
                            {
                                "type": "text",
                                "text": content,
                                "cache_control": {"type": "ephemeral"}
                            }
                        ]
                    else:
                        system_content = content
        
        # Process current user prompt
        user_content = []
        
        # Check if caching is enabled
        if enable_cache:
            # Check if model supports caching
            model_base = None
            for supported_model in CACHE_SUPPORTED_MODELS:
                if model.startswith(supported_model.split('-latest')[0]):
                    model_base = supported_model.split('-')[0] + '-' + supported_model.split('-')[1] + '-' + supported_model.split('-')[2]
                    break
            
            if not model_base:
                return f"Error: Prompt caching is only supported for the following models: {', '.join(CACHE_SUPPORTED_MODELS)}, current model is {model}"
            
            # Process cache markers in user prompt
            if "--cache--" in prompt:
                # Split the prompt
                parts = prompt.split("--cache--", 1)
                cached_part = parts[0].strip()
                non_cached_part = parts[1].strip() if len(parts) > 1 else ""
                
                # Add cached part
                if cached_part:
                    user_content.append({
                        "type": "text",
                        "text": cached_part,
                        "cache_control": {"type": "ephemeral"}
                    })
                
                # Add non-cached part
                if non_cached_part:
                    user_content.append({
                        "type": "text",
                        "text": non_cached_part
                    })
            else:
                # No cache marker, add user prompt normally
                user_content.append({
                    "type": "text",
                    "text": prompt
                })
        else:
            # Caching not enabled, add user prompt normally
            user_content.append({
                "type": "text",
                "text": prompt
            })
        
        # Add current user message
        formatted_messages.append({
            "role": "user",
            "content": user_content
        })
        
        # Prepare API call parameters
        api_params = {
            "model": model,
            "temperature": temperature,
            "max_tokens": max_tokens_to_sample,
            "messages": formatted_messages
        }
        
        # Add system message
        if system_content:
            api_params["system"] = system_content
        
        # Add optional parameters
        if top_p != -1:
            api_params["top_p"] = top_p
        
        if top_k != -1:
            api_params["top_k"] = top_k
        
        if stop_sequences:
            api_params["stop_sequences"] = stop_sequences
        
        # Add tool-related parameters
        if tools:
            api_params["tools"] = tools
            
            if tool_choice:
                api_params["tool_choice"] = tool_choice
            
            api_params["parallel_tool_calls"] = parallel_tool_calls
        
        # Add extended thinking mode parameters
        if thinking > 0:
            # Check if model supports extended thinking
            if not model.startswith("claude-3-7"):
                return f"Error: Extended thinking mode is only supported for Claude 3.7 Sonnet models, current model is {model}"
            
            # Ensure thinking budget is less than max_tokens
            if thinking >= max_tokens_to_sample:
                return f"Error: Thinking budget ({thinking}) must be less than max_tokens ({max_tokens_to_sample})"
            
            api_params["thinking"] = {"budget_tokens": thinking, "type":"enabled"}
        
        # Send request
        response = client.messages.create(**api_params)
        
        # Get cache usage information
        cache_info = ""
        if enable_cache and hasattr(response, "usage"):
            usage = response.usage
            cache_creation = getattr(usage, "cache_creation_input_tokens", 0)
            cache_read = getattr(usage, "cache_read_input_tokens", 0)
            input_tokens = getattr(usage, "input_tokens", 0)
            output_tokens = getattr(usage, "output_tokens", 0)
            
            if cache_creation > 0:
                cache_info = f"[Cache Info]\nCache Creation: {cache_creation} tokens\nCache Read: {cache_read} tokens\nInput Tokens: {input_tokens} tokens\nOutput Tokens: {output_tokens} tokens\n\n"
            elif cache_read > 0:
                cache_info = f"[Cache Info]\nCache Hit! Cache Read: {cache_read} tokens\nInput Tokens: {input_tokens} tokens\nOutput Tokens: {output_tokens} tokens\n\n"
        
        # Process response
        if thinking > 0:
            # If extended thinking is enabled, return the full response including thinking process
            result = cache_info + "[Thinking Process]\n\n"
            for content_block in response.content:
                if content_block.type == "thinking":
                    result += content_block.thinking + "\n\n"
                elif content_block.type == "redacted_thinking":
                    result += "[Some thinking content has been encrypted by the safety system]\n\n"
                elif content_block.type == "text":
                    result += "[Final Answer]\n\n" + content_block.text
                elif content_block.type == "tool_use":
                    tool_use_json = {
                        "name": content_block.name,
                        "input": content_block.input
                    }
                    result += f"[Tool Call]\n{json.dumps(tool_use_json, ensure_ascii=False, indent=2)}\n\n"
            
            return result
        else:
            # If extended thinking is not enabled, only return text content
            for content_block in response.content:
                if content_block.type == "text":
                    return cache_info + content_block.text
                elif content_block.type == "tool_use":
                    tool_use_json = {
                        "name": content_block.name,
                        "input": content_block.input
                    }
                    return cache_info + f"[Tool Call]\n{json.dumps(tool_use_json, ensure_ascii=False, indent=2)}"
            
            # If no text content is found, return string representation of the complete response
            return cache_info + str(response)
    
    except Exception as e:
        return f"Error: Failed to call Claude API - {str(e)}" 