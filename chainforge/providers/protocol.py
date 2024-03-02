from typing import Protocol, Optional, Dict, Dict, List, Literal, Union, Any
import time

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


"""
    A registry for custom providers
"""
class _ProviderRegistry:
    def __init__(self):
        self._registry = {}
        self._curr_script_id = '0'
        self._last_updated = {}
    
    def set_curr_script_id(self, id: str):
        self._curr_script_id = id

    def register(self, cls: CustomProviderProtocol, name: str, **kwargs):
        if name is None or isinstance(name, str) is False or len(name) == 0:
            raise Exception("Cannot register custom model provider: No name given. Name must be a string and unique.")
        self._last_updated[name] = self._registry[name]["script_id"] if name in self._registry else None
        self._registry[name] = { "name": name, "func": cls, "script_id": self._curr_script_id, **kwargs }

    def get(self, name):
        return self._registry.get(name)

    def get_all(self):
        return list(self._registry.values())

    def has(self, name):
        return name in self._registry
    
    def remove(self, name):
        if self.has(name):
            del self._registry[name]
    
    def watch_next_registered(self):
        self._last_updated = {}
    
    def last_registered(self):
        return {k: v for k, v in self._last_updated.items()}


# Global instance of the registry.
ProviderRegistry = _ProviderRegistry()

def provider(name: str = 'Custom Provider', 
             emoji: str = '✨', 
             models: Optional[List[str]] = None, 
             rate_limit: Union[int, Literal["sequential"]] = "sequential",
             settings_schema: Optional[Dict] = None):
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

    """
    def dec(cls: CustomProviderProtocol):
        ProviderRegistry.register(cls, name=name, emoji=emoji, models=models, rate_limit=rate_limit, settings_schema=settings_schema)
        return cls
    return dec