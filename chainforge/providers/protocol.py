from typing import Protocol, Optional, Dict, List, Literal, Union, Any, TypedDict
import inspect

"""
    OpenAI chat message format typing
"""
class ChatMessage(Dict):
    """ A single message, in OpenAI chat message format. """
    role: str
    content: str
    name: Optional[str]
    function_call: Optional[Dict]

ChatHistory = List[ChatMessage]

class SettingsSchema(TypedDict, total=False):
    # react-jsonschema-form contract:
    # "settings" = JSON-Schema *properties* object, "ui" = uiSchema
    settings: Dict[str, Any]
    ui: Dict[str, Any]

Category = Literal["model", "retriever", "chunker"]


class CustomProviderProtocol(Protocol):
    """
        A Callable protocol to implement for custom model provider completions.
        See `__call__` for more details.
    """
    def __call__(self, 
                 prompt: str,
                 model: Optional[str], 
                 chat_history: Optional[ChatHistory],
                 **kwargs: Any) -> str:
        """
          Define a call to your custom provider.

          Parameters:
           - `prompt`: Text to prompt the model. (If it's a chat model, this is the new message to send.)
           - `model`: The name of the particular model to use, from the CF settings window. Useful when you have multiple models for a single provider. Optional.
           - `chat_history`: Providers may be passed a past chat context as a list of chat messages in OpenAI format (see `chainforge.providers.ChatHistory`). 
                             Chat history does not include the new message to send off (which is passed instead as the `prompt` parameter).
           - `kwargs`: Any other parameters to pass the provider API call, like temperature. Parameter names are the keynames in your provider's settings_schema.
                       Only relevant if you are defining a custom settings_schema JSON to edit provider/model settings in ChainForge. 
        """
        pass

class CustomChunkerProtocol(Protocol):

#    A Callable protocol to implement for custom chunker provider completions..

    def __call__(self, text: str) -> List[str]:
        """
          Define a call to your custom chunker.

          Parameters:
           - `text`: A string of source text (e.g., a document or article) to be split into smaller segments.
          
          Returns:
           - A list of string chunks (typically paragraphs or sections) derived from the input text.
        """
        pass

class CustomRetrieverProtocol(Protocol):

#    A Callable protocol to implement for custom retriever provider completions.

    def __call__(self,
                 chunks: List[Dict[str, Any]],
                 queries: List[Union[str, Dict[str, Any]]],
                 settings: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
          Define a call to your custom retriever.

          Parameters:
           - `chunks`: A list of document fragments (e.g., from a chunker) with metadata for context retrieval.
           - `queries`: A list of user queries or prompts, optionally with additional metadata.
           - `settings`: Dictionary of retrieval settings, such as similarity threshold or scoring method.
          
          Returns:
           - A list of retrieved chunks with associated metadata, typically ranked by relevance to each query.
        """
        pass

class ProviderEntry(TypedDict, total=False):
    name: str
    func: Any
    script_id: str
    emoji: str
    models: Optional[List[str]]
    rate_limit: Union[int, Literal["sequential"]]
    settings_schema: Optional[SettingsSchema]
    category: Category

"""
    A registry for custom providers
"""
class _ProviderRegistry:
    def __init__(self):
        self._registry: Dict[str, ProviderEntry] = {}   # TYPED
        self._curr_script_id = '0'
        self._last_updated: Dict[str, Optional[str]] = {}
    
    def set_curr_script_id(self, id: str):
        self._curr_script_id = id

    def register(self, cls_or_fn: Any, name: str, **kwargs):
        if not name or not isinstance(name, str):
            raise Exception("Cannot register custom provider: Name must be a non-empty string.")
        self._last_updated[name] = self._registry[name]["script_id"] if name in self._registry else None
        self._registry[name] = {
            "name": name,
            "func": cls_or_fn,
            "script_id": self._curr_script_id,
            **kwargs
        }

    def get(self, name: str) -> Optional[ProviderEntry]:
        return self._registry.get(name)

    def get_all(self) -> List[ProviderEntry]:
        return list(self._registry.values())

    def get_all_by_category(self, category: Category) -> List[ProviderEntry]:
        return [e for e in self._registry.values() if e.get("category") == category]

    def has(self, name: str) -> bool:
        return name in self._registry
    
    def remove(self, name: str):
        if self.has(name):
            del self._registry[name]
    
    def watch_next_registered(self):
        self._last_updated = {}
    
    def last_registered(self) -> Dict[str, Optional[str]]:
        return {k: v for k, v in self._last_updated.items()}


# Global instance of the registry.
ProviderRegistry = _ProviderRegistry()

def _ensure_params(fn: Any, required: List[str]) -> None:
    try:
        params = list(inspect.signature(fn).parameters)
    except (TypeError, ValueError):
        # skip strict check
        return
    missing = [p for p in required if p not in params]
    if missing:
        raise TypeError(f"{getattr(fn, '__name__', fn)} must define params: {', '.join(required)}")

def provider(name: str = 'Custom Provider', 
             emoji: str = '✨', 
             models: Optional[List[str]] = None, 
             rate_limit: Union[int, Literal["sequential"]] = "sequential",
             settings_schema: Optional[SettingsSchema] = None,
             category: Category = "model"):
    """
      A decorator for registering custom LLM provider methods or classes (Callables)
      that conform to `CustomProviderProtocol`.

      Parameters:
       - `name`: The name of your custom provider. Required. (Must be unique; cannot be blank.)
       - `emoji`: The emoji to use as the default icon for your provider in the CF interface. Required.
       - `models`: A list of models that your provider supports, that you want to be able to choose between in Settings window. 
                   If you're just calling a single model, you can omit this.
       - `rate_limit`: If an integer, the maximum number of simulatenous requests to send per minute. 
                   To force requests to be sequential (wait until each request returns before sending another), enter "sequential". Default is sequential.
       - `settings_schema`: a JSON Schema specifying the name of your provider in the ChainForge UI, the available settings, and the UI for those settings.
          The settings and UI specs are in react-jsonschema-form format: https://rjsf-team.github.io/react-jsonschema-form/. 
          
            Specifically, your `settings_schema` dict should have keys:

            ```
            {
              "settings": <JSON dict of the schema properties for your settings form, in react-jsonschema-form format (https://rjsf-team.github.io/react-jsonschema-form/docs/)>,
              "ui": <JSON dict of the UI Schema for your settings form, in react-jsonschema-form (see UISchema example here: https://rjsf-team.github.io/react-jsonschema-form/) 
            }
            ```

            You may look to adapt an existing schema from `ModelSettingsSchemas.js` in `chainforge/react-server/src/`,
            BUT with the following things to keep in mind:
             - the value of "settings" should just be the value of "properties" in the full schema 
             - don't include the 'shortname' property; this will be added by default and set to the value of `name`
             - don't include the 'model' property; this will be populated by the list you passed to `models` (if any)
             - the keynames of all properties of the schema should be valid as variable names for Python keyword args; i.e., no spaces

            Finally, if you want temperature to appear in the ChainForge UI, you must name your
            settings schema property `temperature`, and give it `minimum` and `maximum` values.  

            NOTE: Only `textarea`, `range`, and enum, and text input UI widgets are properly supported from `react-jsonschema-form`; 
            you can try other widget types, but the CSS may not display property. 
        - category: "model" | "retriever" | "chunker"
            Callable shapes:
            - category == "model":
                (prompt, model, chat_history, **kwargs) -> str
            - category == "retriever":
                (chunks, queries, settings) -> List[...]
            - category == "chunker":
                (text) -> List[str]

    """
    def dec(cls: Union[CustomProviderProtocol, CustomChunkerProtocol, CustomRetrieverProtocol]):
        # Allow functions OR classes-with-__call__
        fn = cls() if inspect.isclass(cls) else cls

        # Friendly signature check
        if category == "retriever":
            _ensure_params(fn, ["chunks", "queries", "settings"])
        elif category == "chunker":
            _ensure_params(fn, ["text"])
        # (we skip strict check for "model" to allow flexible kwargs)

        ProviderRegistry.register(
            fn, name=name, emoji=emoji, models=models,
            rate_limit=rate_limit, settings_schema=settings_schema,
            category=category,
        )
        return cls
    return dec